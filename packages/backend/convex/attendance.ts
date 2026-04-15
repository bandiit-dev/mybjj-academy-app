import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireSessionTeacherOrAdmin } from "./lib/auth";

const attendanceStatusValidator = v.union(v.literal("Present"), v.literal("Absent"));

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
      markedByTeacherId: markerTeacherId,
      markedAt: now,
      createdAt: now,
      updatedAt: now
    });
  }

  await ctx.db.patch(existing._id, {
    status: args.status,
    markedByTeacherId: markerTeacherId,
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
