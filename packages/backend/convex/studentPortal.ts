import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { isStudentPresent } from "./attendance";
import { classTitle } from "./classes";
import { confirmStudentEnrollment } from "./enrollments";
import { getCurrentPrincipal } from "./lib/auth";
import {
  academyToday,
  assertPlanDate,
  getStudentPlan,
  periodAt,
  PLAN_MONTHS,
} from "./lib/studentPlans";
import { WEEK_DAYS, toIsoDate } from "./lib/validators";

const DAY_MS = 86_400_000;
const unavailable = () =>
  new ConvexError("Esta aula não está disponível para confirmação.");

async function currentStudent(ctx: Pick<QueryCtx, "db" | "auth">) {
  const principal = await getCurrentPrincipal(ctx, { skipSubscription: true });
  if (!principal.student || principal.teacher || principal.isAdmin) {
    throw new Error("Forbidden: student portal requires a student account");
  }
  return principal.student;
}

function offsetDate(date: string, days: number) {
  return toIsoDate(new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS));
}

function recurringTime(template: Doc<"classes">, date: string) {
  const day = WEEK_DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  const start = template.startHour.trim();
  if (
    date < academyToday(template.createdAt) ||
    !template.weekDays.includes(day) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(start)
  )
    return null;

  const startsAt = Date.parse(`${date}T${start}:00-03:00`);
  const label = template.duration.trim().toLowerCase();
  const minutes = label.match(/^(\d+)\s*(?:min(?:utos?)?)?$/);
  const hours = label.match(
    /^(\d+)\s*(?:h|horas?)\s*(?:(\d{1,2})\s*(?:min)?)?$/,
  );
  const clock = label.match(/^(\d{1,2}):([0-5]\d)$/);
  const duration = minutes
    ? Number(minutes[1])
    : hours
      ? Number(hours[1]) * 60 + Number(hours[2] ?? 0)
      : clock
        ? Number(clock[1]) * 60 + Number(clock[2])
        : 0;
  return {
    startsAt,
    endsAt:
      duration > 0 && duration <= 1440 ? startsAt + duration * 60_000 : null,
  };
}

const sharesAcademy = (
  student: Doc<"students">,
  item: { gymIds: Doc<"students">["gymIds"] },
) => item.gymIds.some((id) => student.gymIds.includes(id));

function sessionsForDate(ctx: Pick<QueryCtx, "db">, date: string) {
  return ctx.db
    .query("classSessions")
    .withIndex("by_sessionDate", (q) => q.eq("sessionDate", date));
}

async function schedule(
  ctx: QueryCtx,
  student: Doc<"students">,
  date: string,
  sessions: Doc<"classSessions">[],
) {
  const existingClasses = new Set(sessions.map((session) => session.classId));
  const templates = (await ctx.db.query("classes").collect()).filter(
    (template) => sharesAcademy(student, template),
  );
  const templateById = new Map(
    templates.map((template) => [template._id, template]),
  );
  const entries = [
    ...sessions
      .filter((session) => session.status !== "Cancelled")
      .map((session) => ({
        ...session,
        sessionId: session._id,
        template: templateById.get(session.classId),
      })),
    ...templates.flatMap((template) => {
      if (existingClasses.has(template._id)) return [];
      const time = recurringTime(template, date);
      return time
        ? [
            {
              ...time,
              classId: template._id,
              teacherIds: template.teacherIds,
              unityIds: template.unityIds,
              sessionId: null,
              template,
            },
          ]
        : [];
    }),
  ];
  const teachers = new Map(
    await Promise.all(
      [...new Set(entries.flatMap((entry) => entry.teacherIds))].map(
        async (id) => [id, await ctx.db.get(id)] as const,
      ),
    ),
  );
  const units = new Map(
    await Promise.all(
      [...new Set(entries.flatMap((entry) => entry.unityIds))].map(
        async (id) => [id, await ctx.db.get(id)] as const,
      ),
    ),
  );

  return Promise.all(
    entries
      .sort((a, b) => a.startsAt - b.startsAt)
      .map(async (entry) => {
        const [enrollment, attendance] = entry.sessionId
          ? await participation(ctx, student._id, entry.sessionId)
          : [null, null];
        return {
          classId: entry.classId,
          sessionId: entry.sessionId,
          startsAt: entry.startsAt,
          endsAt: entry.endsAt,
          title: classTitle(entry.template),
          teachers: entry.teacherIds.flatMap((id) => {
            const teacher = teachers.get(id);
            return teacher && sharesAcademy(student, teacher)
              ? [teacher.name]
              : [];
          }),
          units: entry.unityIds.flatMap((id) => {
            const unit = units.get(id);
            return unit?.gymId && student.gymIds.includes(unit.gymId)
              ? [unit.name ?? unit.address]
              : [];
          }),
          attendance: attendance?.status ?? null,
          confirmed: enrollment?.status === "Confirmed",
        };
      }),
  );
}

function participation(
  ctx: Pick<QueryCtx, "db">,
  studentId: Doc<"students">["_id"],
  sessionId: Doc<"classSessions">["_id"],
) {
  return Promise.all([
    ctx.db
      .query("enrollments")
      .withIndex("by_classSessionId_studentId", (q) =>
        q.eq("classSessionId", sessionId).eq("studentId", studentId),
      )
      .unique(),
    ctx.db
      .query("attendance")
      .withIndex("by_classSessionId_studentId", (q) =>
        q.eq("classSessionId", sessionId).eq("studentId", studentId),
      )
      .unique(),
  ]);
}

