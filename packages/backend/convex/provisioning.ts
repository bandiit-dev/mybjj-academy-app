import { assertActiveStudentCapacity, getStudentPlan, studentPlanValidator, validateStudentPlan } from "./lib/studentPlans";
import { v } from "convex/values";
import { assertDateOfBirth, assertDegree, assertInvitationEmail, beltValidator, teacherClassTypeValidator } from "./lib/validators";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getProfilesByClerkId, requireAcademyUnitAdmin } from "./lib/auth";

const userTypeValidator = v.union(v.literal("Normal"), v.literal("Admin"));

async function checkInvitationAllowed(
  ctx: QueryCtx | MutationCtx,
  args: { email: string; gymId: Id<"gyms">; unityId: Id<"unities">; studentId?: Id<"students">; existingClerkUserId?: string; invitationId?: string }
) {
  const principal = await requireAcademyUnitAdmin(ctx, args.gymId, args.unityId);
  if (args.studentId) {
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");
    const gymIds = new Set([...(principal.teacher?.gymIds ?? []), ...(principal.student?.gymIds ?? [])]);
    if (!student.gymIds.some(id => gymIds.has(id))) throw new Error("Forbidden: student belongs to another academy");
    if (student.gymIds.some(id => !gymIds.has(id))) throw new Error("Forbidden: the student profile is shared with another academy");
    if (student.clerkUserId) throw new Error("Student already has an account or pending invitation");
  }
  assertInvitationEmail(args.email);
  const email = args.email.trim().toLowerCase();
  const [teachers, students] = await Promise.all([
    ctx.db.query("teachers").withIndex("by_email", q => q.eq("email", email)).collect(),
    ctx.db.query("students").withIndex("by_email", q => q.eq("email", email)).collect(),
  ]);
  const matches = [...teachers, ...students.filter(student => student._id !== args.studentId)];
  if (matches.some(profile =>
    profile.gymIds?.includes(args.gymId) ||
    (args.invitationId && profile.clerkUserId?.startsWith("invitation:"))
  )) throw new Error("A profile already exists for this email");
  if (args.existingClerkUserId) {
    const linked = await getProfilesByClerkId(ctx, args.existingClerkUserId);
    if ([...linked.teachers, ...linked.students].some(profile => profile.gymIds.includes(args.gymId))) {
      throw new Error("A profile already exists in this academy for this account");
    }
  }
  return true;
}

export const assertInvitationAllowed = internalQuery({
  args: {
    email: v.string(), gymId: v.id("gyms"), unityId: v.id("unities"), studentId: v.optional(v.id("students")),
    studentInvitation: v.optional(v.boolean()), plan: v.optional(studentPlanValidator)
  },
  handler: async (ctx, args) => {
    await checkInvitationAllowed(ctx, args);
    if (args.studentInvitation) {
      const previous = args.studentId ? await ctx.db.get(args.studentId) : null;
      const plan = args.plan ?? getStudentPlan(previous ?? {});
      await assertActiveStudentCapacity(ctx, [args.gymId], plan, previous ?? undefined);
    }
    return true;
  }
});

export const insertInvitedTeacher = internalMutation({
  args: {
    invitationId: v.optional(v.string()), existingClerkUserId: v.optional(v.string()), name: v.string(), email: v.string(), phone: v.string(), belt: beltValidator,
    degree: v.number(), gymId: v.id("gyms"), unityId: v.id("unities"), role: v.string(),
    picture: v.string(), classType: teacherClassTypeValidator, userType: userTypeValidator
  },
  handler: async (ctx, args) => {
    await checkInvitationAllowed(ctx, args);
    assertDegree(args.degree); const now = Date.now();
    const teacherId = await ctx.db.insert("teachers", {
      clerkUserId: invitedClerkUserId(args), name: args.name.trim(), email: args.email.trim().toLowerCase(),
      phone: args.phone.trim(), belt: args.belt, degree: args.degree, gymIds: [args.gymId], unityIds: [args.unityId],
      role: args.role.trim(), picture: args.picture.trim(), classType: args.classType, classIds: [],
      userType: args.userType, createdAt: now, updatedAt: now
    });
    const gym = await ctx.db.get(args.gymId);
    if (gym && !gym.teacherIds.includes(teacherId)) await ctx.db.patch(args.gymId, { teacherIds: [...gym.teacherIds, teacherId], updatedAt: now });
    return teacherId;
  }
});

