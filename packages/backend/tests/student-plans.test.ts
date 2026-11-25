import assert from "node:assert/strict";
import { test } from "node:test";
import { getAcademyPaymentOverview, getStudentBilling, initializeExistingPlans, setPayment, setPlanActive } from "../convex/studentPlans";
import { getAllStudents, updateStudent } from "../convex/students";
import { updateGym } from "../convex/gyms";
import { claim, finish, queuePage } from "../convex/monthlyReminders";
import { send } from "../convex/monthlyReminderEmails";
import { getFunctionName } from "convex/server";
import { addPlanMonths, academyToday, getStudentPlan, monthlyPaymentDueDate, periodAt, scheduledPlanPeriods, validateStudentPlan } from "../convex/lib/studentPlans";

const handler = (fn: unknown) => (fn as { _handler: (ctx: any, args: any) => Promise<any> })._handler;
const monthly = {type: "Mensal" as const, startDate: "2024-01-31", isActive: true};

function context({admin = true, authenticated = true, otherAcademy = false} = {}) {
  const tables: Record<string, any[]> = {
    billingAccounts: [{_id:"billing_1",gymId:"gym_1",status:"active",priceId:"price_test",paidThrough:Date.UTC(2199,0,1)}],
    gyms: [{_id:"gym_1"}, {_id:"gym_2"}],
    teachers: admin ? [{_id:"teacher_1",clerkUserId:"owner",userType:"Admin",gymIds:["gym_1"]}] : [],
    students: [{_id:"student_1",clerkUserId:"student_user",gymIds:[otherAcademy?"gym_2":"gym_1"],plan:{...monthly},userType:"Normal"}],
    unities: [], studentPayments: [], monthlyPaymentReminders: []
  };
  const db = {
    get: async (id: string) => Object.values(tables).flat().find(row=>row._id===id)??null,
    query(table: string) {
      let rows = tables[table];
      const chain = {
        withIndex(_name: string, apply: any) {
          const index = {eq(field: string, value: any) {rows=rows.filter(row=>row[field]===value);return index;}};
          apply(index);return chain;
        },
        collect: async ()=>rows,
        first: async () => rows[0] ?? null,
        paginate: async ({ cursor, numItems }: { cursor: string | null; numItems: number }) => {
          const end = Number(cursor ?? 0) + numItems;
          return { page: rows.slice(Number(cursor ?? 0), end), isDone: end >= rows.length, continueCursor: String(end) };
        },
        unique: async ()=>{assert.ok(rows.length<=1);return rows[0]??null;}
      };
      return chain;
    },
    insert: async (table: string, record: any) => {
      const id=`${table}_${tables[table].length+1}`;tables[table].push({...record,_id:id});return id;
    },
    patch: async (id: string, patch: any) => {
      const target=await db.get(id);
      for (const [key,value] of Object.entries(patch)) {if(value===undefined) delete target[key];else target[key]=value;}
    }
  };
  return {tables,db,auth:{getUserIdentity:async()=>authenticated?{subject:admin?"owner":"student_user"}:null}};
}
const payment = {...periodAt(monthly,0),studentId:"student_1",paid:true,paidOn:"2024-02-01",notes:"Recebido na academia"};

test("billing periods handle month ends, leap years, semesters and years without date drift",()=>{
  assert.equal(addPlanMonths("2024-01-31",1),"2024-02-29");
  assert.equal(addPlanMonths("2023-01-31",1),"2023-02-28");
  assert.deepEqual(periodAt(monthly,1),{planType:"Mensal",periodStart:"2024-02-29",periodEnd:"2024-03-31"});
  assert.equal(periodAt({...monthly,type:"Semestral"},0).periodEnd,"2024-07-31");
  assert.equal(periodAt({...monthly,type:"Anual",startDate:"2024-02-29"},0).periodEnd,"2025-02-28");
});