async function paymentSummary(
  ctx: QueryCtx,
  student: Doc<"students">,
  today: string,
) {
  const plan = getStudentPlan(student, today);
  const records = await ctx.db
    .query("studentPayments")
    .withIndex("by_studentId", (q) => q.eq("studentId", student._id))
    .collect();
  const paid = records.filter((record) => record.paid);
  const lastPayment =
    paid
      .flatMap((record) => (record.paidOn ? [record.paidOn] : []))
      .sort()
      .at(-1) ?? null;
  const currentPaid = paid.filter(
    (record) =>
      record.planType === plan.type &&
      record.periodStart >= plan.startDate &&
      record.periodStart <= today &&
      today < record.periodEnd,
  );
  const coveredThrough = currentPaid.sort((a, b) =>
    b.periodEnd.localeCompare(a.periodEnd),
  )[0]?.periodEnd;
  const months =
    (Number(today.slice(0, 4)) - Number(plan.startDate.slice(0, 4))) * 12 +
    Number(today.slice(5, 7)) -
    Number(plan.startDate.slice(5, 7));
  const interval = PLAN_MONTHS[plan.type];
  const index = Math.max(0, Math.floor(months / interval));
  const period = periodAt(plan, index);
  const current =
    period.periodStart > today && index > 0
      ? periodAt(plan, index - 1)
      : period;

  return {
    type: plan.type,
    status: !plan.isActive
      ? ("inactive" as const)
      : coveredThrough
        ? ("paid" as const)
        : plan.startDate > today
          ? ("upcoming" as const)
          : ("pending" as const),
    lastPayment,
    dueDate: plan.isActive ? (coveredThrough ?? current.periodStart) : null,
  };
}

export const getOverview = query({
  args: { refreshDay: v.string() },
  handler: async (ctx) => {
    const student = await currentStudent(ctx);
    const today = academyToday();
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    const monday = offsetDate(today, -((weekday + 6) % 7));
    const dates = Array.from({ length: 7 }, (_, index) =>
      offsetDate(monday, index),
    );
    const sessions = (
      await ctx.db
        .query("classSessions")
        .withIndex("by_sessionDate", (q) =>
          q.gte("sessionDate", monday).lte("sessionDate", today),
        )
        .collect()
    ).filter((session) => sharesAcademy(student, session));
    const todaysSessions = sessions.filter(
      (session) => session.sessionDate === today,
    );

    const [classes, payments, attended] = await Promise.all([
      schedule(ctx, student, today, todaysSessions),
      paymentSummary(ctx, student, today),
      Promise.all(
        sessions
          .filter((session) => session.status !== "Cancelled")
          .map(async (session) => {
            const [enrollment, attendance] = await participation(
              ctx,
              student._id,
              session._id,
            );
            return isStudentPresent(attendance?.status, enrollment?.status)
              ? session.sessionDate
              : null;
          }),
      ),
    ]);
    const total = attended.filter((date) => date !== null).length;
    return {
      today,
      profile: {
        name: student.name,
        picture: student.picture,
        belt: student.belt,
        degree: student.degree,
        email: student.email,
        phone: student.phone,
      },
      week: {
        total,
        days: dates.map((date) => ({
          date,
          attended: attended.includes(date),
        })),
      },
      classes,
      payments,
    };
  },
});

export const getSchedule = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    assertPlanDate(date);
    const student = await currentStudent(ctx);
    const sessions = (await sessionsForDate(ctx, date).collect()).filter(
      (session) => sharesAcademy(student, session),
    );
    return schedule(ctx, student, date, sessions);
  },
});

export const confirmClass = mutation({
  args: {
    sessionId: v.optional(v.id("classSessions")),
    classId: v.optional(v.id("classes")),
    date: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId: requestedSessionId, classId, date }) => {
    const student = await currentStudent(ctx);
    const now = Date.now();
    const today = academyToday(now);
    let sessionId;
    if (requestedSessionId) {
      if (classId || date !== undefined) throw unavailable();
      const session = await ctx.db.get(requestedSessionId);
      if (
        !session ||
        session.sessionDate > today ||
        session.status === "Cancelled" ||
        !sharesAcademy(student, session)
      ) {
        throw unavailable();
      }
      sessionId = session._id;
    } else {
      if (!classId) throw unavailable();
      const sessionDate = date ?? today;
      assertPlanDate(sessionDate);
      if (sessionDate > today) throw unavailable();
      const template = await ctx.db.get(classId);
      const time = template && recurringTime(template, sessionDate);
      if (!template || !time || !sharesAcademy(student, template))
        throw unavailable();

      const existing = await sessionsForDate(ctx, sessionDate)
        .filter((q) => q.eq(q.field("classId"), template._id))
        .collect();
      const available = existing.find(
        (session) =>
          session.status !== "Cancelled" && sharesAcademy(student, session),
      );
      if (existing.length && !available) throw unavailable();
      if (available) {
        sessionId = available._id;
      } else {
        if (time.endsAt === null)
          throw new ConvexError(
            "A duração desta aula precisa ser atualizada pela academia.",
          );
        sessionId = await ctx.db.insert("classSessions", {
          classId: template._id,
          sessionDate,
          startsAt: time.startsAt,
          endsAt: time.endsAt,
          teacherIds: template.teacherIds,
          gymIds: template.gymIds,
          unityIds: template.unityIds,
          status: "Scheduled",
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    const [, attendance] = await participation(ctx, student._id, sessionId);
    if (attendance?.status === "Absent") throw unavailable();
    return confirmStudentEnrollment(ctx, sessionId, student._id);
  },
});