export const insertInvitedStudent = internalMutation({
  args: {
    plan: v.optional(studentPlanValidator),
    invitationId: v.optional(v.string()), existingClerkUserId: v.optional(v.string()), name: v.string(), email: v.string(), phone: v.optional(v.string()), dateOfBirth: v.optional(v.string()), belt: beltValidator,
    degree: v.number(), gymId: v.id("gyms"), unityId: v.id("unities"), picture: v.string()
  },
  handler: async (ctx, args) => {
    await checkInvitationAllowed(ctx, args);
    const plan = validateStudentPlan(getStudentPlan(args));
    assertDateOfBirth(args.dateOfBirth);
    assertDegree(args.degree); const now = Date.now();
    await assertActiveStudentCapacity(ctx, [args.gymId], plan);
    return ctx.db.insert("students", {
      plan,
      clerkUserId: invitedClerkUserId(args), name: args.name.trim(), email: args.email.trim().toLowerCase(),
      phone: (args.phone ?? "").trim(), dateOfBirth: args.dateOfBirth, belt: args.belt, degree: args.degree, gymIds: [args.gymId], unityIds: [args.unityId],
      picture: args.picture.trim(), userType: "Normal", createdAt: now, updatedAt: now
    });
  }
});

function invitedClerkUserId({ invitationId, existingClerkUserId }: {
  invitationId?: string; existingClerkUserId?: string;
}) {
  if (existingClerkUserId) return existingClerkUserId;
  if (invitationId) return `invitation:${invitationId}`;
  throw new Error("Missing Clerk account or invitation");
}

async function existingClerkAccount(email: string) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("Clerk provisioning is not configured");
  const normalized = email.trim().toLowerCase();
  const params = new URLSearchParams({ email_address: normalized });
  const response = await fetch(`https://api.clerk.com/v1/users?${params}`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Could not look up the Clerk account");
  const users = await response.json() as Array<{
    id: string;
    email_addresses?: Array<{ email_address: string; verification?: { status: string } }>;
  }>;
  const verified = users.filter(user => user.email_addresses?.some(address =>
    address.email_address.trim().toLowerCase() === normalized &&
    address.verification?.status === "verified"
  ));
  if (verified.length > 1) throw new Error("Multiple accounts already use this email");
  return verified[0]?.id;
}

async function createClerkInvitation(email: string, redirectUrl: string) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("Clerk provisioning is not configured");
  const response = await fetch("https://api.clerk.com/v1/invitations", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email_address: email.trim().toLowerCase(), redirect_url: redirectUrl, ignore_existing: false })
  });
  const body = await response.json() as { id?: string; errors?: Array<{ long_message?: string; message?: string }> };
  if (!response.ok || !body.id) throw new Error(body.errors?.[0]?.long_message ?? body.errors?.[0]?.message ?? "Could not create Clerk invitation");
  return body.id;
}

