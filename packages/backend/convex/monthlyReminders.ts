import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import {
  academyToday,
  currentPlanPeriod,
  getStudentPlan,
  monthlyPaymentDueDate,
} from "./lib/studentPlans";
import { assertInvitationEmail } from "./lib/validators";

const retryDelayMs = 5 * 60_000;
const maxAttempts = 3;
const sendSpacingMs = 1_100;

function targetDate(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 3);
  return date.toISOString().slice(0, 10);
}

function duePeriod(
  student: Doc<"students">,
  gym: Doc<"gyms"> | null,
  today: string,
  dueDate: string,
) {
  if (
    !gym?.studentPaymentRemindersEnabled ||
    gym.studentPaymentDueDay === undefined
  ) {
    return null;
  }
  const plan = getStudentPlan(student, today);
  if (!plan.isActive || plan.type !== "Mensal" || plan.startDate > today)
    return null;
  const period = currentPlanPeriod(plan, dueDate, gym.studentPaymentDueDay);
  return monthlyPaymentDueDate(
    period,
    gym.studentPaymentDueDay,
    plan.startDate,
  ) === dueDate
    ? period
    : null;
}

function contactEmail(student: Doc<"students">) {
  const email = student.email.trim();
  try {
    assertInvitationEmail(email);
    return email;
  } catch {
    return null;
  }
}

export const queuePage = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    day: v.optional(v.string()),
    nextSendAt: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, day, nextSendAt }) => {
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;
    const today = academyToday();
    if (day && day !== today) return;
    if (!cursor) {
      const enabled = await ctx.db
        .query("gyms")
        .withIndex("by_studentPaymentRemindersEnabled", (q) =>
          q.eq("studentPaymentRemindersEnabled", true),
        )
        .first();
      if (!enabled) return;
    }
    const dueDate = targetDate(today);
    const page = await ctx.db.query("students").paginate({
      cursor: cursor ?? null,
      numItems: 64,
    });
    const gymIds = new Set(page.page.flatMap((student) => student.gymIds));
    const gyms = new Map(
      await Promise.all(
        [...gymIds].map(async (id) => [id, await ctx.db.get(id)] as const),
      ),
    );
    let sendAt = Math.max(Date.now(), nextSendAt ?? 0);
    for (const student of page.page) {
      if (!contactEmail(student)) continue;
      for (const gymId of new Set(student.gymIds)) {
        if (!duePeriod(student, gyms.get(gymId) ?? null, today, dueDate))
          continue;
        await ctx.scheduler.runAt(sendAt, internal.monthlyReminderEmails.send, {
          studentId: student._id,
          gymId,
          day: today,
        });
        sendAt += sendSpacingMs;
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.monthlyReminders.queuePage, {
        cursor: page.continueCursor,
        day: today,
        nextSendAt: sendAt,
      });
    }
  },
});

export const claim = internalMutation({
  args: {
    studentId: v.id("students"),
    gymId: v.id("gyms"),
    day: v.string(),
    previousAttempt: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { studentId, gymId, day, previousAttempt },
  ): Promise<{
    reminderId: Id<"monthlyPaymentReminders">;
    recipient: string;
    subject: string;
    text: string;
    attempt: number;
  } | null> => {
    if (academyToday() !== day) return null;
    const [student, gym] = await Promise.all([
      ctx.db.get(studentId),
      ctx.db.get(gymId),
    ]);
    if (!student?.gymIds.includes(gymId) || !gym) return null;
    const dueDate = targetDate(day);
    const period = duePeriod(student, gym, day, dueDate);
    const recipient = contactEmail(student);
    if (!period || !recipient) return null;

    const month = dueDate.slice(0, 7);
    const [payment, existing] = await Promise.all([
      ctx.db
        .query("studentPayments")
        .withIndex("by_period", (q) =>
          q
            .eq("studentId", studentId)
            .eq("planType", period.planType)
            .eq("periodStart", period.periodStart)
            .eq("periodEnd", period.periodEnd),
        )
        .unique(),
      ctx.db
        .query("monthlyPaymentReminders")
        .withIndex("by_student_gym_month", (q) =>
          q.eq("studentId", studentId).eq("gymId", gymId).eq("month", month),
        )
        .unique(),
    ]);
    const now = Date.now();
    if (payment?.paid || existing?.sentAt !== undefined) return null;
    if (previousAttempt !== undefined && existing?.attempts !== previousAttempt)
      return null;
    if (
      existing &&
      (existing.retryAfter > now ||
        existing.attempts >= maxAttempts ||
        existing.recipient !== recipient ||
        existing.dueDate !== dueDate)
    )
      return null;

    const attempts = (existing?.attempts ?? 0) + 1;
    const retryAfter = now + retryDelayMs;
    const subject =
      existing?.subject ??
      `Lembrete de mensalidade — ${gym.name.replace(/[\r\n]+/g, " ")}`;
    const text =
      existing?.text ??
      [
        "Olá!",
        `A mensalidade de ${student.name} na academia ${gym.name} vence em ${dueDate.split("-").reverse().join("/")}.`,
        "Se o pagamento já foi feito, desconsidere este lembrete. Para dúvidas sobre o pagamento, fale com a sua academia.",
        "My BJJ Academy",
      ].join("\n\n");
    const reminderId =
      existing?._id ??
      (await ctx.db.insert("monthlyPaymentReminders", {
        studentId,
        gymId,
        month,
        dueDate,
        recipient,
        subject,
        text,
        attempts,
        retryAfter,
      }));
    if (existing) await ctx.db.patch(reminderId, { attempts, retryAfter });
    if (attempts < maxAttempts) {
      await ctx.scheduler.runAt(
        retryAfter,
        internal.monthlyReminderEmails.send,
        {
          studentId,
          gymId,
          day,
          previousAttempt: attempts,
        },
      );
    }
    return { reminderId, recipient, subject, text, attempt: attempts };
  },
});

export const finish = internalMutation({
  args: {
    reminderId: v.id("monthlyPaymentReminders"),
    attempt: v.number(),
    providerId: v.optional(v.string()),
  },
  handler: async (ctx, { reminderId, attempt, providerId }) => {
    const reminder = await ctx.db.get(reminderId);
    if (!reminder || reminder.sentAt !== undefined) return;
    if (providerId) {
      await ctx.db.patch(reminderId, {
        providerId,
        sentAt: Date.now(),
        failedAt: undefined,
      });
    } else if (reminder.attempts === attempt) {
      await ctx.db.patch(reminderId, { failedAt: Date.now() });
    }
  },
});
