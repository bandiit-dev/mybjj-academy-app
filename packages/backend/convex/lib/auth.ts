import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type AuthIdentity = {
  subject: string;
};

type AuthCtx = Pick<QueryCtx, "auth" | "db"> | Pick<MutationCtx, "auth" | "db">;

export async function getAuthUserIdentity(ctx: AuthCtx): Promise<AuthIdentity> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity?.subject) {
    throw new Error("Unauthorized");
  }

  return {
    subject: identity.subject
  };
}

export async function getCurrentTeacherByClerkId(ctx: AuthCtx, clerkUserId: string) {
  return ctx.db
    .query("teachers")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
    .unique();
}

export async function getCurrentStudentByClerkId(ctx: AuthCtx, clerkUserId: string) {
  return ctx.db
    .query("students")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
    .unique();
}

export async function getCurrentPrincipal(ctx: AuthCtx) {
  const identity = await getAuthUserIdentity(ctx);

  const [teacher, student] = await Promise.all([
    getCurrentTeacherByClerkId(ctx, identity.subject),
    getCurrentStudentByClerkId(ctx, identity.subject)
  ]);

  const isAdmin = teacher?.userType === "Admin" || student?.userType === "Admin";

  return {
    identity,
    teacher,
    student,
    isAdmin
  };
}

export async function requireAdmin(ctx: AuthCtx) {
  const principal = await getCurrentPrincipal(ctx);

  if (!principal.isAdmin) {
    throw new Error("Forbidden: admin role required");
  }

  return principal;
}

export async function requireTeacherOrAdminPrincipal(ctx: AuthCtx) {
  const principal = await getCurrentPrincipal(ctx);

  if (!principal.teacher && !principal.isAdmin) {
    throw new Error("Forbidden: teacher or admin role required");
  }

  return principal;
}

export async function requireTeacherOrAdmin(ctx: AuthCtx, teacherId: Id<"teachers">) {
  const principal = await getCurrentPrincipal(ctx);
  const targetTeacher = await ctx.db.get(teacherId);

  if (!targetTeacher) {
    throw new Error("Teacher not found");
  }

  const isSelf = targetTeacher.clerkUserId === principal.identity.subject;

  if (!principal.isAdmin && !isSelf) {
    throw new Error("Forbidden: requires teacher ownership or admin role");
  }

  return {
    ...principal,
    targetTeacher,
    isSelf
  };
}

export async function requireStudentSelfOrAdmin(ctx: AuthCtx, studentId: Id<"students">) {
  const principal = await getCurrentPrincipal(ctx);
  const targetStudent = await ctx.db.get(studentId);

  if (!targetStudent) {
    throw new Error("Student not found");
  }

  const isSelf = targetStudent.clerkUserId === principal.identity.subject;

  if (!principal.isAdmin && !isSelf) {
    throw new Error("Forbidden: requires student ownership or admin role");
  }

  return {
    ...principal,
    targetStudent,
    isSelf
  };
}

export async function requireSessionTeacherOrAdmin(ctx: AuthCtx, classSessionId: Id<"classSessions">) {
  const principal = await getCurrentPrincipal(ctx);
  const session = await ctx.db.get(classSessionId);

  if (!session) {
    throw new Error("Class session not found");
  }

  const teacherId = principal.teacher?._id;
  const teachesSession = teacherId ? session.teacherIds.includes(teacherId) : false;

  if (!principal.isAdmin && !teachesSession) {
    throw new Error("Forbidden: teacher assigned to this session or admin role required");
  }

  return {
    ...principal,
    session,
    teachesSession
  };
}

// Backward-compatible alias used by existing student module.
export const requireStudentOrAdmin = requireStudentSelfOrAdmin;