async function saveInvitation<ProfileId>(
  invitationId: string | undefined,
  save: () => Promise<ProfileId>
) {
  try {
    return await save();
  } catch (error) {
    if (!invitationId) throw error;
    try {
      const response = await fetch(`https://api.clerk.com/v1/invitations/${encodeURIComponent(invitationId)}/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) console.error("Account invitation revocation failed", response.status);
    } catch {
      console.error("Account invitation revocation failed");
    }
    throw error;
  }
}

export const inviteTeacher = action({
  args: {
    name: v.string(), email: v.string(), phone: v.string(), belt: beltValidator, degree: v.number(),
    gymId: v.id("gyms"), unityId: v.id("unities"), role: v.string(), picture: v.string(),
    classType: teacherClassTypeValidator, userType: userTypeValidator, redirectUrl: v.string()
  },
  handler: async (ctx, args): Promise<Id<"teachers">> => {
    if (!(await ctx.auth.getUserIdentity())) throw new Error("Unauthorized");
    await ctx.runQuery(internal.provisioning.assertInvitationAllowed, { email: args.email, gymId: args.gymId, unityId: args.unityId });
    assertDegree(args.degree);
    const existingClerkUserId = await existingClerkAccount(args.email);
    const invitationId = existingClerkUserId
      ? undefined
      : await createClerkInvitation(args.email, args.redirectUrl);
    const { redirectUrl, ...profile } = args;
    return saveInvitation(invitationId, () =>
      ctx.runMutation(internal.provisioning.insertInvitedTeacher, { ...profile, invitationId, existingClerkUserId })
    );
  }
});

export const inviteStudent = action({
  args: {
    plan: v.optional(studentPlanValidator),
    name: v.string(), email: v.string(), phone: v.optional(v.string()), dateOfBirth: v.optional(v.string()), belt: beltValidator, degree: v.number(),
    gymId: v.id("gyms"), unityId: v.id("unities"), picture: v.string(), redirectUrl: v.string()
  },
  handler: async (ctx, args): Promise<Id<"students">> => {
    if (!(await ctx.auth.getUserIdentity())) throw new Error("Unauthorized");
    await ctx.runQuery(internal.provisioning.assertInvitationAllowed, { email: args.email, gymId: args.gymId, unityId: args.unityId, studentInvitation: true, plan: args.plan });
    if (args.plan) validateStudentPlan(args.plan);
    assertDateOfBirth(args.dateOfBirth);
    assertDegree(args.degree);
    const existingClerkUserId = await existingClerkAccount(args.email);
    const invitationId = existingClerkUserId
      ? undefined
      : await createClerkInvitation(args.email, args.redirectUrl);
    const { redirectUrl, ...profile } = args;
    return saveInvitation(invitationId, () =>
      ctx.runMutation(internal.provisioning.insertInvitedStudent, { ...profile, invitationId, existingClerkUserId })
    );
  }
});

const existingStudentInvitationArgs = {
  plan: v.optional(studentPlanValidator),
  studentId: v.id("students"), name: v.string(), email: v.string(), phone: v.optional(v.string()),
  dateOfBirth: v.optional(v.string()), belt: beltValidator, degree: v.number(),
  gymId: v.id("gyms"), unityId: v.id("unities"), picture: v.string()
};

export const updateInvitedStudent = internalMutation({
  args: { ...existingStudentInvitationArgs, invitationId: v.optional(v.string()), existingClerkUserId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await checkInvitationAllowed(ctx, args);
    if (args.plan) validateStudentPlan(args.plan);
    assertDateOfBirth(args.dateOfBirth);
    assertDegree(args.degree);
    const previous = (await ctx.db.get(args.studentId))!;
    await assertActiveStudentCapacity(ctx, [args.gymId], args.plan ?? getStudentPlan(previous), previous);
    await ctx.db.patch(args.studentId, {
      ...(args.plan ? { plan: args.plan } : {}),
      name: args.name.trim(), email: args.email.trim().toLowerCase(), phone: (args.phone ?? "").trim(),
      dateOfBirth: args.dateOfBirth, belt: args.belt, degree: args.degree,
      gymIds: [args.gymId], unityIds: [args.unityId], picture: args.picture.trim(),
      clerkUserId: invitedClerkUserId(args), updatedAt: Date.now()
    });
    return args.studentId;
  }
});

export const inviteExistingStudent = action({
  args: { ...existingStudentInvitationArgs, redirectUrl: v.string() },
  handler: async (ctx, args): Promise<Id<"students">> => {
    if (!(await ctx.auth.getUserIdentity())) throw new Error("Unauthorized");
    if (args.plan) validateStudentPlan(args.plan);
    assertDateOfBirth(args.dateOfBirth);
    assertDegree(args.degree);
    if (!args.name.trim()) throw new Error("Student name is required");
    await ctx.runQuery(internal.provisioning.assertInvitationAllowed, {
      studentId: args.studentId, email: args.email, gymId: args.gymId, unityId: args.unityId, studentInvitation: true, plan: args.plan
    });
    const existingClerkUserId = await existingClerkAccount(args.email);
    const invitationId = existingClerkUserId
      ? undefined
      : await createClerkInvitation(args.email, args.redirectUrl);
    const { redirectUrl, ...profile } = args;
    return saveInvitation(invitationId, () =>
      ctx.runMutation(internal.provisioning.updateInvitedStudent, { ...profile, invitationId, existingClerkUserId })
    );
  }
});
