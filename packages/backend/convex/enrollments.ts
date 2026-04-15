import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  getCurrentPrincipal,
  getCurrentStudentByClerkId,
  requireSessionTeacherOrAdmin
} from "./lib/auth";
import { toIsoDate } from "./lib/validators";

const enrollmentStatusValidator = v.union(v.literal("Confirmed"), v.literal("Cancelled"));

function requireCurrentStudent(principal: Awaited<ReturnType<typeof getCurrentPrincipal>>) {
  if (!principal.student) {
    throw new Error("Forbidden: only students can manage their own enrollment");
  }

  if (principal.isAdmin) {
    throw new Error("Forbidden: admin enrollment changes are intentionally restricted");
  }

  return principal.student;
}

export const confirmEnrollment = mutation({
  args: {
    classSessionId: v.id("classSessions")
  },
  handler: async (ctx, { classSessionId }) => {
    const principal = await getCurrentPrincipal(ctx);
    const student = requireCurrentStudent(principal);

    const session = await ctx.db.get(classSessionId);
    if (!session) {
      throw new Error("Class session not found");
    }

    if (session.status === "Cancelled") {
      throw new Error("Cannot enroll in a cancelled session");
    }

    const existing = await ctx.db
      .query("enrollments")
      .withIndex("by_classSessionId_studentId", (q) =>
        q.eq("classSessionId", classSessionId).eq("studentId", student._id)
      )
      .unique();

    const now = Date.now();

    if (!existing) {
      const enrollmentId = await ctx.db.insert("enrollments", {
        classSessionId,
        studentId: student._id,
        status: "Confirmed",
        confirmedAt: now,
        createdAt: now,
        updatedAt: now
      });

      return { enrollmentId, status: "Confirmed" as const };
    }

    if (existing.status === "Confirmed") {
      return { enrollmentId: existing._id, status: "Confirmed" as const };
    }

    await ctx.db.patch(existing._id, {
      status: "Confirmed",
      confirmedAt: now,
      cancelledAt: undefined,
      updatedAt: now
    });

    return { enrollmentId: existing._id, status: "Confirmed" as const };
  }
});

export const cancelEnrollment = mutation({
  args: {
    classSessionId: v.id("classSessions")
  },
  handler: async (ctx, { classSessionId }) => {
    const principal = await getCurrentPrincipal(ctx);
    const student = requireCurrentStudent(principal);

    const existing = await ctx.db
      .query("enrollments")
      .withIndex("by_classSessionId_studentId", (q) =>
        q.eq("classSessionId", classSessionId).eq("studentId", student._id)
      )
      .unique();

    if (!existing) {
      return { enrollmentId: null, status: "Cancelled" as const };
    }

    const now = Date.now();

    await ctx.db.patch(existing._id, {
      status: "Cancelled",
      cancelledAt: now,
      updatedAt: now
    });

    return { enrollmentId: existing._id, status: "Cancelled" as const };
  }
});

export const getMyUpcomingEnrollments = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity?.subject) {
      throw new Error("Unauthorized");
    }

    const student = await getCurrentStudentByClerkId(ctx, identity.subject);
    if (!student) {
      return [];
    }

    const today = toIsoDate();

    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_studentId", (q) => q.eq("studentId", student._id))
      .collect();

    const confirmed = enrollments.filter((enrollment) => enrollment.status === "Confirmed");

    const sessions = await Promise.all(confirmed.map((enrollment) => ctx.db.get(enrollment.classSessionId)));

    return confirmed
      .map((enrollment, index) => ({ enrollment, session: sessions[index] }))
      .filter((item) => item.session !== null && item.session.status !== "Cancelled" && item.session.sessionDate >= today)
      .sort((a, b) => {
        const dateOrder = a.session!.sessionDate.localeCompare(b.session!.sessionDate);
        return dateOrder === 0 ? a.session!.startsAt - b.session!.startsAt : dateOrder;
      });
  }
});

export const getMyEnrollmentForSession = query({
  args: {
    classSessionId: v.id("classSessions")
  },
  handler: async (ctx, { classSessionId }) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity?.subject) {
      throw new Error("Unauthorized");
    }

    const student = await getCurrentStudentByClerkId(ctx, identity.subject);
    if (!student) {
      return null;
    }

    return ctx.db
      .query("enrollments")
      .withIndex("by_classSessionId_studentId", (q) =>
        q.eq("classSessionId", classSessionId).eq("studentId", student._id)
      )
      .unique();
  }
});

export const getSessionRoster = query({
  args: {
    classSessionId: v.id("classSessions"),
    status: v.optional(enrollmentStatusValidator)
  },
  handler: async (ctx, { classSessionId, status }) => {
    await requireSessionTeacherOrAdmin(ctx, classSessionId);

    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_classSessionId", (q) => q.eq("classSessionId", classSessionId))
      .collect();

    const filtered = status ? enrollments.filter((enrollment) => enrollment.status === status) : enrollments;

    const students = await Promise.all(filtered.map((enrollment) => ctx.db.get(enrollment.studentId)));

    return filtered.map((enrollment, index) => ({
      enrollment,
      student: students[index]
    }));
  }
});
