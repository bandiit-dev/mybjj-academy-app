import { assertAdminGymScope } from "./lib/auth";
import { academyStudentDueDay, academyToday, assertActiveStudentCapacity, currentPlanPeriod, getStudentPlan, monthlyPaymentDueDate, studentPlanValidator, validateStudentPlan, withStudentPlan } from "./lib/studentPlans";
import { mutation, query } from "./_generated/server";
import { assertDateOfBirth, assertDegree, beltValidator } from "./lib/validators";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import {
  getAccessibleGymIds,
  getCurrentPrincipal,
  requireAcademyUnitAdmin,
  requireAdmin,
  requireStudentOrAdmin
} from "./lib/auth";

const userTypeValidator = v.union(v.literal("Normal"), v.literal("Admin"));

export const createStudent = mutation({
  args: {
    plan: v.optional(studentPlanValidator),
    clerkUserId: v.string(),
    dateOfBirth: v.optional(v.string()),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    belt: beltValidator,
    degree: v.number(),
    gymIds: v.array(v.id("gyms")),
    unityIds: v.array(v.id("unities")),
    picture: v.string(),
    userType: userTypeValidator
  },
  handler: async (ctx, args) => {
    const principal = await getCurrentPrincipal(ctx);

    if (principal.isAdmin) assertAdminGymScope(principal, args.gymIds);

    // Policy choice: authenticated users can create only their own student profile.
    if (!principal.isAdmin && args.clerkUserId !== principal.identity.subject) {
      throw new Error("Forbidden: users can only create their own student profile");
    }

    if (!principal.isAdmin && args.plan) throw new Error("Forbidden: only an admin can choose a student plan");
    if (!principal.isAdmin && args.userType !== "Normal") {
      throw new Error("Forbidden: users cannot assign admin access");
    }
    if (!principal.isAdmin) {
      throw new Error("Forbidden: an academy administrator must register the student");
    }
    assertDateOfBirth(args.dateOfBirth);
    assertDegree(args.degree);

    const now = Date.now();
    const plan = validateStudentPlan(getStudentPlan(args));
    await assertActiveStudentCapacity(ctx, args.gymIds, plan);

    return ctx.db.insert("students", {
      ...args,
      plan,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateStudent = mutation({
  args: {
    studentId: v.id("students"),
    plan: v.optional(studentPlanValidator),
    clerkUserId: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    belt: v.optional(beltValidator),
    degree: v.optional(v.number()),
    gymIds: v.optional(v.array(v.id("gyms"))),
    unityIds: v.optional(v.array(v.id("unities"))),
    picture: v.optional(v.string()),
    userType: v.optional(userTypeValidator)
  },
  handler: async (ctx, { studentId, ...patch }) => {
    const authResult = await requireStudentOrAdmin(ctx, studentId);

    if (patch.plan && !authResult.isAdmin) throw new Error("Forbidden: only an admin can change a student plan");
    if (patch.plan) validateStudentPlan(patch.plan);
    assertDateOfBirth(patch.dateOfBirth);

    if (patch.degree !== undefined) {
      assertDegree(patch.degree);
    }

    if (!authResult.isAdmin) {
      const selfPatch: Record<string, unknown> = {};

      if (patch.name !== undefined) selfPatch.name = patch.name;
      if (patch.email !== undefined) selfPatch.email = patch.email;
      if (patch.phone !== undefined) selfPatch.phone = patch.phone;
      if (patch.picture !== undefined) selfPatch.picture = patch.picture;

      await ctx.db.patch(studentId, {
        ...selfPatch,
        updatedAt: Date.now()
      });

      return studentId;
    }

    if (patch.clerkUserId !== undefined && patch.clerkUserId !== authResult.targetStudent.clerkUserId) {
      throw new Error("Forbidden: use the invitation flow to link student accounts");
    }
    if (patch.gymIds) assertAdminGymScope(authResult, patch.gymIds);
    const adminGymIds = new Set([...(authResult.teacher?.gymIds ?? []), ...(authResult.student?.gymIds ?? [])]);
    if (!authResult.targetStudent.gymIds.every((gymId: Id<"gyms">) => adminGymIds.has(gymId))) {
      throw new Error("Forbidden: student belongs to another academy");
    }

    const plan = patch.plan ?? getStudentPlan(authResult.targetStudent);
    await assertActiveStudentCapacity(ctx, patch.gymIds ?? authResult.targetStudent.gymIds, plan, authResult.targetStudent);
    await ctx.db.patch(studentId, {
      ...patch,
      plan,
      updatedAt: Date.now()
    });

    return studentId;
  }
});

export const getStudentById = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const { gymIds, principal } = await getAccessibleGymIds(ctx);
    if (!principal.isAdmin && principal.student?._id !== studentId) return null;
    const student = await ctx.db.get(studentId);
    return student?.gymIds.some((gymId: Id<"gyms">) => gymIds.has(gymId)) ? withStudentPlan(student) : null;
  }
});

export const getAllStudents = query({
  args: { paymentStatusDay: v.optional(v.string()) },
  handler: async (ctx, { paymentStatusDay }) => {
    const principal = await requireAdmin(ctx);
    const gymId = principal.teacher?.gymIds[0] ?? principal.student?.gymIds[0];
    const today = academyToday();
    const [students, dueDay] = await Promise.all([
      ctx.db.query("students").collect(),
      paymentStatusDay ? academyStudentDueDay(ctx, gymId) : undefined,
    ]);
    const academyStudents = students.filter(student => gymId && student.gymIds.includes(gymId));
    return Promise.all(academyStudents.map(async student => {
      const plan = getStudentPlan(student, today);
      const result = { ...student, plan, paymentOverdue: false };
      if (!plan.isActive || plan.type !== "Mensal" || dueDay === undefined || today < plan.startDate) return result;
      const period = currentPlanPeriod(plan, today, dueDay);
      const dueDate = monthlyPaymentDueDate(period, dueDay, plan.startDate);
      if (!dueDate || today <= dueDate) return result;
      const payment = await ctx.db.query("studentPayments").withIndex("by_period", q => q
        .eq("studentId", student._id).eq("planType", period.planType)
        .eq("periodStart", period.periodStart).eq("periodEnd", period.periodEnd)).unique();
      return { ...result, paymentOverdue: !payment?.paid };
    }));
  }
});

export const getCurrentStudent = query({
  args: {},
  handler: async (ctx) => {
    return withStudentPlan((await getCurrentPrincipal(ctx, { skipSubscription: true })).student);
  }
});

// Academy records without credentials, including children who do not use the app.
export const createStudentWithoutAccount = mutation({
  args: {
    plan: v.optional(studentPlanValidator),
    name: v.string(), email: v.optional(v.string()), phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()), belt: beltValidator, degree: v.number(),
    gymId: v.id("gyms"), unityId: v.id("unities"), picture: v.string()
  },
  handler: async (ctx, args) => {
    await requireAcademyUnitAdmin(ctx, args.gymId, args.unityId);
    assertDegree(args.degree);
    assertDateOfBirth(args.dateOfBirth);
    if (!args.name.trim()) throw new Error("Student name is required");
    const now = Date.now();
    const plan = validateStudentPlan(getStudentPlan(args));
    await assertActiveStudentCapacity(ctx, [args.gymId], plan);
    return ctx.db.insert("students", {
      plan,
      name: args.name.trim(), email: (args.email ?? "").trim().toLowerCase(),
      phone: (args.phone ?? "").trim(), dateOfBirth: args.dateOfBirth,
      belt: args.belt, degree: args.degree, gymIds: [args.gymId], unityIds: [args.unityId],
      picture: args.picture.trim(), userType: "Normal", createdAt: now, updatedAt: now
    });
  }
});
