import { assertAdminGymScope } from "./lib/auth";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  getAuthUserIdentity,
  getAccessibleGymIds,
  getCurrentPrincipal,
  requireSessionTeacherOrAdmin,
  requireTeacherOrAdminPrincipal
} from "./lib/auth";
import { assertSessionDate, assertTimeRange, toIsoDate } from "./lib/validators";

const classSessionStatusValidator = v.union(
  v.literal("Scheduled"),
  v.literal("Cancelled"),
  v.literal("Completed")
);

function includeSessionDate(sessionDate: string, fromDate: string): boolean {
  return sessionDate >= fromDate;
}

async function assertTeacherCanCreateSession(
  principal: Awaited<ReturnType<typeof getCurrentPrincipal>>,
  teacherIds: Id<"teachers">[]
) {
  if (principal.isAdmin) {
    return;
  }

  if (!principal.teacher) {
    throw new Error("Forbidden: teacher or admin role required");
  }

  if (!teacherIds.includes(principal.teacher._id)) {
    throw new Error("Forbidden: teacher must be assigned to the session");
  }
}

export const createClassSession = mutation({
  args: {
    classId: v.id("classes"),
    sessionDate: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    teacherIds: v.optional(v.array(v.id("teachers"))),
    gymIds: v.optional(v.array(v.id("gyms"))),
    unityIds: v.optional(v.array(v.id("unities"))),
    status: v.optional(classSessionStatusValidator),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const principal = await requireTeacherOrAdminPrincipal(ctx);
    assertSessionDate(args.sessionDate);
    assertTimeRange(args.startsAt, args.endsAt);

    const classTemplate = await ctx.db.get(args.classId);
    if (!classTemplate) {
      throw new Error("Class not found");
    }

    const teacherIds = args.teacherIds ?? classTemplate.teacherIds;
    const gymIds = args.gymIds ?? classTemplate.gymIds;
    const unityIds = args.unityIds ?? classTemplate.unityIds;

    if (principal.isAdmin) {
      assertAdminGymScope(principal, classTemplate.gymIds);
      assertAdminGymScope(principal, gymIds);
    }
    await assertTeacherCanCreateSession(principal, teacherIds);

    const now = Date.now();

    return ctx.db.insert("classSessions", {
      classId: args.classId,
      sessionDate: args.sessionDate,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      teacherIds,
      gymIds,
      unityIds,
      status: args.status ?? "Scheduled",
      notes: args.notes,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateClassSession = mutation({
  args: {
    classSessionId: v.id("classSessions"),
    sessionDate: v.optional(v.string()),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    teacherIds: v.optional(v.array(v.id("teachers"))),
    gymIds: v.optional(v.array(v.id("gyms"))),
    unityIds: v.optional(v.array(v.id("unities"))),
    status: v.optional(classSessionStatusValidator),
    notes: v.optional(v.string())
  },
  handler: async (ctx, { classSessionId, ...patch }) => {
    const principal = await requireSessionTeacherOrAdmin(ctx, classSessionId);
    const {session} = principal;
    if (principal.isAdmin && patch.gymIds) assertAdminGymScope(principal, patch.gymIds);

    if (patch.sessionDate) {
      assertSessionDate(patch.sessionDate);
    }

    const startsAt = patch.startsAt ?? session.startsAt;
    const endsAt = patch.endsAt ?? session.endsAt;
    assertTimeRange(startsAt, endsAt);

    await ctx.db.patch(classSessionId, {
      ...patch,
      updatedAt: Date.now()
    });

    return classSessionId;
  }
});

export const cancelClassSession = mutation({
  args: {
    classSessionId: v.id("classSessions"),
    notes: v.optional(v.string())
  },
  handler: async (ctx, { classSessionId, notes }) => {
    await requireSessionTeacherOrAdmin(ctx, classSessionId);

    await ctx.db.patch(classSessionId, {
      status: "Cancelled",
      notes,
      updatedAt: Date.now()
    });

    return classSessionId;
  }
});

export const completeClassSession = mutation({
  args: { classSessionId: v.id("classSessions") },
  handler: async (ctx, { classSessionId }) => {
    await requireSessionTeacherOrAdmin(ctx, classSessionId);

    await ctx.db.patch(classSessionId, {
      status: "Completed",
      updatedAt: Date.now()
    });

    return classSessionId;
  }
});

export const getClassSessionById = query({
  args: { classSessionId: v.id("classSessions") },
  handler: async (ctx, { classSessionId }) => {
    const {gymIds} = await getAccessibleGymIds(ctx);
    const session = await ctx.db.get(classSessionId);
    return session?.gymIds.some(id => gymIds.has(id)) ? session : null;
  }
});

export const getUpcomingClassSessions = query({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, { limit }) => {
    const { gymIds } = await getAccessibleGymIds(ctx);

    const today = toIsoDate();
    const scheduled = await ctx.db
      .query("classSessions")
      .withIndex("by_status", (q) => q.eq("status", "Scheduled"))
      .collect();

    return scheduled
      .filter((session) => includeSessionDate(session.sessionDate, today) && session.gymIds.some((gymId) => gymIds.has(gymId)))
      .sort((a, b) => (a.sessionDate === b.sessionDate ? a.startsAt - b.startsAt : a.sessionDate.localeCompare(b.sessionDate)))
      .slice(0, limit ?? 50);
  }
});

export const getSessionsByDate = query({
  args: {
    sessionDate: v.string(),
    status: v.optional(classSessionStatusValidator)
  },
  handler: async (ctx, { sessionDate, status }) => {
    const { gymIds } = await getAccessibleGymIds(ctx);
    assertSessionDate(sessionDate);

    if (status) {
      const sessions = await ctx.db
        .query("classSessions")
        .withIndex("by_sessionDate_status", (q) => q.eq("sessionDate", sessionDate).eq("status", status))
        .collect();
      return sessions.filter((session) => session.gymIds.some((gymId) => gymIds.has(gymId)));
    }

    const sessions = await ctx.db
      .query("classSessions")
      .withIndex("by_sessionDate", (q) => q.eq("sessionDate", sessionDate))
      .collect();
    return sessions.filter((session) => session.gymIds.some((gymId) => gymIds.has(gymId)));
  }
});

export const getTeacherUpcomingSessions = query({
  args: {
    teacherId: v.optional(v.id("teachers")),
    limit: v.optional(v.number())
  },
  handler: async (ctx, { teacherId, limit }) => {
    const principal = await requireTeacherOrAdminPrincipal(ctx);

    const targetTeacherId = principal.isAdmin ? teacherId : principal.teacher?._id;

    if (!targetTeacherId) {
      throw new Error("Teacher not resolved for query");
    }

    const today = toIsoDate();

    const scheduled = await ctx.db
      .query("classSessions")
      .withIndex("by_status", (q) => q.eq("status", "Scheduled"))
      .collect();

    return scheduled
      .filter(
        (session) => session.teacherIds.includes(targetTeacherId) && includeSessionDate(session.sessionDate, today)
      )
      .sort((a, b) => (a.sessionDate === b.sessionDate ? a.startsAt - b.startsAt : a.sessionDate.localeCompare(b.sessionDate)))
      .slice(0, limit ?? 50);
  }
});

export const getClassSessionDetail = query({
  args: {
    classSessionId: v.id("classSessions")
  },
  handler: async (ctx, { classSessionId }) => {
    const principal = await getCurrentPrincipal(ctx);

    const session = await ctx.db.get(classSessionId);
    if (!session) {
      return null;
    }

    const allowed = new Set([...(principal.teacher?.gymIds ?? []), ...(principal.student?.gymIds ?? [])]);
    if (!session.gymIds.some(id => allowed.has(id))) throw new Error("Forbidden: academy access required");
    const classTemplate = await ctx.db.get(session.classId);

    const [teachers, gyms, unities, enrollments, attendanceRows] = await Promise.all([
      Promise.all(session.teacherIds.map((id) => ctx.db.get(id))),
      Promise.all(session.gymIds.map((id) => ctx.db.get(id))),
      Promise.all(session.unityIds.map((id) => ctx.db.get(id))),
      ctx.db
        .query("enrollments")
        .withIndex("by_classSessionId", (q) => q.eq("classSessionId", classSessionId))
        .collect(),
      ctx.db
        .query("attendance")
        .withIndex("by_classSessionId", (q) => q.eq("classSessionId", classSessionId))
        .collect()
    ]);

    const students = await Promise.all(enrollments.map((enrollment) => ctx.db.get(enrollment.studentId)));
    const attendanceByStudentId = new Map(attendanceRows.map((row) => [row.studentId, row]));

    const roster = enrollments.map((enrollment, index) => {
      const student = students[index];
      const attendance = attendanceByStudentId.get(enrollment.studentId) ?? null;

      return {
        enrollment,
        student,
        attendance
      };
    });

    const currentStudentId = principal.student?._id;

    return {
      session,
      classTemplate,
      teachers: teachers.filter((teacher) => teacher !== null),
      gyms: gyms.filter((gym) => gym !== null),
      unities: unities.filter((unity) => unity !== null),
      enrolledStudents: roster,
      currentUserEnrollment:
        currentStudentId === undefined
          ? null
          : enrollments.find((enrollment) => enrollment.studentId === currentStudentId) ?? null
    };
  }
});
