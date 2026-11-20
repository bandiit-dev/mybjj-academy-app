import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  academyToday, assertActiveStudentCapacity, assertPlanDate, getStudentPlan, isPlanPeriod, paymentKey,
  planTypeValidator, requireStudentPlanAdmin, scheduledPlanPeriods
} from "./lib/studentPlans";

export const getStudentBilling = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, {studentId}) => {
    const {student} = await requireStudentPlanAdmin(ctx, studentId);
    const plan = getStudentPlan(student);
    const records = await ctx.db.query("studentPayments").withIndex("by_studentId", q => q.eq("studentId", studentId)).collect();
    const periods = new Map(scheduledPlanPeriods(plan).map(period => [paymentKey(period), {
      ...period, paid: false, paidOn: "", notes: "", recordedBy: "", updatedAt: 0
    }]));
    for (const record of records) periods.set(paymentKey(record), {
      planType: record.planType, periodStart: record.periodStart, periodEnd: record.periodEnd,
      paid: record.paid, paidOn: record.paidOn ?? "", notes: record.notes,
      recordedBy: record.recordedBy, updatedAt: record.updatedAt
    });
    return {
      student: {...student, plan},
      periods: [...periods.values()].sort((a,b) => b.periodStart.localeCompare(a.periodStart) || a.planType.localeCompare(b.planType)),
      today: academyToday()
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
