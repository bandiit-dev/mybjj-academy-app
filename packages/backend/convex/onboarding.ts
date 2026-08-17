import { v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getAuthUserIdentity, getCurrentStudentByClerkId, getCurrentTeacherByClerkId } from "./lib/auth";
import { assertDegree } from "./lib/validators";

const beltValidator = v.union(v.literal("White"), v.literal("Blue"), v.literal("Purple"), v.literal("Brown"), v.literal("Black"), v.literal("Coral"), v.literal("Red"));

type AuthCtx = Pick<QueryCtx, "auth" | "db"> | Pick<MutationCtx, "auth" | "db">;

async function findProfilesByEmail(ctx: AuthCtx, email: string | undefined) {
  if (!email) return { teacher: null, student: null };
  const normalized = email.trim().toLowerCase();
  const [teacher, student] = await Promise.all([
    ctx.db.query("teachers").withIndex("by_email", (q) => q.eq("email", normalized)).first(),
    ctx.db.query("students").withIndex("by_email", (q) => q.eq("email", normalized)).first()
  ]);
  return { teacher, student };
}

export const getOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) return { status: "unauthenticated" as const };

    const [teacher, student] = await Promise.all([
      getCurrentTeacherByClerkId(ctx, identity.subject),
      getCurrentStudentByClerkId(ctx, identity.subject)
    ]);

    if (teacher || student) {
      return {
        status: "ready" as const,
        isAdmin: teacher?.userType === "Admin" || student?.userType === "Admin",
        profileType: teacher ? "teacher" as const : "student" as const,
        displayName: teacher?.name ?? student?.name ?? identity.name ?? "Usuário"
      };
    }

    const email = typeof identity.email === "string" ? identity.email : undefined;
    const candidates = await findProfilesByEmail(ctx, email);
    const candidate = candidates.teacher ?? candidates.student;

    if (candidate) {
      return {
        status: "link_required" as const,
        profileType: candidates.teacher ? "teacher" as const : "student" as const,
        displayName: candidate.name,
        email: candidate.email
      };
    }

    return {
      status: "needs_academy" as const,
      displayName: identity.name ?? "",
      email: email ?? ""
    };
  }
});

export const linkExistingProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error("Unauthorized");

    const [currentTeacher, currentStudent] = await Promise.all([
      getCurrentTeacherByClerkId(ctx, identity.subject),
      getCurrentStudentByClerkId(ctx, identity.subject)
    ]);
    if (currentTeacher || currentStudent) return { linked: true };

    const email = typeof identity.email === "string" ? identity.email : undefined;
    const { teacher, student } = await findProfilesByEmail(ctx, email);
    if (teacher && student) throw new Error("Multiple profiles use this email; contact support");
    const profile = teacher ?? student;
    if (!profile) throw new Error("No profile matches the verified Clerk email");

    await ctx.db.patch(profile._id, { clerkUserId: identity.subject, updatedAt: Date.now() });
    return { linked: true };
  }
});

export const bootstrapAcademyAdmin = mutation({
  args: {
    adminName: v.string(),
    adminPhone: v.string(),
    adminBelt: beltValidator,
    adminDegree: v.number(),
    gymName: v.string(),
    cnpj: v.string(),
    gymPhone: v.string(),
    contactEmail: v.string(),
    founded: v.string(),
    unityName: v.string(),
    unityAddress: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error("Unauthorized");

    const [currentTeacher, currentStudent] = await Promise.all([
      getCurrentTeacherByClerkId(ctx, identity.subject),
      getCurrentStudentByClerkId(ctx, identity.subject)
    ]);
    if (currentTeacher || currentStudent) throw new Error("This Clerk user already has a profile");

    const identityEmail = typeof identity.email === "string" ? identity.email.trim().toLowerCase() : "";
    const email = identityEmail || args.contactEmail.trim().toLowerCase();
    const candidates = await findProfilesByEmail(ctx, email);
    if (candidates.teacher || candidates.student) throw new Error("A profile already exists for this email; link it instead");

    const existingGym = await ctx.db.query("gyms").withIndex("by_cnpj", (q) => q.eq("cnpj", args.cnpj.trim())).first();
    if (existingGym) throw new Error("A gym already exists with this CNPJ");

    assertDegree(args.adminDegree);
    const now = Date.now();
    const gymId = await ctx.db.insert("gyms", {
      name: args.gymName.trim(), cnpj: args.cnpj.trim(), phone: args.gymPhone.trim(),
      email: args.contactEmail.trim().toLowerCase(), unityIds: [], founded: args.founded,
      teamId: null, branding: {}, teacherIds: [], createdAt: now, updatedAt: now
    });
    const unityId = await ctx.db.insert("unities", {
      name: args.unityName.trim(), address: args.unityAddress.trim(), gymId, createdAt: now, updatedAt: now
    });
    const teacherId = await ctx.db.insert("teachers", {
      clerkUserId: identity.subject, name: args.adminName.trim(), email, phone: args.adminPhone.trim(),
      belt: args.adminBelt, degree: args.adminDegree, gymIds: [gymId], unityIds: [unityId], role: "Proprietário",
      picture: typeof identity.pictureUrl === "string" ? identity.pictureUrl : "", classType: "GI",
      classIds: [], userType: "Admin", createdAt: now, updatedAt: now
    });
    await ctx.db.patch(gymId, { unityIds: [unityId], teacherIds: [teacherId], updatedAt: Date.now() });

    return { gymId, unityId, teacherId };
  }
});
