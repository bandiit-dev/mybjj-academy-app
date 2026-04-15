export type AuthIdentity = {
  subject: string;
};

type ConvexContext = {
  auth: {
    getUserIdentity: () => Promise<AuthIdentity | null>;
  };
  db: {
    query: (table: string) => {
      withIndex: (index: string, fn: (q: any) => any) => { unique: () => Promise<any> };
    };
    get: (id: string) => Promise<any>;
  };
};

export async function getAuthUserIdentity(ctx: ConvexContext): Promise<AuthIdentity> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity?.subject) {
    throw new Error("Unauthorized");
  }

  return identity;
}

export async function getCurrentTeacherByClerkId(ctx: ConvexContext, clerkUserId: string) {
  return ctx.db
    .query("teachers")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
    .unique();
}

export async function getCurrentStudentByClerkId(ctx: ConvexContext, clerkUserId: string) {
  return ctx.db
    .query("students")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
    .unique();
}

export async function getCurrentPrincipal(ctx: ConvexContext) {
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

export async function requireAdmin(ctx: ConvexContext) {
  const principal = await getCurrentPrincipal(ctx);

  if (!principal.isAdmin) {
    throw new Error("Forbidden: admin role required");
  }

  return principal;
}

export async function requireTeacherOrAdmin(ctx: ConvexContext, teacherId: string) {
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

export async function requireStudentOrAdmin(ctx: ConvexContext, studentId: string) {
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
