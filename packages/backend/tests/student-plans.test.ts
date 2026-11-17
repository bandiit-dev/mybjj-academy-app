import assert from "node:assert/strict";
import { test } from "node:test";
import { getStudentBilling, initializeExistingPlans, setPayment, setPlanActive } from "../convex/studentPlans";
import { updateStudent } from "../convex/students";
import { addPlanMonths, academyToday, getStudentPlan, periodAt, scheduledPlanPeriods, validateStudentPlan } from "../convex/lib/studentPlans";

const handler = (fn: unknown) => (fn as { _handler: (ctx: any, args: any) => Promise<any> })._handler;
const monthly = {type: "Mensal" as const, startDate: "2024-01-31", isActive: true};

function context({admin = true, authenticated = true, otherAcademy = false} = {}) {
  const tables: Record<string, any[]> = {
    billingAccounts: [{_id:"billing_1",gymId:"gym_1",status:"active",priceId:"price_test",paidThrough:Date.UTC(2199,0,1)}],
    teachers: admin ? [{_id:"teacher_1",clerkUserId:"owner",userType:"Admin",gymIds:["gym_1"]}] : [],
    students: [{_id:"student_1",clerkUserId:"student_user",gymIds:[otherAcademy?"gym_2":"gym_1"],plan:{...monthly},userType:"Normal"}],
    studentPayments: []
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
