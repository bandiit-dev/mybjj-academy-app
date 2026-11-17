import { v } from "convex/values";
import { assertDateOfBirth, assertDegree, assertInvitationEmail, beltValidator, teacherClassTypeValidator } from "./lib/validators";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireAcademyUnitAdmin } from "./lib/auth";

const userTypeValidator = v.union(v.literal("Normal"), v.literal("Admin"));

async function checkInvitationAllowed(
  ctx: QueryCtx | MutationCtx,
  args: { email: string; gymId: Id<"gyms">; unityId: Id<"unities">; studentId?: Id<"students"> }
) {
  const principal = await requireAcademyUnitAdmin(ctx, args.gymId, args.unityId);
  if (args.studentId) {
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");
    const gymIds = new Set([...(principal.teacher?.gymIds ?? []), ...(principal.student?.gymIds ?? [])]);
    if (!student.gymIds.some(id => gymIds.has(id))) throw new Error("Forbidden: student belongs to another academy");
    if (student.clerkUserId) throw new Error("Student already has an account or pending invitation");
  }
  assertInvitationEmail(args.email);
  const email = args.email.trim().toLowerCase();
  const students = ctx.db.query("students").withIndex("by_email", q => q.eq("email", email));
  const [teacher, student] = await Promise.all([
    ctx.db.query("teachers").withIndex("by_email", q => q.eq("email", email)).first(),
    args.studentId ? students.filter(q => q.neq(q.field("_id"), args.studentId)).first() : students.first()
  ]);
  if (teacher || student) throw new Error("A profile already exists for this email");
  return true;
}

export const assertInvitationAllowed = internalQuery({
  args: { email: v.string(), gymId: v.id("gyms"), unityId: v.id("unities"), studentId: v.optional(v.id("students")) },
  handler: checkInvitationAllowed
});

export const insertInvitedTeacher = internalMutation({
  args: {
    invitationId: v.string(), name: v.string(), email: v.string(), phone: v.string(), belt: beltValidator,
    degree: v.number(), gymId: v.id("gyms"), unityId: v.id("unities"), role: v.string(),
    picture: v.string(), classType: teacherClassTypeValidator, userType: userTypeValidator
  },
  handler: async (ctx, args) => {
    assertDegree(args.degree); const now = Date.now();
    const teacherId = await ctx.db.insert("teachers", {
      clerkUserId: `invitation:${args.invitationId}`, name: args.name.trim(), email: args.email.trim().toLowerCase(),
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
    invitationId: v.string(), name: v.string(), email: v.string(), phone: v.optional(v.string()), dateOfBirth: v.optional(v.string()), belt: beltValidator,
    degree: v.number(), gymId: v.id("gyms"), unityId: v.id("unities"), picture: v.string()
  },
  handler: async (ctx, args) => {
    assertDateOfBirth(args.dateOfBirth);
    assertDegree(args.degree); const now = Date.now();
    return ctx.db.insert("students", {
      clerkUserId: `invitation:${args.invitationId}`, name: args.name.trim(), email: args.email.trim().toLowerCase(),
      phone: (args.phone ?? "").trim(), dateOfBirth: args.dateOfBirth, belt: args.belt, degree: args.degree, gymIds: [args.gymId], unityIds: [args.unityId],
      picture: args.picture.trim(), userType: "Normal", createdAt: now, updatedAt: now
    });
  }
});

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
    const invitationId = await createClerkInvitation(args.email, args.redirectUrl);
    const { redirectUrl, ...profile } = args;
    return ctx.runMutation(internal.provisioning.insertInvitedTeacher, { ...profile, invitationId });
  }
});

export const inviteStudent = action({
  args: {
    name: v.string(), email: v.string(), phone: v.optional(v.string()), dateOfBirth: v.optional(v.string()), belt: beltValidator, degree: v.number(),
    gymId: v.id("gyms"), unityId: v.id("unities"), picture: v.string(), redirectUrl: v.string()
  },
  handler: async (ctx, args): Promise<Id<"students">> => {
    if (!(await ctx.auth.getUserIdentity())) throw new Error("Unauthorized");
    await ctx.runQuery(internal.provisioning.assertInvitationAllowed, { email: args.email, gymId: args.gymId, unityId: args.unityId });
    assertDateOfBirth(args.dateOfBirth);
    assertDegree(args.degree);
    const invitationId = await createClerkInvitation(args.email, args.redirectUrl);
    const { redirectUrl, ...profile } = args;
    return ctx.runMutation(internal.provisioning.insertInvitedStudent, { ...profile, invitationId });
  }
});

const existingStudentInvitationArgs = {
  studentId: v.id("students"), name: v.string(), email: v.string(), phone: v.optional(v.string()),
  dateOfBirth: v.optional(v.string()), belt: beltValidator, degree: v.number(),
  gymId: v.id("gyms"), unityId: v.id("unities"), picture: v.string()
};

export const updateInvitedStudent = internalMutation({
  args: { ...existingStudentInvitationArgs, invitationId: v.string() },
  handler: async (ctx, args) => {
    await checkInvitationAllowed(ctx, args);
    assertDateOfBirth(args.dateOfBirth);
    assertDegree(args.degree);
    await ctx.db.patch(args.studentId, {
      name: args.name.trim(), email: args.email.trim().toLowerCase(), phone: (args.phone ?? "").trim(),
      dateOfBirth: args.dateOfBirth, belt: args.belt, degree: args.degree,
      gymIds: [args.gymId], unityIds: [args.unityId], picture: args.picture.trim(),
      clerkUserId: `invitation:${args.invitationId}`, updatedAt: Date.now()
    });
    return args.studentId;
  }
});

export const inviteExistingStudent = action({
  args: { ...existingStudentInvitationArgs, redirectUrl: v.string() },
  handler: async (ctx, args): Promise<Id<"students">> => {
    if (!(await ctx.auth.getUserIdentity())) throw new Error("Unauthorized");
    assertDateOfBirth(args.dateOfBirth);
    assertDegree(args.degree);
    if (!args.name.trim()) throw new Error("Student name is required");
    await ctx.runQuery(internal.provisioning.assertInvitationAllowed, {
      studentId: args.studentId, email: args.email, gymId: args.gymId, unityId: args.unityId
    });
    const invitationId = await createClerkInvitation(args.email, args.redirectUrl);
    const { redirectUrl, ...profile } = args;
    return ctx.runMutation(internal.provisioning.updateInvitedStudent, { ...profile, invitationId });
  }
});
