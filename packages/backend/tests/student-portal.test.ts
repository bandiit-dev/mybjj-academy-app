import assert from "node:assert/strict";
import { test } from "node:test";
import { cancelEnrollment } from "../convex/enrollments";
import { getAllStudents, getStudentById } from "../convex/students";
import {
  confirmClass,
  getOverview,
  getSchedule,
} from "../convex/studentPortal";

const handler = (fn: unknown) =>
  (fn as { _handler: (ctx: unknown, args: unknown) => Promise<any> })._handler;
const today = "2026-11-20";
const clock = Date.parse(`${today}T15:00:00Z`);

function fixture(subject = "student-login") {
  const template = {
    _id: "class-intro",
    gymIds: ["gym"],
    teacherIds: ["teacher"],
    unityIds: ["unit"],
    weekDays: ["Friday"],
    startHour: "07:00",
    duration: "1h 15min",
    level: "Beginner",
    classType: "GI",
    createdAt: Date.parse("2026-11-07T12:00:00Z"),
  };
  const friday = {
    classId: "class-intro",
    sessionDate: today,
    gymIds: ["gym"],
    teacherIds: ["teacher"],
    unityIds: ["unit"],
    startsAt: Date.parse(`${today}T10:00:00Z`),
    endsAt: Date.parse(`${today}T11:15:00Z`),
    status: "Scheduled",
  };
  const tables: Record<string, any[]> = {
    teachers: [
      {
        _id: "teacher",
        name: "Carlos Silva",
        clerkUserId: "teacher-login",
        gymIds: ["gym"],
        userType: "Normal",
      },
    ],
    students: [
      {
        _id: "student",
        clerkUserId: "student-login",
        name: "Igor Miguel",
        picture: "",
        email: "igor@example.com",
        phone: "",
        belt: "Brown",
        degree: 2,
        gymIds: ["gym"],
        userType: "Normal",
        plan: { type: "Mensal", startDate: "2026-10-10", isActive: true },
      },
      {
        _id: "other-student",
        clerkUserId: "other-login",
        gymIds: ["gym"],
        userType: "Normal",
      },
    ],
    classes: [
      template,
      { ...template, _id: "different-gym", gymIds: ["elsewhere"] },
    ],
    unities: [{ _id: "unit", gymId: "gym", name: "Centro" }],
    classSessions: [
      {
        ...friday,
        _id: "monday",
        sessionDate: "2026-11-16",
        status: "Completed",
      },
      {
        ...friday,
        _id: "tuesday",
        sessionDate: "2026-11-17",
        status: "Completed",
      },
      {
        ...friday,
        _id: "outside-scope",
        gymIds: ["elsewhere"],
        classId: "different-gym",
      },
    ],
    enrollments: [
      {
        _id: "enroll-monday",
        classSessionId: "monday",
        studentId: "student",
        status: "Confirmed",
      },
      {
        _id: "enroll-tuesday",
        classSessionId: "tuesday",
        studentId: "student",
        status: "Confirmed",
      },
    ],
    attendance: [
      { classSessionId: "tuesday", studentId: "student", status: "Absent" },
    ],
    studentPayments: [
      {
        studentId: "student",
        planType: "Mensal",
        periodStart: "2026-11-10",
        periodEnd: "2026-12-10",
        paidOn: "2026-11-10",
        paid: true,
      },
      {
        studentId: "other-student",
        planType: "Mensal",
        periodStart: "2026-11-10",
        periodEnd: "2026-12-10",
        paidOn: "2026-11-17",
        paid: true,
      },
    ],
  };
  const ctx = {
    auth: { getUserIdentity: async () => (subject ? { subject } : null) },
    db: {
      get: async (id: string) =>
        Object.values(tables)
          .flat()
          .find((row) => row._id === id) ?? null,
      query(table: string) {
        let rows = [...tables[table]];
        const chain = {
          withIndex(_index: string, apply: (q: unknown) => void) {
            const q = {
              eq(field: string, value: unknown) {
                rows = rows.filter((row) => row[field] === value);
                return q;
              },
              gte(field: string, value: string) {
                rows = rows.filter((row) => row[field] >= value);
                return q;
              },
              lte(field: string, value: string) {
                rows = rows.filter((row) => row[field] <= value);
                return q;
              },
            };
            apply(q);
            return chain;
          },
          filter(apply: (q: unknown) => (row: any) => boolean) {
            rows = rows.filter(
              apply({
                field: (name: string) => name,
                eq: (field: string, value: unknown) => (row: any) =>
                  row[field] === value,
              }),
            );
            return chain;
          },
          collect: async () => rows,
          unique: async () => {
            assert.ok(rows.length <= 1);
            return rows[0] ?? null;
          },
        };
        return chain;
      },
      insert: async (table: string, record: any) => {
        const id = `${table}-${tables[table].length}`;
        tables[table].push({ _id: id, ...record });
        return id;
      },
      patch: async (id: string, record: any) => {
        Object.assign(
          Object.values(tables)
            .flat()
            .find((row) => row._id === id),
          record,
        );
      },
    },
  };
  return { ctx, tables, friday };
}

