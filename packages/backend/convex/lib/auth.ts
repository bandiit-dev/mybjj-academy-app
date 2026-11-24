import { hasPaidPortalAccess, paidGymIds } from "./portalBilling";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

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

export async function getProfilesByClerkId(ctx: AuthCtx, clerkUserId: string) {
  const [teachers, students] = await Promise.all([
    ctx.db.query("teachers").withIndex("by_clerkUserId", q => q.eq("clerkUserId", clerkUserId)).collect(),
    ctx.db.query("students").withIndex("by_clerkUserId", q => q.eq("clerkUserId", clerkUserId)).collect(),
  ]);
  return { teachers, students };
}

export type AcademyRole = "admin" | "teacher" | "student";

export function academyMemberships({
  teachers,
  students,
}: Awaited<ReturnType<typeof getProfilesByClerkId>>) {
  const memberships = new Map<Id<"gyms">, {
    gymId: Id<"gyms">;
    role: AcademyRole;
    profile: Doc<"teachers"> | Doc<"students">;
    profileType: "teacher" | "student";
  }>();
  const profiles = [
    ...teachers.map(profile => ({ profile, profileType: "teacher" as const })),
    ...students.map(profile => ({ profile, profileType: "student" as const })),
  ];
  // Keep existing admin-first and teacher-first defaults for linked accounts.
  profiles.sort((a, b) => Number(b.profile.userType === "Admin") - Number(a.profile.userType === "Admin"));
  for (const { profile, profileType } of profiles) {
    const role = profile.userType === "Admin" ? "admin" : profileType;
    for (const gymId of profile.gymIds) {
      if (!memberships.has(gymId)) memberships.set(gymId, { gymId, profile, profileType, role });
    }
  }
  return memberships;
}

export function academySelection(ctx: AuthCtx, clerkUserId: string) {
  return ctx.db.query("academySelections")
    .withIndex("by_clerkUserId", q => q.eq("clerkUserId", clerkUserId))
    .unique();
}

export async function resolveAcademyMembership(ctx: AuthCtx, clerkUserId: string) {
  const profiles = await getProfilesByClerkId(ctx, clerkUserId);
  const memberships = academyMemberships(profiles);
  const choices = [...memberships.values()];
  let active = choices[0];
  if (choices.length > 1) {
    const saved = await academySelection(ctx, clerkUserId);
    const selected = saved && memberships.get(saved.gymId);
    if (selected) {
      active = selected;
    } else if (active?.role === "admin") {
      const admins = choices.filter(choice => choice.role === "admin");
      const accounts = await Promise.all(admins.map(({ gymId }) =>
        ctx.db.query("billingAccounts").withIndex("by_gymId", q => q.eq("gymId", gymId)).unique()
      ));
      const paid = accounts.findIndex(account => hasPaidPortalAccess(account));
      if (paid !== -1) active = admins[paid];
    }
  }
  return { ...profiles, memberships, active };
}

export async function getCurrentPrincipal(ctx: AuthCtx, options: {skipSubscription?: boolean} = {}) {
  const identity = await getAuthUserIdentity(ctx);
  const { teachers, students, active } = await resolveAcademyMembership(ctx, identity.subject);
  const teacher = active ? teachers.find(item => item._id === active.profile._id) : teachers[0];
  const student = active ? students.find(item => item._id === active.profile._id) : students[0];
  const isAdmin = active ? active.role === "admin" :
    teacher?.userType === "Admin" || student?.userType === "Admin";
  const gymIds = active ? [active.gymId] : [];
  if (isAdmin && !options.skipSubscription) await paidGymIds(ctx, gymIds);
  return {
    identity,
    isAdmin,
    teacher: teacher ? { ...teacher, gymIds } : null,
    student: student ? { ...student, gymIds } : null,
  };
}

export async function getAccessibleGymIds(ctx: AuthCtx) {
  const principal = await getCurrentPrincipal(ctx);
  const gymIds = new Set<Id<"gyms">>();
  principal.teacher?.gymIds.forEach((gymId) => gymIds.add(gymId));
  principal.student?.gymIds.forEach((gymId) => gymIds.add(gymId));

  if (gymIds.size === 0) {
    throw new Error("Forbidden: authenticated user is not linked to an academy");
  }

  return { principal, gymIds };
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

  if(principal.isAdmin && !targetTeacher.gymIds.some(id=>[...(principal.teacher?.gymIds??[]),...(principal.student?.gymIds??[])].includes(id))) {
    throw new Error("Forbidden: teacher belongs to another or unpaid academy");
  }
  const isSelf = targetTeacher._id === principal.teacher?._id;

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

  if(principal.isAdmin && !targetStudent.gymIds.some(id=>[...(principal.teacher?.gymIds??[]),...(principal.student?.gymIds??[])].includes(id))) {
    throw new Error("Forbidden: student belongs to another or unpaid academy");
  }
  const isSelf = targetStudent._id === principal.student?._id;

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

  if(!session.gymIds.some(id=>[...(principal.teacher?.gymIds??[]),...(principal.student?.gymIds??[])].includes(id))) {
    throw new Error("Forbidden: session belongs to another or unpaid academy");
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

export async function requireAcademyUnitAdmin(ctx: AuthCtx, gymId: Id<"gyms">, unityId: Id<"unities">) {
  const principal = await requireAdmin(ctx);
  const gymIds = new Set([...(principal.teacher?.gymIds ?? []), ...(principal.student?.gymIds ?? [])]);
  if (!gymIds.has(gymId)) throw new Error("Forbidden: academy access required");
  const unity = await ctx.db.get(unityId);
  if (!unity || unity.gymId !== gymId) throw new Error("The selected unit does not belong to this academy");
  return principal;
}

export function assertAdminGymScope(principal: Awaited<ReturnType<typeof requireAdmin>>, gymIds: Id<"gyms">[]) {
  const allowed = new Set([...(principal.teacher?.gymIds??[]),...(principal.student?.gymIds??[])]);
  if(!gymIds.length || gymIds.some(id=>!allowed.has(id))) throw new Error("Forbidden: paid academy access required");
}