test("existing students default to an active monthly plan without fabricated payments",async()=>{
  const ctx=context();delete ctx.tables.students[0].plan;
  const billing=await handler(getStudentBilling)(ctx,{studentId:"student_1"});
  assert.equal(billing.student.plan.type,"Mensal");
  assert.equal(billing.student.plan.isActive,true);
  assert.equal(billing.student.plan.startDate,`${academyToday().slice(0,7)}-01`);
  assert.equal(ctx.tables.studentPayments.length,0);
  assert.ok(billing.periods.every((row:any)=>!row.paid));
});

test("payment corrections update one record and never change activation",async()=>{
  const ctx=context();
  ctx.tables.students[0].plan.isActive=false;
  const id=await handler(setPayment)(ctx,payment);
  assert.equal(ctx.tables.studentPayments[0].paid,true);
  assert.equal(ctx.tables.studentPayments[0].recordedBy,"owner");
  assert.equal(ctx.tables.students[0].plan.isActive,false);
  assert.equal(await handler(setPayment)(ctx,{...payment,paid:false}),id);
  assert.equal(ctx.tables.studentPayments.length,1);
  assert.equal(ctx.tables.studentPayments[0].paid,false);
  assert.equal(ctx.tables.studentPayments[0].paidOn,undefined);
  await handler(setPlanActive)(ctx,{studentId:"student_1",isActive:true});
  assert.equal(ctx.tables.students[0].plan.isActive,true);
  assert.equal(ctx.tables.studentPayments[0].paid,false);
});

test("unpaid past periods leave a manually active plan active",async()=>{
  const ctx=context();
  const billing=await handler(getStudentBilling)(ctx,{studentId:"student_1"});
  assert.equal(billing.student.plan.isActive,true);
  assert.ok(billing.periods.some((row:any)=>row.periodStart==="2024-01-31"&&!row.paid));
});

test("the academy administrator can save and clear a valid monthly due day", async () => {
  const ctx = context();
  const update = handler(updateGym);
  for (const day of [0, 32, 4.5]) {
    await assert.rejects(update(ctx, { gymId: "gym_1", studentPaymentDueDay: day }), /entre 1 e 31/);
  }
  await assert.rejects(update(ctx, { gymId: "gym_2", studentPaymentDueDay: 10 }), /academy access/);
  await update(ctx, { gymId: "gym_1", studentPaymentDueDay: 31 });
  await update(ctx, { gymId: "gym_1", name: "Academia A" });
  assert.equal(ctx.tables.gyms[0].studentPaymentDueDay, 31);
  await update(ctx, { gymId: "gym_1", studentPaymentRemindersEnabled: true });
  assert.equal(ctx.tables.gyms[0].studentPaymentRemindersEnabled, true);
  await assert.rejects(update(ctx, { gymId: "gym_1", studentPaymentDueDay: null }), /ativar os lembretes/);
  await update(ctx, { gymId: "gym_1", studentPaymentDueDay: null, studentPaymentRemindersEnabled: false });
  assert.equal(ctx.tables.gyms[0].studentPaymentDueDay, undefined);
});

