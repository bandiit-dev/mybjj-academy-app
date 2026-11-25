import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import {
  academyToday, academyStudentDueDay, assertActiveStudentCapacity, assertPlanDate, currentPlanPeriod, getStudentPlan, isPlanPeriod, monthlyPaymentDueDate, paymentKey,
  planTypeValidator, requireStudentPlanAdmin, scheduledPlanPeriods
} from "./lib/studentPlans";

export const getAcademyPaymentOverview = query({
  args: { refreshDay: v.string() },
  handler: async (ctx) => {
    const principal = await requireAdmin(ctx);
    const gymId = principal.teacher?.gymIds[0] ?? principal.student?.gymIds[0];
    if (!gymId) throw new Error("Academia não encontrada.");

    const today = academyToday();
    const [students, units, dueDay] = await Promise.all([
      ctx.db.query("students").collect(),
      ctx.db.query("unities").withIndex("by_gymId", q => q.eq("gymId", gymId)).collect(),
      academyStudentDueDay(ctx, gymId),
    ]);
    const academyUnits = units.map(unit => ({ id: unit._id, name: unit.name || unit.address }));
    const unitIds = new Set(academyUnits.map(unit => unit.id));
    const academyStudents = students.filter(student => student.gymIds.includes(gymId));
    const rows = await Promise.all(academyStudents.map(async student => {
      const plan = getStudentPlan(student, today);
      const profile = {
        id: student._id,
        name: student.name,
        unitIds: student.unityIds.filter(id => unitIds.has(id)),
        planType: plan.type,
      };
      if (plan.startDate > today) {
        return {
          ...profile,
          status: plan.isActive ? "upcoming" as const : "inactive" as const,
          period: null,
          dueDate: null,
          paidOn: null,
          reminder: null,
        };
      }

      const period = currentPlanPeriod(plan, today, dueDay);
      const dueDate = monthlyPaymentDueDate(period, dueDay, plan.startDate);
      const [payment, reminder] = await Promise.all([
        ctx.db.query("studentPayments").withIndex("by_period", q => q
          .eq("studentId", student._id)
          .eq("planType", period.planType)
          .eq("periodStart", period.periodStart)
          .eq("periodEnd", period.periodEnd)).unique(),
        plan.type === "Mensal"
          ? ctx.db.query("monthlyPaymentReminders").withIndex("by_student_gym_month", q => q
            .eq("studentId", student._id)
            .eq("gymId", gymId)
            .eq("month", today.slice(0, 7))).unique()
          : null,
      ]);
      const status = !plan.isActive ? "inactive" as const
        : payment?.paid ? "paid" as const
        : dueDate && today > dueDate ? "overdue" as const
        : "pending" as const;
      return {
        ...profile,
        status,
        period,
        dueDate,
        paidOn: payment?.paid ? payment.paidOn ?? null : null,
        reminder: reminder ? {
          status: reminder.sentAt !== undefined ? "sent" as const
            : reminder.failedAt !== undefined ? "failed" as const
            : "processing" as const,
          at: reminder.sentAt ?? reminder.failedAt ?? null,
        } : null,
      };
    }));
    return { today, rows, units: academyUnits };
  },
});

export const getStudentBilling = query({
  args: { studentId: v.id("students"), refreshDay: v.optional(v.string()) },
  handler: async (ctx, {studentId}) => {
    const {student, principal} = await requireStudentPlanAdmin(ctx, studentId);
    const today = academyToday();
    const plan = getStudentPlan(student, today);
    const [records, dueDay] = await Promise.all([
      ctx.db.query("studentPayments").withIndex("by_studentId", q => q.eq("studentId", studentId)).collect(),
      academyStudentDueDay(ctx, principal.teacher?.gymIds[0] ?? principal.student?.gymIds[0]),
    ]);
    const periods = new Map(scheduledPlanPeriods(plan, today).map(period => [paymentKey(period), {
      ...period, paid: false, paidOn: "", notes: "", recordedBy: "", updatedAt: 0
    }]));
    for (const record of records) periods.set(paymentKey(record), {
      planType: record.planType, periodStart: record.periodStart, periodEnd: record.periodEnd,
      paid: record.paid, paidOn: record.paidOn ?? "", notes: record.notes,
      recordedBy: record.recordedBy, updatedAt: record.updatedAt
    });
    return {
      student: {...student, plan},
      periods: [...periods.values()].map(period => ({
        ...period,
        dueDate: monthlyPaymentDueDate(period, dueDay, plan.startDate),
      })).sort((a,b) => b.periodStart.localeCompare(a.periodStart) || a.planType.localeCompare(b.planType)),
      today
    };
  }
});

export const setPlanActive = mutation({
  args: {studentId: v.id("students"), isActive: v.boolean()},
  handler: async (ctx, {studentId, isActive}) => {
    const {student} = await requireStudentPlanAdmin(ctx, studentId);
    const plan = {...getStudentPlan(student), isActive};
    await assertActiveStudentCapacity(ctx, student.gymIds, plan, student);
    await ctx.db.patch(studentId, {plan, updatedAt: Date.now()});
    return studentId;
  }
});

export const setPayment = mutation({
  args: {
    studentId: v.id("students"), planType: planTypeValidator,
    periodStart: v.string(), periodEnd: v.string(), paid: v.boolean(),
    paidOn: v.optional(v.string()), notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const {student, principal} = await requireStudentPlanAdmin(ctx, args.studentId);
    assertPlanDate(args.periodStart); assertPlanDate(args.periodEnd);
    const existing = await ctx.db.query("studentPayments").withIndex("by_period", q => q
      .eq("studentId", args.studentId).eq("planType", args.planType)
      .eq("periodStart", args.periodStart).eq("periodEnd", args.periodEnd)).unique();
    const plan = getStudentPlan(student);
    if (!existing && (plan.type !== args.planType || !isPlanPeriod(plan, args.periodStart, args.periodEnd))) {
      throw new Error("O plano foi alterado. Atualize a página antes de registrar o pagamento.");
    }
    const paidOn = args.paid ? (args.paidOn || academyToday()) : undefined;
    if (paidOn) {
      assertPlanDate(paidOn);
      if (paidOn > academyToday()) throw new Error("A data do pagamento não pode estar no futuro.");
    }
    const notes = (args.notes ?? "").trim();
    if (notes.length > 2000) throw new Error("A observação deve ter até 2000 caracteres.");
    const now = Date.now();
    const record = {
      studentId: args.studentId, planType: args.planType, periodStart: args.periodStart, periodEnd: args.periodEnd,
      paid: args.paid, paidOn, notes, recordedBy: principal.identity.subject, updatedAt: now
    };
    // Payment records never change activation; the academy manager controls it.
    if (existing) { await ctx.db.patch(existing._id, record); return existing._id; }
    return ctx.db.insert("studentPayments", {...record, createdAt: now});
  }
});

// Run once after deploying this feature. Does not invent historical payments.
export const initializeExistingPlans = internalMutation({
  args: {},
  handler: async ctx => {
    const students = await ctx.db.query("students").collect();
    let updated = 0;
    for (const student of students) {
      if (student.plan) continue;
      await ctx.db.patch(student._id, {plan: getStudentPlan(student), updatedAt: Date.now()});
      updated++;
    }
    return {updated};
  }
});