test("student overview reads their own payments, actual week and academy schedule", async (t) => {
  t.mock.method(Date, "now", () => clock);
  const { ctx } = fixture();
  const overview = await handler(getOverview)(ctx, { refreshDay: today });
  assert.equal(overview.today, today);
  assert.equal(overview.week.total, 1);
  assert.equal(overview.week.days[0].date, "2026-11-16");
  assert.equal(overview.week.days[1].attended, false);
  assert.deepEqual(overview.payments, {
    type: "Mensal",
    status: "paid",
    lastPayment: "2026-11-10",
    dueDate: "2026-12-10",
  });
  assert.equal(overview.classes.length, 1);
  assert.equal(overview.classes[0].title, "Fundamentos GI");
  assert.equal(
    overview.classes[0].endsAt - overview.classes[0].startsAt,
    75 * 60_000,
  );
  assert.equal(
    await handler(getStudentById)(ctx, { studentId: "other-student" }),
    null,
  );
  await assert.rejects(handler(getAllStudents)(ctx, {}), /admin role required/);
  await assert.rejects(
    handler(getOverview)(fixture("teacher-login").ctx, {}),
    /requires a student account/,
  );
});

test("today's recurring class becomes one session and one confirmation, including retries", async (t) => {
  t.mock.method(Date, "now", () => clock);
  const { ctx, tables } = fixture();
  const first = await handler(confirmClass)(ctx, { classId: "class-intro" });
  assert.deepEqual(
    await handler(confirmClass)(ctx, { classId: "class-intro" }),
    first,
  );
  const classes = await handler(getSchedule)(ctx, { date: today });
  assert.equal(classes.length, 1);
  assert.equal(classes[0].confirmed, true);
  assert.equal(
    tables.classSessions.filter(
      (row) => row.classId === "class-intro" && row.sessionDate === today,
    ).length,
    1,
  );
  assert.deepEqual(
    await handler(confirmClass)(ctx, { sessionId: classes[0].sessionId }),
    first,
  );
  assert.equal(
    (await handler(getOverview)(ctx, { refreshDay: today })).week.total,
    2,
  );
  await assert.rejects(
    handler(confirmClass)(ctx, { sessionId: "outside-scope" }),
    /não está disponível/,
  );
  await assert.rejects(
    handler(confirmClass)(ctx, { sessionId: "tuesday" }),
    /não está disponível/,
  );
});

