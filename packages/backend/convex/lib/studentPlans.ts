import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireAdmin } from "./auth";
import { PORTAL_PLANS, TRIAL_STUDENT_LIMIT } from "./portalBilling";

export const PLAN_MONTHS = { Mensal: 1, Semestral: 6, Anual: 12 } as const;
export type PlanType = keyof typeof PLAN_MONTHS;
export const planTypeValidator = v.union(v.literal("Mensal"), v.literal("Semestral"), v.literal("Anual"));
export const studentPlanValidator = v.object({ type: planTypeValidator, startDate: v.string(), isActive: v.boolean() });
export type StudentPlan = Infer<typeof studentPlanValidator>;

// Academy dates use Brasília time. Billing periods are date-only, never timestamps.
export function academyToday(now = Date.now()) {
  return new Date(now - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function assertPlanDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value || value < "1900-01-01" || value > "2199-12-31") {
    throw new Error("Informe uma data válida para o plano ou pagamento.");
  }
}

export function validateStudentPlan(plan: StudentPlan) {
  assertPlanDate(plan.startDate);
  return plan;
}

export function getStudentPlan(student: { plan?: StudentPlan }, today = academyToday()): StudentPlan {
  return student.plan ?? { type: "Mensal", startDate: `${today.slice(0, 7)}-01`, isActive: true };
}

export async function assertActiveStudentCapacity(
  ctx: QueryCtx | MutationCtx,
  gymIds: Id<"gyms">[],
  plan: StudentPlan,
  previous?: Pick<Doc<"students">, "gymIds" | "plan">,
) {
  if (!plan.isActive) return;
  const previousGyms = previous && getStudentPlan(previous).isActive ? previous.gymIds : [];
  const addedGyms = [...new Set(gymIds)].filter(gymId => !previousGyms.includes(gymId));
  const remaining = new Map<Id<"gyms">, { limit: number; slots: number }>();
  for (const gymId of addedGyms) {
    const billing = await ctx.db.query("billingAccounts").withIndex("by_gymId", q => q.eq("gymId", gymId)).unique();
    if (!billing) continue;
    const limit = billing.status === "trialing"
      ? TRIAL_STUDENT_LIMIT
      : PORTAL_PLANS[billing.plan ?? "starter"].studentLimit;
    if (limit !== null) remaining.set(gymId, { limit, slots: limit });
  }
  if (!remaining.size) return;

  for (const student of await ctx.db.query("students").collect()) {
    if (!getStudentPlan(student).isActive) continue;
    for (const gymId of new Set(student.gymIds)) {
      const capacity = remaining.get(gymId);
      if (!capacity) continue;
      capacity.slots--;
      if (capacity.slots === 0) {
        throw new ConvexError(`O plano da academia permite até ${capacity.limit} alunos ativos.`);
      }
    }
  }
}

export function addPlanMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function periodAt(plan: StudentPlan, index: number) {
  const months = PLAN_MONTHS[plan.type];
  return { planType: plan.type, periodStart: addPlanMonths(plan.startDate, index * months),
    periodEnd: addPlanMonths(plan.startDate, (index + 1) * months) };
}

export function lastCoveredDay(exclusiveEnd: string) {
  return new Date(Date.parse(`${exclusiveEnd}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function currentPlanPeriod(plan: StudentPlan, today: string, monthlyDueDay?: number) {
  const [year, month] = today.split("-").map(Number);
  const [startYear, startMonth] = plan.startDate.split("-").map(Number);
  const months = (year - startYear) * 12 + month - startMonth;
  const index = Math.max(0, Math.floor(months / PLAN_MONTHS[plan.type]));
  const period = periodAt(plan, index);
  // A configured monthly deadline follows the calendar month even if the stored period starts later.
  if (plan.type === "Mensal" && monthlyDueDay !== undefined) return period;
  return period.periodStart > today && index > 0 ? periodAt(plan, index - 1) : period;
}

export function monthlyPaymentDueDate(
  period: Pick<ReturnType<typeof periodAt>, "planType" | "periodStart">,
  dueDay?: number,
  planStart?: string,
) {
  if (period.planType !== "Mensal" || dueDay === undefined) return null;
  const [year, month] = period.periodStart.split("-").map(Number);
  const day = Math.min(dueDay, new Date(Date.UTC(year, month, 0)).getUTCDate());
  const due = `${period.periodStart.slice(0, 7)}-${String(day).padStart(2, "0")}`;
  return period.periodStart === planStart && due < planStart ? planStart : due;
}

export async function academyStudentDueDay(ctx: Pick<QueryCtx, "db">, gymId?: Id<"gyms">) {
  return gymId ? (await ctx.db.get(gymId))?.studentPaymentDueDay : undefined;
}

export function isPlanPeriod(plan: StudentPlan, start: string, end: string) {
  const [year, month] = start.split("-").map(Number);
  const [startYear, startMonth] = plan.startDate.split("-").map(Number);
  const index = Math.floor(((year - startYear) * 12 + month - startMonth) / PLAN_MONTHS[plan.type]);
  if (index < 0) return false;
  const period = periodAt(plan, index);
  return period.periodStart === start && period.periodEnd === end;
}

export function scheduledPlanPeriods(plan: StudentPlan, today = academyToday()) {
  const limit = addPlanMonths(today, 12);
  const periods: ReturnType<typeof periodAt>[] = [];
  for (let index = 0; ; index++) {
    const period = periodAt(plan, index);
    if (index > 0 && period.periodStart > limit) break;
    periods.push(period);
  }
  return periods;
}

export const paymentKey = (period: { planType: PlanType; periodStart: string; periodEnd: string }) =>
  `${period.planType}:${period.periodStart}:${period.periodEnd}`;

export async function requireStudentPlanAdmin(ctx: QueryCtx | MutationCtx, studentId: Id<"students">) {
  const principal = await requireAdmin(ctx);
  const student = await ctx.db.get(studentId);
  if (!student) throw new Error("Aluno não encontrado.");
  const gyms = new Set([...(principal.teacher?.gymIds ?? []), ...(principal.student?.gymIds ?? [])]);
  if (!student.gymIds.some(id => gyms.has(id))) throw new Error("Forbidden: student belongs to another academy");
  return { student, principal };
}

export function withStudentPlan(student: Doc<"students"> | null) {
  return student ? { ...student, plan: getStudentPlan(student) } : null;
}
