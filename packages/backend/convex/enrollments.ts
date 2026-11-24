import type { Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";

import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  getAccessibleGymIds,
  getCurrentPrincipal,
  requireSessionTeacherOrAdmin
} from "./lib/auth";
import { addPlanMonths } from "./lib/studentPlans";
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

export async function confirmStudentEnrollment(
  ctx: MutationCtx,
  classSessionId: Id<"classSessions">,
  studentId: Id<"students">,
) {
  const existing = await ctx.db
    .query("enrollments")
    .withIndex("by_classSessionId_studentId", (q) =>
      q.eq("classSessionId", classSessionId).eq("studentId", studentId)
    )
    .unique();
  const now = Date.now();

  if (!existing) {
    const enrollmentId = await ctx.db.insert("enrollments", {
      classSessionId,
      studentId,
      status: "Confirmed",
      confirmedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return { enrollmentId, status: "Confirmed" as const };
  }

  if (existing.status !== "Confirmed") {
    await ctx.db.patch(existing._id, {
      status: "Confirmed",
      confirmedAt: now,
      cancelledAt: undefined,
      updatedAt: now,
    });
  }
  return { enrollmentId: existing._id, status: "Confirmed" as const };
}

export const confirmEnrollment = mutation({
  args: { classSessionId: v.id("classSessions") },
  handler: async (ctx, { classSessionId }) => {
    const student = requireCurrentStudent(await getCurrentPrincipal(ctx));
    const session = await ctx.db.get(classSessionId);

    if (!session || !session.gymIds.some(gymId => student.gymIds.includes(gymId))) {
      throw new Error("Class session not found");
    }
    if (session.status === "Cancelled") {
      throw new Error("Cannot enroll in a cancelled session");
    }

    return confirmStudentEnrollment(ctx, classSessionId, student._id);
  },
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

    const session = await ctx.db.get(classSessionId);
    if (!existing || !session?.gymIds.some(gymId => student.gymIds.includes(gymId))) {
      return { enrollmentId: null, status: "Cancelled" as const };
    }

    if (existing.status === "Cancelled") {
      return { enrollmentId: existing._id, status: "Cancelled" as const };
    }

    const attendance = await ctx.db
      .query("attendance")
      .withIndex("by_classSessionId_studentId", (q) =>
        q.eq("classSessionId", classSessionId).eq("studentId", student._id)
      )
      .unique();

    if (attendance) {
      throw new ConvexError("A frequência desta aula já foi registrada pelo professor.");
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
    const { student } = await getCurrentPrincipal(ctx, { skipSubscription: true });
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
      .filter((item) => item.session !== null && item.session.gymIds.some(gymId => student.gymIds.includes(gymId)) && item.session.status !== "Cancelled" && item.session.sessionDate >= today)
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
    const { student } = await getCurrentPrincipal(ctx, { skipSubscription: true });
    if (!student) {
      return null;
    }

    const session = await ctx.db.get(classSessionId);
    if (!session?.gymIds.some(gymId => student.gymIds.includes(gymId))) return null;
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

export const getMonthlyPresence = query({
  args: { month: v.string() },
  handler: async (ctx, {month}) => {
    const {principal, gymIds} = await getAccessibleGymIds(ctx);
    if (!principal.isAdmin) throw new Error("Forbidden: admin role required");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid month. Expected YYYY-MM.");
    const start = `${month}-01`;
    const end = addPlanMonths(start, 1);
    const sessions = (await ctx.db.query("classSessions")
      .withIndex("by_sessionDate", q=>q.gte("sessionDate",start).lt("sessionDate",end)).collect())
      .filter(session=>session.status!=="Cancelled" && session.gymIds.some(id=>gymIds.has(id)));
    const groups = await Promise.all(sessions.map(async session=>({session,
      enrollments: await ctx.db.query("enrollments").withIndex("by_classSessionId", q=>q.eq("classSessionId",session._id)).collect()
    })));
    const studentIds = [...new Set(groups.flatMap(group=>group.enrollments.filter(enrollment=>enrollment.status==="Confirmed").map(enrollment=>enrollment.studentId)))];
    const students = new Map(await Promise.all(studentIds.map(async id=>[id,await ctx.db.get(id)] as const)));
    const enrolledStudents = new Set<string>();
    let totalEnrollments = 0;
    for (const {session, enrollments} of groups) {
      const counted = new Set<string>();
      for (const enrollment of enrollments) {
        if (enrollment.status!=="Confirmed" || counted.has(enrollment.studentId)) continue;
        const student = students.get(enrollment.studentId);
        if (!student || !session.gymIds.some(id=>gymIds.has(id)&&student.gymIds.includes(id))) continue;
        counted.add(enrollment.studentId);
        enrolledStudents.add(enrollment.studentId);
        totalEnrollments++;
      }
    }
    return {month, totalEnrollments, studentCount: enrolledStudents.size};
  }
});