test("students can confirm past sessions and recurring classes on the selected date", async (t) => {
  t.mock.method(Date, "now", () => clock);
  const { ctx, tables, friday } = fixture();
  const previousFriday = "2026-11-13";
  const futureFriday = "2026-11-27";
  tables.classSessions.push({
    ...friday,
    _id: "future",
    sessionDate: futureFriday,
  });
  tables.enrollments = tables.enrollments.filter(
    (record) => record.classSessionId !== "monday",
  );
  assert.equal(
    (await handler(confirmClass)(ctx, { sessionId: "monday" })).status,
    "Confirmed",
  );
  assert.equal(
    (await handler(getSchedule)(ctx, { date: previousFriday }))[0].sessionId,
    null,
  );
  const args = { classId: "class-intro", date: previousFriday };
  const confirmation = await handler(confirmClass)(ctx, args);
  assert.deepEqual(await handler(confirmClass)(ctx, args), confirmation);
  const [confirmed] = await handler(getSchedule)(ctx, { date: previousFriday });
  assert.equal(confirmed.confirmed, true);
  assert.equal(confirmed.startsAt, Date.parse(`${previousFriday}T10:00:00Z`));
  assert.equal(
    (await handler(getSchedule)(ctx, { date: today }))[0].confirmed,
    false,
  );
  assert.deepEqual(await handler(getSchedule)(ctx, { date: "2026-11-06" }), []);
  for (const input of [
    { classId: "class-intro", date: "2026-11-06" },
    { classId: "class-intro", date: futureFriday },
    { sessionId: "future" },
  ]) {
    await assert.rejects(
      handler(confirmClass)(ctx, input),
      /não está disponível/,
    );
  }
});

test("a cancelled session suppresses its recurring listing and confirmation", async (t) => {
  t.mock.method(Date, "now", () => clock);
  const { ctx, tables, friday } = fixture();
  tables.classSessions.push({
    ...friday,
    _id: "cancelled",
    status: "Cancelled",
  });
  assert.deepEqual(await handler(getSchedule)(ctx, { date: today }), []);
  await assert.rejects(
    handler(confirmClass)(ctx, { classId: "class-intro" }),
    /não está disponível/,
  );
  await assert.rejects(
    handler(confirmClass)(ctx, { sessionId: "cancelled" }),
    /não está disponível/,
  );
});

test("confirmation exports an object validator and requires exactly one class reference", async () => {
  const { ctx } = fixture();
  const definition = confirmClass as unknown as { exportArgs: () => string };
  assert.equal(JSON.parse(definition.exportArgs()).type, "object");

  await assert.rejects(handler(confirmClass)(ctx, {}), /não está disponível/);
  await assert.rejects(
    handler(confirmClass)(ctx, { sessionId: "monday", classId: "class-intro" }),
    /não está disponível/,
  );
});

test("students can undo their confirmation until a teacher records attendance", async (t) => {
  t.mock.method(Date, "now", () => clock);
  const { ctx, tables } = fixture();
  await handler(confirmClass)(ctx, { classId: "class-intro" });
  const [confirmed] = await handler(getSchedule)(ctx, { date: today });
  const args = { classSessionId: confirmed.sessionId };

  assert.equal(
    (await handler(getOverview)(ctx, { refreshDay: today })).week.total,
    2,
  );
  const cancellation = await handler(cancelEnrollment)(ctx, args);
  assert.equal(cancellation.status, "Cancelled");
  assert.deepEqual(await handler(cancelEnrollment)(ctx, args), cancellation);
  assert.equal(
    (await handler(getSchedule)(ctx, { date: today }))[0].confirmed,
    false,
  );
  assert.equal(
    (await handler(getOverview)(ctx, { refreshDay: today })).week.total,
    1,
  );

  await handler(confirmClass)(ctx, { sessionId: confirmed.sessionId });
  tables.attendance.push({
    classSessionId: confirmed.sessionId,
    studentId: "student",
    status: "Present",
  });
  await assert.rejects(
    handler(cancelEnrollment)(ctx, args),
    /registrada pelo professor/,
  );
  assert.equal(
    (await handler(getSchedule)(ctx, { date: today }))[0].confirmed,
    true,
  );
});
