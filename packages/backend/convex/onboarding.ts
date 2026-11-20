import { hasPaidPortalAccess, subscriptionRequired } from "./lib/portalBilling";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { assertDegree, beltValidator } from "./lib/validators";

import { action, internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getAuthUserIdentity, getCurrentStudentByClerkId, getCurrentTeacherByClerkId } from "./lib/auth";

type AuthCtx = Pick<QueryCtx, "auth" | "db"> | Pick<MutationCtx, "auth" | "db">;

async function findProfilesByEmail(ctx: AuthCtx, email: string | undefined) {
  if (!email) return { teacher: null, student: null };
  const normalized = email.trim().toLowerCase();
  const [teacher, student] = await Promise.all([
    ctx.db.query("teachers").withIndex("by_email", (q) => q.eq("email", normalized)).first(),
    ctx.db.query("students").withIndex("by_email", (q) => q.eq("email", normalized))
      .filter((q) => q.neq(q.field("clerkUserId"), undefined)).first()
  ]);
  return { teacher, student };
}

async function linkVerifiedProfile(ctx: MutationCtx, subject: string, email: string) {
  const [currentTeacher, currentStudent] = await Promise.all([
    getCurrentTeacherByClerkId(ctx, subject),
    getCurrentStudentByClerkId(ctx, subject),
  ]);
  if (currentTeacher || currentStudent) return { status: "linked" as const };

  const { teacher, student } = await findProfilesByEmail(ctx, email);
  if (teacher && student) throw new Error("Multiple profiles use this email; contact support");
  const profile = teacher ?? student;
  if (!profile) return { status: "needs_academy" as const };
  if (!profile.clerkUserId?.startsWith("invitation:")) {
    throw new Error("This profile is already linked to a different account");
  }

  await ctx.db.patch(profile._id, { clerkUserId: subject, updatedAt: Date.now() });
  return { status: "linked" as const };
}

export const resolveVerifiedProfile = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const { subject } = await getAuthUserIdentity(ctx);
    return linkVerifiedProfile(ctx, subject, email);
  },
});

export const resolvePortalAccount = action({
  args: {},
  handler: async (ctx): Promise<{ status: "linked" | "needs_academy" }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error("Unauthorized");

    let email = identity.emailVerified === true ? identity.email : undefined;
    if (!email?.trim()) {
      const secret = process.env.CLERK_SECRET_KEY;
      if (!secret) throw new Error("Clerk account lookup is not configured");
      const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(identity.subject)}`, {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("Could not verify the signed-in Clerk account");
      const user = await response.json() as {
        id: string;
        primary_email_address_id?: string;
        email_addresses?: Array<{ id: string; email_address: string; verification?: { status: string } }>;
      };
      email = user.id === identity.subject
        ? user.email_addresses?.find(address => address.id === user.primary_email_address_id &&
          address.verification?.status === "verified")?.email_address
        : undefined;
    }
    if (!email?.trim()) throw new Error("A verified primary email is required");

    return ctx.runMutation(internal.onboarding.resolveVerifiedProfile, { email });
  },
});

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
    const candidates = await findProfilesByEmail(ctx, identity.emailVerified === true ? email : undefined);
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

    if (identity.emailVerified !== true || !identity.email?.trim()) {
      throw new Error("No profile matches the verified Clerk email");
    }
    const result = await linkVerifiedProfile(ctx, identity.subject, identity.email);
    if (result.status !== "linked") throw new Error("No profile matches the verified Clerk email");
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
    teamName: v.optional(v.string()),
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

    const accounts = await ctx.db.query("billingAccounts").withIndex("by_owner", q => q.eq("ownerClerkUserId", identity.subject)).collect();
    const billingAccount = accounts.find(account => !account.gymId && hasPaidPortalAccess(account));
    if (!billingAccount) subscriptionRequired();

    assertDegree(args.adminDegree);
    const now = Date.now();
    const gymId = await ctx.db.insert("gyms", {
      teamName: (args.teamName ?? "").trim(),
      name: args.gymName.trim(), cnpj: args.cnpj.trim(), phone: args.gymPhone.trim(),
      email: args.contactEmail.trim().toLowerCase(), unityIds: [], founded: args.founded,
      teamId: null, branding: {}, teacherIds: [], createdAt: now, updatedAt: now
    });
    await ctx.db.patch(billingAccount._id, {gymId, updatedAt: now});
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
