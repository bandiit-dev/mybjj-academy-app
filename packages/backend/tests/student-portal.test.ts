import assert from "node:assert/strict";
import { test } from "node:test";
import { getStudentAttendanceHistory } from "../convex/attendance";
import { getStaffClasses } from "../convex/classes";
import {
  getClassSessionById,
  getStaffClassHistory,
  getStaffSessionLog,
  getTeacherClassHistory,
  getMonthlyTeachingCounts,
  markStaffSessionPresence,
  markStaffSessionPresences,
  recordClassDate,
  saveStaffSessionLog,
} from "../convex/classSessions";
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
        name: "Ana",
        picture: "https://example.com/ana.jpg",
        belt: "White",
        degree: 0,
        clerkUserId: "other-login",
        gymIds: ["gym"],
        userType: "Normal",
      },
    ],
    classSessionLogs: [],
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
      {
        _id: "attendance-tuesday",
        classSessionId: "tuesday",
        studentId: "student",
        status: "Absent",
      },
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
              lt(field: string, value: string) {
                rows = rows.filter((row) => row[field] < value);
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
          async *[Symbol.asyncIterator]() {
            yield* rows;
          },
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

test("admin attendance history counts present sessions once, scoped to the student's accessible academies", async (t) => {
  t.mock.method(Date, "now", () => clock);
  const { ctx, tables, friday } = fixture("admin-login");
  tables.teachers.push({
    _id: "admin",
    clerkUserId: "admin-login",
    userType: "Admin",
    gymIds: ["gym"],
  });
  tables.billingAccounts = [
    {
      gymId: "gym",
      status: "active",
      priceId: "price_test",
      paidThrough: clock + 86_400_000,
    },
  ];
  tables.students[0].gymIds.push("elsewhere");
  tables.classSessions.push(
    { ...friday, _id: "teacher-present" },
    { ...friday, _id: "canceled", status: "Cancelled" },
    { ...friday, _id: "future", sessionDate: "2026-11-27" },
  );
  tables.attendance.push({
    classSessionId: "teacher-present",
    studentId: "student",
    status: "Present",
  });
  tables.enrollments.push(
    ...[
      "monday",
      "teacher-present",
      "outside-scope",
      "canceled",
      "future",
      "missing",
    ].map((classSessionId) => ({
      classSessionId,
      studentId: "student",
      status: "Confirmed",
    })),
  );

  const history = await handler(getStudentAttendanceHistory)(ctx, {
    studentId: "student",
  });
  assert.equal(history.total, 2);
  assert.deepEqual(
    history.classes.map((entry: { sessionId: string }) => entry.sessionId),
    ["teacher-present", "monday"],
  );
  assert.equal(history.classes[0].title, "Fundamentos GI");
  assert.deepEqual(history.classes[0].units, ["Centro"]);
  assert.deepEqual(
    await handler(getStudentAttendanceHistory)(ctx, {
      studentId: "other-student",
    }),
    {
      total: 0,
      classes: [],
    },
  );
  await assert.rejects(
    handler(getStudentAttendanceHistory)(fixture().ctx, {
      studentId: "student",
    }),
    /admin role required/,
  );
  tables.students[1].gymIds = ["elsewhere"];
  await assert.rejects(
    handler(getStudentAttendanceHistory)(ctx, { studentId: "other-student" }),
    /student belongs to another/,
  );
});

test("class history and notes are scoped to assigned teachers and academy admins", async (t) => {
  t.mock.method(Date, "now", () => clock);
  const { ctx, tables, friday } = fixture("teacher-login");
  tables.teachers.push(
    {
      _id: "other-teacher",
      clerkUserId: "substitute",
      name: "Ana Costa",
      gymIds: ["gym"],
      userType: "Normal",
    },
    {
      _id: "admin",
      clerkUserId: "admin-login",
      userType: "Admin",
      gymIds: ["gym"],
    },
    {
      _id: "outside-teacher",
      name: "Outro professor",
      gymIds: ["elsewhere"],
      userType: "Normal",
    },
  );
  tables.billingAccounts = [
    {
      gymId: "gym",
      status: "active",
      priceId: "price_test",
      paidThrough: clock + 86_400_000,
    },
  ];
  tables.classSessions.push(
    { ...friday, _id: "covered", teacherIds: ["other-teacher"] },
    { ...friday, _id: "future", startsAt: clock + 60_000 },
    { ...friday, _id: "cancelled", status: "Cancelled" },
  );
  tables.attendance.push({
    classSessionId: "monday",
    studentId: "other-student",
    status: "Present",
  });

  assert.equal((await handler(getStaffClasses)(ctx, {})).classes.length, 1);
  const history = await handler(getStaffClassHistory)(ctx, {
    classId: "class-intro",
  });
  assert.deepEqual(
    history.sessions.map((row: { _id: string }) => row._id),
    ["tuesday", "monday"],
  );
  assert.equal(history.canRecord, true);
  const session = await handler(getStaffSessionLog)(ctx, {
    sessionId: "monday",
  });
  assert.deepEqual(
    session.students.map((row: { status: string }) => row.status),
    ["Present", "Confirmed"],
  );

  await handler(saveStaffSessionLog)(ctx, {
    sessionId: "monday",
    notes: "  Revisamos a guarda.  ",
  });
  const updated = await handler(getStaffSessionLog)(ctx, {
    sessionId: "monday",
  });
  assert.equal(updated.leadTeacher.name, "Carlos Silva");
  assert.equal(updated.notes, "Revisamos a guarda.");
  await assert.rejects(
    handler(saveStaffSessionLog)(ctx, {
      sessionId: "covered",
      notes: "Aula de outro professor.",
    }),
    /não está disponível/,
  );

  const identity = (subject: string) => ({
    ...ctx,
    auth: { getUserIdentity: async () => ({ subject }) },
  });
  const admin = identity("admin-login");
  assert.equal(
    (await handler(getStaffClassHistory)(admin, { classId: "class-intro" }))
      .sessions.length,
    3,
  );
  await assert.rejects(
    handler(saveStaffSessionLog)(admin, {
      sessionId: "monday",
      ledByTeacherId: "outside-teacher",
      notes: "",
    }),
    /Selecione o professor/,
  );
  await handler(saveStaffSessionLog)(admin, {
    sessionId: "monday",
    ledByTeacherId: "other-teacher",
    notes: "",
  });
  assert.equal(
    (
      await handler(getStaffSessionLog)(identity("substitute"), {
        sessionId: "monday",
      })
    ).leadTeacher.name,
    "Ana Costa",
  );

  const student = identity("student-login");
  await assert.rejects(
    handler(getStaffClassHistory)(student, { classId: "class-intro" }),
    /teacher or admin/,
  );
  await assert.rejects(
    handler(getStaffSessionLog)(student, { sessionId: "monday" }),
    /teacher or admin/,
  );
  assert.equal(
    (await handler(getClassSessionById)(student, { classSessionId: "monday" }))
      .notes,
    undefined,
  );
});

test("assigned teachers can mark students from the session academy present without a confirmation", async (t) => {
  t.mock.method(Date, "now", () => clock);
  const { ctx, tables, friday } = fixture("teacher-login");
  tables.students.push({ _id: "outside", name: "Paulo", gymIds: ["elsewhere"] });
  tables.classSessions.push(
    { ...friday, _id: "other-teacher", teacherIds: ["substitute"] },
    { ...friday, _id: "cancelled", status: "Cancelled" },
    { ...friday, _id: "future", startsAt: clock + 60_000 },
  );
  const getLog = () => handler(getStaffSessionLog)(ctx, { sessionId: "monday" });
  const mark = (studentId: string, sessionId = "monday") =>
    handler(markStaffSessionPresence)(ctx, { studentId, sessionId });
  const markBatch = (studentIds: string[]) =>
    handler(markStaffSessionPresences)(ctx, { studentIds, sessionId: "monday" });

  assert.deepEqual((await getLog()).availableStudents, [
    { id: "other-student", name: "Ana", belt: "White", degree: 0 },
    { id: "student", name: "Igor Miguel", belt: "Brown", degree: 2 },
  ]);
  await assert.rejects(
    markBatch(["other-student", "outside"]),
    /alunos da academia/,
  );
  assert.equal(tables.attendance.length, 1);
  for (const sessionId of ["other-teacher", "cancelled", "future"]) {
    await assert.rejects(mark("other-student", sessionId), /não está disponível/);
  }
  await assert.rejects(
    handler(markStaffSessionPresence)(
      {
        ...ctx,
        auth: { getUserIdentity: async () => ({ subject: "student-login" }) },
      },
      { sessionId: "monday", studentId: "student" },
    ),
    /teacher or admin/,
  );

  await mark("other-student");
  await mark("other-student");
  const marks = tables.attendance.filter(
    (row) => row.classSessionId === "monday",
  );
  assert.equal(marks.length, 1);
  assert.equal(marks[0].markedByTeacherId, "teacher");
  assert.equal(
    tables.enrollments.some((row) => row.studentId === "other-student"),
    false,
  );
  assert.deepEqual((await getLog()).students, [
    {
      id: "other-student",
      name: "Ana",
      picture: "https://example.com/ana.jpg",
      belt: "White",
      degree: 0,
      status: "Present",
    },
    {
      id: "student",
      name: "Igor Miguel",
      picture: "",
      belt: "Brown",
      degree: 2,
      status: "Confirmed",
    },
  ]);
  assert.deepEqual((await getLog()).availableStudents, [
    { id: "student", name: "Igor Miguel", belt: "Brown", degree: 2 },
  ]);
  await markBatch(["other-student", "student", "student"]);
  assert.equal(
    (await getLog()).students.filter(
      (row: { status: string }) => row.status === "Present",
    ).length,
    2,
  );
  await mark("student", "tuesday");
  assert.equal(tables.attendance[0].status, "Present");
  assert.equal(tables.attendance[0].markedByTeacherId, "teacher");
});

test("assigned staff can register a past recurring class without creating duplicate occurrences", async (t) => {
  t.mock.method(Date, "now", () => clock);
  const { ctx, tables } = fixture("teacher-login");
  const args = { classId: "class-intro", date: "2026-11-13" };
  const sessionId = await handler(recordClassDate)(ctx, args);
  assert.equal(await handler(recordClassDate)(ctx, args), sessionId);
  assert.equal(
    tables.classSessions.filter((row) => row.sessionDate === args.date).length,
    1,
  );
  const saved = await handler(getStaffSessionLog)(ctx, { sessionId });
  assert.equal(saved.leadTeacher.name, "Carlos Silva");
  assert.deepEqual(saved.students, []);
  assert.equal(saved.notes, "");
  await assert.rejects(
    handler(recordClassDate)(ctx, { ...args, date: "2026-11-27" }),
    /já realizada/,
  );
});

test("teacher history and monthly totals count only completed sessions for the recorded lead in scope", async (t) => {
  t.mock.method(Date, "now", () => clock);
  const { ctx, tables, friday } = fixture("teacher-login");
  tables.teachers.push(
    {
      _id: "other-teacher",
      clerkUserId: "substitute",
      name: "Ana Costa",
      gymIds: ["gym"],
      userType: "Normal",
    },
    {
      _id: "admin",
      clerkUserId: "admin-login",
      userType: "Admin",
      gymIds: ["gym"],
    },
    {
      _id: "outside",
      clerkUserId: "outside-login",
      gymIds: ["elsewhere"],
      userType: "Normal",
    },
  );
  tables.billingAccounts = [
    {
      gymId: "gym",
      status: "active",
      priceId: "price_test",
      paidThrough: clock + 86_400_000,
    },
  ];
  tables.classSessions.push(
    {
      ...friday,
      _id: "previous-month",
      sessionDate: "2026-10-30",
      status: "Completed",
    },
    {
      ...friday,
      _id: "covered",
      teacherIds: ["teacher", "other-teacher"],
      status: "Completed",
    },
    { ...friday, _id: "cancelled", status: "Cancelled" },
    { ...friday, _id: "pending" },
    {
      ...friday,
      _id: "future",
      sessionDate: "2026-11-27",
      status: "Completed",
    },
    {
      ...friday,
      _id: "out-of-scope",
      gymIds: ["elsewhere"],
      status: "Completed",
    },
  );
  tables.classSessionLogs.push(
    ...[
      "monday",
      "previous-month",
      "cancelled",
      "pending",
      "future",
      "out-of-scope",
    ].map((sessionId) => ({ sessionId, ledByTeacherId: "teacher" })),
    { sessionId: "covered", ledByTeacherId: "other-teacher" },
  );
  const identity = (subject: string) => ({
    ...ctx,
    auth: { getUserIdentity: async () => ({ subject }) },
  });
  const teacherHistory = await handler(getTeacherClassHistory)(ctx, {});
  assert.deepEqual(
    teacherHistory.classes.map((item: { sessionId: string }) => item.sessionId),
    ["monday", "previous-month"],
  );
  assert.deepEqual(teacherHistory.classes[0].units, ["Centro"]);
  assert.equal(
    await handler(getTeacherClassHistory)(ctx, { teacherId: "other-teacher" }),
    null,
  );
  await assert.rejects(
    handler(getMonthlyTeachingCounts)(ctx, { month: "2026-11" }),
    /admin role required/,
  );
  await assert.rejects(
    handler(getTeacherClassHistory)(identity("student-login"), {}),
    /teacher or admin role/,
  );

  const admin = identity("admin-login");
  assert.equal(
    await handler(getTeacherClassHistory)(admin, { teacherId: "outside" }),
    null,
  );
  assert.equal(
    (
      await handler(getTeacherClassHistory)(admin, {
        teacherId: "other-teacher",
      })
    ).classes[0].sessionId,
    "covered",
  );
  assert.deepEqual(
    new Map(
      (
        await handler(getMonthlyTeachingCounts)(admin, { month: "2026-11" })
      ).map((row: { teacherId: string; total: number }) => [
        row.teacherId,
        row.total,
      ]),
    ),
    new Map([
      ["teacher", 1],
      ["other-teacher", 1],
    ]),
  );
  assert.deepEqual(
    await handler(getMonthlyTeachingCounts)(admin, { month: "2026-10" }),
    [{ teacherId: "teacher", total: 1 }],
  );
});
