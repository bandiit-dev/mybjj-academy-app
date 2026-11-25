import { hasPaidPortalAccess, subscriptionRequired } from "./lib/portalBilling";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { assertDegree, beltValidator } from "./lib/validators";

import { action, internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { academyMemberships, academySelection, getAcademyChoices, getAuthUserIdentity, getProfilesByClerkId, isStudentAccessDisabled, resolveAcademyMembership } from "./lib/auth";

import { INVITATION_PREFIX, profilesWithAccessEmail } from "./lib/accountInvitations";

type AuthCtx = Pick<QueryCtx, "auth" | "db"> | Pick<MutationCtx, "auth" | "db">;

async function findProfilesByEmail(ctx: AuthCtx, email: string | undefined) {
  if (!email) return { teacher: null, student: null };
  const { teachers, students } = await profilesWithAccessEmail(ctx, email);
  const pendingTeacher = teachers.find(profile => profile.clerkUserId.startsWith("invitation:"));
  const pendingStudent = students.find(profile => profile.clerkUserId?.startsWith("invitation:"));
  if (pendingTeacher || pendingStudent) {
    return { teacher: pendingTeacher ?? null, student: pendingStudent ?? null };
  }
  return { teacher: teachers[0] ?? null, student: students[0] ?? null };
}

async function linkVerifiedProfile(ctx: MutationCtx, subject: string, email: string) {
  const { teachers, students } = await getProfilesByClerkId(ctx, subject);
  const existing = teachers.length > 0 || students.length > 0;
  const candidates = await profilesWithAccessEmail(ctx, email);
  const pendingFamily = candidates.students.filter(profile =>
    profile.guardianEmail && profile.clerkUserId?.startsWith(INVITATION_PREFIX));
  if (existing && !pendingFamily.length) return { status: "linked" as const };

  const pendingPersonal = [
    ...candidates.teachers.filter(profile => profile.clerkUserId.startsWith(INVITATION_PREFIX)),
    ...candidates.students.filter(profile =>
      !profile.guardianEmail && profile.clerkUserId?.startsWith(INVITATION_PREFIX)),
  ];
  if (pendingPersonal.length > 1) throw new Error("Multiple profiles use this email; contact support");
  const profiles = existing ? pendingFamily : [...pendingPersonal, ...pendingFamily];
  if (!profiles.length) {
    if (candidates.teachers.length || candidates.students.length) {
      throw new Error("This profile is already linked to a different account");
    }
    return { status: "needs_academy" as const };
  }

  const updatedAt = Date.now();
  for (const profile of profiles) {
    await ctx.db.patch(profile._id, { clerkUserId: subject, updatedAt });
  }
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

    const { teachers, students, active, choices } = await resolveAcademyMembership(ctx, identity.subject);
    const teacher = teachers[0];
    const student = students[0];
    if (teacher || student) {
      const currentStudent = active?.profileType === "student"
        ? students.find(profile => profile._id === active.profile._id)
        : !active && !teacher ? student : null;
      const billing = active
        ? await ctx.db.query("billingAccounts").withIndex("by_gymId", q => q.eq("gymId", active.gymId)).unique()
        : null;
      return {
        status: "ready" as const,
        isAdmin: active ? active.role === "admin" : teacher?.userType === "Admin" || student?.userType === "Admin",
        profileType: active?.profileType ?? (teacher ? "teacher" as const : "student" as const),
        displayName: active?.profile.name ?? teacher?.name ?? student?.name ?? identity.name ?? "Usuário",
        ...(isStudentAccessDisabled(currentStudent) ? { studentAccessDisabled: true } : {}),
        ...(!hasPaidPortalAccess(billing) ? { academySubscriptionInactive: true } : {}),
        ...(choices.length > 1 ? {
          activeGymId: active?.gymId,
          ...(active?.role === "student" && currentStudent ? { activeStudentId: currentStudent._id } : {}),
        } : {}),
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

export const listAcademyAccess = query({
  args: {},
  handler: async (ctx) => {
    const { subject } = await getAuthUserIdentity(ctx);
    const memberships = academyMemberships(await getProfilesByClerkId(ctx, subject));
    const academies = await Promise.all([...memberships.values()].map(async ({ gymId, role }) => {
      const gym = await ctx.db.get(gymId);
      return gym ? { gymId, role, name: gym.name } : null;
    }));
    return academies.filter(academy => academy !== null);
  },
});

export const listProfileAccess = query({
  args: {},
  handler: async (ctx) => {
    const { subject } = await getAuthUserIdentity(ctx);
    const { choices } = getAcademyChoices(await getProfilesByClerkId(ctx, subject));
    const options = await Promise.all(choices.map(async choice => {
      const gym = await ctx.db.get(choice.gymId);
      if (!gym) return null;
      return {
        gymId: choice.gymId,
        gymName: gym.name,
        role: choice.role,
        studentId: choice.role === "student" && choice.profileType === "student"
          ? choice.profile._id as Id<"students">
          : undefined,
        name: choice.profile.name,
      };
    }));
    return options.filter(option => option !== null);
  },
});

export const selectAcademy = mutation({
  args: { gymId: v.id("gyms"), studentId: v.optional(v.id("students")) },
  handler: async (ctx, { gymId, studentId }) => {
    const { subject } = await getAuthUserIdentity(ctx);
    const { memberships, choices } = getAcademyChoices(await getProfilesByClerkId(ctx, subject));
    const membership = studentId
      ? choices.find(choice => choice.gymId === gymId && choice.role === "student" && choice.profile._id === studentId)
      : memberships.get(gymId);
    if (!membership || !(await ctx.db.get(gymId))) {
      throw new Error("Forbidden: academy access required for this profile");
    }
    const saved = await academySelection(ctx, subject);
    if (saved) await ctx.db.patch(saved._id, { gymId, studentId });
    else await ctx.db.insert("academySelections", { clerkUserId: subject, gymId, studentId });
  },
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

    const { teachers, students } = await getProfilesByClerkId(ctx, identity.subject);
    if (teachers.length || students.length) throw new Error("This Clerk user already has a profile");

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