test("monthly reminders use the academy deadline and recheck payments before sending", async (t) => {
  const ctx = context();
  Object.assign(ctx.tables.gyms[0], {
    name: "Academia Centro", studentPaymentDueDay: 31, studentPaymentRemindersEnabled: true,
  });
  Object.assign(ctx.tables.students[0], {
    name: "Maria", email: "responsavel@example.com", clerkUserId: undefined,
  });
  const jobs: any[] = [];
  const reminderCtx = {
    ...ctx,
    scheduler: {
      runAt: async (_at: number, _fn: unknown, args: unknown) => { jobs.push(args); },
      runAfter: async (_delay: number, _fn: unknown, args: unknown) => { jobs.push(args); },
    },
  };
  const original = { key: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM_EMAIL };
  process.env.RESEND_API_KEY = "re_test";
  process.env.RESEND_FROM_EMAIL = "test@example.com";
  t.after(() => {
    if (original.key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = original.key;
    if (original.from === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = original.from;
  });
  let now = Date.parse("2024-02-26T12:15:00Z");
  t.mock.method(Date, "now", () => now);
  const args = { studentId: "student_1", gymId: "gym_1", day: "2024-02-26" };
  await handler(queuePage)(reminderCtx, {});
  assert.deepEqual(jobs, [args]);
  const reserve = () => handler(claim)(reminderCtx, args);
  const targetPayment = { ...periodAt(monthly, 1), studentId: args.studentId, paid: true };
  ctx.tables.studentPayments.push(targetPayment);
  assert.equal(await reserve(), null);
  targetPayment.paid = false;
  ctx.tables.students[0].plan.isActive = false;
  assert.equal(await reserve(), null);
  ctx.tables.students[0].plan.isActive = true;
  ctx.tables.gyms[0].studentPaymentRemindersEnabled = false;
  assert.equal(await reserve(), null);
  ctx.tables.gyms[0].studentPaymentRemindersEnabled = true;
  assert.equal(await handler(claim)(reminderCtx, { ...args, day: "2024-02-25" }), null);

  const requests: { key: string | null; body: string }[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, request: RequestInit) => {
    requests.push({
      key: new Headers(request.headers).get("Idempotency-Key"),
      body: String(request.body),
    });
    return requests.length === 1
      ? Response.json({ name: "rate_limit_exceeded", message: "Retry later" }, { status: 429 })
      : Response.json({ id: "sent_1" });
  });
  const sendCtx = {
    ...reminderCtx,
    runMutation: (fn: Parameters<typeof getFunctionName>[0], payload: unknown) =>
      handler(getFunctionName(fn) === "monthlyReminders:claim" ? claim : finish)(reminderCtx, payload),
  };
  await handler(send)(sendCtx, args);
  assert.equal(requests.length, 1);
  assert.equal(ctx.tables.monthlyPaymentReminders[0].month, "2024-02");
  assert.equal(ctx.tables.monthlyPaymentReminders[0].failedAt, now);
  assert.equal(JSON.parse(requests[0].body).to, "responsavel@example.com");
  assert.match(JSON.parse(requests[0].body).text, /29\/02\/2024/);
  await handler(send)(sendCtx, args);
  assert.equal(requests.length, 1);
  now += 5 * 60_000;
  await handler(send)(sendCtx, jobs[1]);
  assert.deepEqual(requests[1], requests[0]);
  assert.equal(ctx.tables.monthlyPaymentReminders[0].providerId, "sent_1");
  assert.equal(await reserve(), null);
  assert.equal(ctx.tables.monthlyPaymentReminders.length, 1);
});

test("monthly due dates clamp to the month end and the first enrollment date", () => {
  assert.equal(monthlyPaymentDueDate(periodAt(monthly, 1), 31), "2024-02-29");
  assert.equal(monthlyPaymentDueDate({ planType: "Mensal", periodStart: "2026-04-20" }, 31), "2026-04-30");
  assert.equal(monthlyPaymentDueDate(periodAt(monthly, 0), 10, monthly.startDate), "2024-01-31");
  assert.equal(monthlyPaymentDueDate(periodAt(monthly, 1), 10, monthly.startDate), "2024-02-10");
  assert.equal(monthlyPaymentDueDate(periodAt({ ...monthly, type: "Anual" }, 0), 10), null);
});

test("active students appear overdue after the due day until the manager marks the month paid", async (t) => {
  const ctx = context();
  ctx.tables.gyms[0].studentPaymentDueDay = 10;
  const list = async () => (await handler(getAllStudents)(ctx, { paymentStatusDay: academyToday() }))[0];
  const clock = t.mock.method(Date, "now", () => Date.parse("2024-02-11T02:59:59Z"));
  assert.equal((await list()).paymentOverdue, false);
  clock.mock.mockImplementation(() => Date.parse("2024-02-11T03:00:00Z"));
  assert.equal((await list()).paymentOverdue, true);
  assert.equal((await list()).plan.isActive, true);
  await handler(setPayment)(ctx, { ...payment, ...periodAt(monthly, 1), paidOn: "2024-02-11" });
  assert.equal((await list()).paymentOverdue, false);
  const billing = await handler(getStudentBilling)(ctx, { studentId: "student_1" });
  assert.equal(billing.periods.find((period: any) => period.periodStart === "2024-02-29")?.dueDate, "2024-02-10");
});

test("plan changes preserve old payments and allow correcting recorded historical periods",async()=>{
  const ctx=context();
  await handler(setPayment)(ctx,payment);
  await handler(updateStudent)(ctx,{studentId:"student_1",plan:{type:"Anual",startDate:"2025-01-01",isActive:true}});
  const billing=await handler(getStudentBilling)(ctx,{studentId:"student_1"});
  assert.equal(billing.student.plan.type,"Anual");
  assert.ok(billing.periods.some((row:any)=>row.planType==="Mensal"&&row.paid));
  await handler(setPayment)(ctx,{...payment,paid:false});
  assert.equal(ctx.tables.studentPayments[0].paid,false);
  await assert.rejects(handler(setPayment)(ctx,{...payment,...periodAt(monthly,1)}),/plano foi alterado/);
});

test("semestral and annual payments use the whole matching period",async()=>{
  for(const type of ["Semestral","Anual"] as const){
    const ctx=context();const plan={...monthly,type};ctx.tables.students[0].plan=plan;
    await handler(setPayment)(ctx,{...payment,...periodAt(plan,0)});
    assert.equal(ctx.tables.studentPayments[0].periodEnd,type==="Semestral"?"2024-07-31":"2025-01-31");
    await assert.rejects(handler(setPayment)(ctx,payment),/plano foi alterado/);
  }
});

test("billing reads and writes reject non-admins and other academies",async()=>{
  for(const options of [{admin:false},{authenticated:false},{otherAcademy:true}]){
    const ctx=context(options);
    await assert.rejects(handler(getStudentBilling)(ctx,{studentId:"student_1"}));
    await assert.rejects(handler(setPayment)(ctx,payment));
    await assert.rejects(handler(setPlanActive)(ctx,{studentId:"student_1",isActive:false}));
    assert.equal(ctx.tables.studentPayments.length,0);
  }
});

test("students cannot alter their own plan through profile editing",async()=>{
  const ctx=context({admin:false});
  await assert.rejects(handler(updateStudent)(ctx,{studentId:"student_1",plan:{...monthly,isActive:false}}),/only an admin/);
  assert.equal(ctx.tables.students[0].plan.isActive,true);
});

test("invalid dates, future payment dates, and arbitrary billing periods are rejected",async()=>{
  const ctx=context();
  assert.throws(()=>validateStudentPlan({...monthly,startDate:"2025-02-30"}),/data válida/);
  await assert.rejects(handler(setPayment)(ctx,{...payment,periodEnd:"2024-02-30"}),/data válida/);
  await assert.rejects(handler(setPayment)(ctx,{...payment,periodStart:"2024-02-01"}),/plano foi alterado/);
  await assert.rejects(handler(setPayment)(ctx,{...payment,paidOn:"2199-01-01"}),/futuro/);
  assert.equal(ctx.tables.studentPayments.length,0);
});

test("initialization is idempotent and preserves existing plans and all payment records",async()=>{
  const ctx=context();delete ctx.tables.students[0].plan;
  ctx.tables.students.push({_id:"student_2",plan:{type:"Semestral",startDate:"2020-01-01",isActive:false}});
  assert.deepEqual(await handler(initializeExistingPlans)(ctx,{}),{updated:1});
  assert.equal(ctx.tables.students[0].plan.type,"Mensal");
  assert.equal(ctx.tables.students[0].plan.isActive,true);
  assert.equal(ctx.tables.students[1].plan.isActive,false);
  assert.deepEqual(await handler(initializeExistingPlans)(ctx,{}),{updated:0});
  assert.equal(ctx.tables.studentPayments.length,0);
});

test("upcoming periods are generated without gaps and always include a future plan's first period",()=>{
  const periods=scheduledPlanPeriods(monthly,"2024-06-15");
  for(let i=1;i<periods.length;i++) assert.equal(periods[i-1].periodEnd,periods[i].periodStart);
  assert.equal(scheduledPlanPeriods({...monthly,startDate:"2090-01-01"},"2024-06-15").length,1);
  assert.equal(getStudentPlan({plan:{...monthly,isActive:false}}).isActive,false);
});

test("the academy payment overview resolves active periods and scopes payments and reminders", async t => {
  t.mock.method(Date, "now", () => Date.parse("2024-02-21T02:30:00Z"));
  const ctx = context();
  ctx.tables.gyms[0].studentPaymentDueDay = 20;
  ctx.tables.unities.push(
    {_id: "unit_1", gymId: "gym_1", name: "Centro"},
    {_id: "unit_2", gymId: "gym_2", name: "Outra academia"},
  );
  const started = {type: "Mensal", startDate: "2024-01-15", isActive: true};
  ctx.tables.students = [
    { _id: "paid", name: "Pago", gymIds: ["gym_1"], unityIds: ["unit_1", "unit_2"], plan: started },
    { _id: "unpaid", name: "Pendente", gymIds: ["gym_1"], unityIds: [], plan: started },
    { _id: "future", name: "Futuro", gymIds: ["gym_1"], unityIds: [], plan: {...started, startDate: "2024-03-01"} },
    { _id: "inactive", name: "Inativo", gymIds: ["gym_1"], unityIds: [], plan: {...started, isActive: false} },
    { _id: "annual", name: "Anual", gymIds: ["gym_1"], unityIds: [], plan: {...started, type: "Anual"} },
    { _id: "outside", name: "Fora", gymIds: ["gym_2"], unityIds: [], plan: started },
  ];
  ctx.tables.studentPayments.push(
    { studentId: "paid", ...periodAt(started as typeof monthly, 1), paid: true, paidOn: "2024-02-17", notes: "Interno" },
    { studentId: "unpaid", ...periodAt(started as typeof monthly, 0), paid: true, paidOn: "2024-01-20" },
    { studentId: "annual", ...periodAt({ ...monthly, startDate: started.startDate, type: "Anual" }, 0), paid: true },
  );
  ctx.tables.monthlyPaymentReminders.push(
    { studentId: "paid", gymId: "gym_1", month: "2024-02", sentAt: 10, recipient: "private@example.com" },
    { studentId: "unpaid", gymId: "gym_1", month: "2024-02", failedAt: 20 },
    { studentId: "unpaid", gymId: "gym_2", month: "2024-02", sentAt: 30 },
  );
  const overview = () => handler(getAcademyPaymentOverview)(ctx, { refreshDay: academyToday() });
  const current = await overview();
  assert.equal(current.today, "2024-02-20");
  assert.deepEqual(current.units, [{id: "unit_1", name: "Centro"}]);
  assert.deepEqual(current.rows.map((row: any) => [row.id, row.status]), [
    ["paid", "paid"], ["unpaid", "pending"], ["future", "upcoming"], ["inactive", "inactive"], ["annual", "paid"],
  ]);
  assert.deepEqual(current.rows[0].unitIds, ["unit_1"]);
  assert.equal(current.rows[0].paidOn, "2024-02-17");
  assert.equal(current.rows[0].dueDate, "2024-02-20");
  assert.deepEqual(current.rows[0].reminder, {status: "sent", at: 10});
  assert.deepEqual(current.rows[1].reminder, {status: "failed", at: 20});
  assert.equal(current.rows[4].dueDate, null);
  assert.equal(current.rows[4].period.periodEnd, "2025-01-15");

  t.mock.method(Date, "now", () => Date.parse("2024-02-21T03:30:00Z"));
  assert.equal((await overview()).rows[1].status, "overdue");
});

test("the academy payment overview requires administrative access", async () => {
  const args = {refreshDay: "2024-02-20"};
  const ctx = context({admin: false});
  await assert.rejects(handler(getAcademyPaymentOverview)(ctx, args), /admin role required/);
  ctx.tables.teachers.push({clerkUserId: "student_user", userType: "Normal", gymIds: ["gym_1"]});
  await assert.rejects(handler(getAcademyPaymentOverview)(ctx, args), /admin role required/);
  await assert.rejects(handler(getAcademyPaymentOverview)(context({authenticated: false}), args), /Unauthorized/);
});
