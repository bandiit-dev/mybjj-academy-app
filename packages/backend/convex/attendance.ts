import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { classTitle } from "./classes";
import {
  requireSessionTeacherOrAdmin,
  requireStudentSelfOrAdmin,
} from "./lib/auth";
import { academyToday } from "./lib/studentPlans";

const attendanceStatusValidator = v.union(
  v.literal("Present"),
  v.literal("Absent"),
);

export function isStudentPresent(
  attendance: Doc<"attendance">["status"] | undefined,
  enrollment: Doc<"enrollments">["status"] | undefined,
) {
  return attendance ? attendance === "Present" : enrollment === "Confirmed";
}

export const getStudentAttendanceHistory = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const { isAdmin, teacher, student, targetStudent } =
      await requireStudentSelfOrAdmin(ctx, studentId);
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const adminGyms = new Set([
      ...(teacher?.gymIds ?? []),
      ...(student?.gymIds ?? []),
    ]);
    const sharedGyms = new Set(
      targetStudent.gymIds.filter((id) => adminGyms.has(id)),
    );
    const today = academyToday();
    const [attendance, enrollments] = await Promise.all([
      ctx.db
        .query("attendance")
        .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
        .collect(),
      ctx.db
        .query("enrollments")
        .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
        .collect(),
    ]);
    const attendanceBySession = new Map(
      attendance.map((row) => [row.classSessionId, row.status]),
    );
    const sessionsPresent = new Set<Id<"classSessions">>(
      [...attendanceBySession]
        .filter(([, status]) => status === "Present")
        .map(([sessionId]) => sessionId),
    );
    for (const enrollment of enrollments) {
      if (
        isStudentPresent(
          attendanceBySession.get(enrollment.classSessionId),
          enrollment.status,
        )
      ) {
        sessionsPresent.add(enrollment.classSessionId);
      }
    }

    const sessions = (
      await Promise.all([...sessionsPresent].map((id) => ctx.db.get(id)))
    )
      .filter(
        (session): session is Doc<"classSessions"> =>
          session !== null &&
          session.status !== "Cancelled" &&
          session.sessionDate <= today &&
          session.gymIds.some((id) => sharedGyms.has(id)),
      )
      .sort(
        (a, b) =>
          b.sessionDate.localeCompare(a.sessionDate) || b.startsAt - a.startsAt,
      );
    const [templates, units] = await Promise.all([
      Promise.all(
        [...new Set(sessions.map((session) => session.classId))].map(
          async (id) => [id, await ctx.db.get(id)] as const,
        ),
      ),
      Promise.all(
        [...new Set(sessions.flatMap((session) => session.unityIds))].map(
          async (id) => [id, await ctx.db.get(id)] as const,
        ),
      ),
    ]);
    const templateById = new Map(templates);
    const unitById = new Map(units);
    const classes = sessions.map((session) => {
      const template = templateById.get(session.classId);
      return {
        sessionId: session._id,
        date: session.sessionDate,
        startsAt: session.startsAt,
        title: classTitle(
          template?.gymIds.some((id) => sharedGyms.has(id))
            ? template
            : undefined,
        ),
        units: session.unityIds.flatMap((id) => {
          const unit = unitById.get(id);
          return unit?.gymId && sharedGyms.has(unit.gymId)
            ? [unit.name || unit.address]
            : [];
        }),
      };
    });
    return { total: classes.length, classes };
  },
});

async function upsertAttendance(
  ctx: MutationCtx,
  args: {
    classSessionId: Id<"classSessions">;
    studentId: Id<"students">;
    status: "Present" | "Absent";
    markedByTeacherId?: Id<"teachers">;
  }
) {
  const authResult = await requireSessionTeacherOrAdmin(ctx, args.classSessionId);

  const markerTeacherId =
    authResult.teacher?._id ?? args.markedByTeacherId ?? authResult.session.teacherIds[0];

  if (!markerTeacherId) {
    throw new Error("markedByTeacherId is required when admin marks attendance for a session without teachers");
  }

  const student = await ctx.db.get(args.studentId);
  const academyIds = new Set([
    ...(authResult.teacher?.gymIds ?? []),
    ...(authResult.isAdmin ? (authResult.student?.gymIds ?? []) : []),
  ]);
  if (
    !student?.gymIds.some(
      (id) => academyIds.has(id) && authResult.session.gymIds.includes(id),
    )
  ) {
    throw new Error(
      "Forbidden: student does not belong to this session's academy",
    );
  }

  return writeAttendance(ctx, { ...args, markedByTeacherId: markerTeacherId });
}

export async function writeAttendance(
  ctx: MutationCtx,
  args: Pick<
    Doc<"attendance">,
    "classSessionId" | "studentId" | "status" | "markedByTeacherId"
  >,
) {
  const now = Date.now();

  const existing = await ctx.db
    .query("attendance")
    .withIndex("by_classSessionId_studentId", (q) =>
      q.eq("classSessionId", args.classSessionId).eq("studentId", args.studentId)
    )
    .unique();

  if (!existing) {
    return ctx.db.insert("attendance", {
      classSessionId: args.classSessionId,
      studentId: args.studentId,
      status: args.status,
      markedByTeacherId: args.markedByTeacherId,
      markedAt: now,
      createdAt: now,
      updatedAt: now
    });
  }

  await ctx.db.patch(existing._id, {
    status: args.status,
    markedByTeacherId: args.markedByTeacherId,
    markedAt: now,
    updatedAt: now
  });

  return existing._id;
}

export const markAttendance = mutation({
  args: {
    classSessionId: v.id("classSessions"),
    studentId: v.id("students"),
    status: attendanceStatusValidator,
    markedByTeacherId: v.optional(v.id("teachers"))
  },
  handler: async (ctx, { classSessionId, studentId, status, markedByTeacherId }) => {
    return upsertAttendance(ctx, {
      classSessionId,
      studentId,
      status,
      markedByTeacherId
    });
  }
});

export const updateAttendanceStatus = mutation({
  args: {
    classSessionId: v.id("classSessions"),
    studentId: v.id("students"),
    status: attendanceStatusValidator,
    markedByTeacherId: v.optional(v.id("teachers"))
  },
  handler: async (ctx, { classSessionId, studentId, status, markedByTeacherId }) => {
    return upsertAttendance(ctx, {
      classSessionId,
      studentId,
      status,
      markedByTeacherId
    });
  }
});

export const unmarkAttendance = mutation({
  args: {
    classSessionId: v.id("classSessions"),
    studentId: v.id("students")
  },
  handler: async (ctx, { classSessionId, studentId }) => {
    await requireSessionTeacherOrAdmin(ctx, classSessionId);

    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_classSessionId_studentId", (q) =>
        q.eq("classSessionId", classSessionId).eq("studentId", studentId)
      )
      .unique();

    if (!existing) {
      return null;
    }

    await ctx.db.delete(existing._id);

    return existing._id;
  }
});

export const getSessionAttendance = query({
  args: {
    classSessionId: v.id("classSessions")
  },
  handler: async (ctx, { classSessionId }) => {
    await requireSessionTeacherOrAdmin(ctx, classSessionId);

    const attendance = await ctx.db
      .query("attendance")
      .withIndex("by_classSessionId", (q) => q.eq("classSessionId", classSessionId))
      .collect();

    const students = await Promise.all(attendance.map((item) => ctx.db.get(item.studentId)));

    return attendance.map((item, index) => ({
      attendance: item,
      student: students[index]
    }));
  }
});
