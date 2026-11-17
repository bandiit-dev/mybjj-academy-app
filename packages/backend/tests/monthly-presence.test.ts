import assert from "node:assert/strict";
import { test } from "node:test";
import { getMonthlyPresence } from "../convex/enrollments";

const handler=(getMonthlyPresence as unknown as {_handler:(ctx:any,args:any)=>Promise<any>})._handler;
function context({admin=true,authenticated=true}={}) {
  const tables:Record<string,any[]>={
    billingAccounts: [{_id:"billing_1",gymId:"gym_1",status:"active",priceId:"price_test",paidThrough:Date.UTC(2199,0,1)}],
    teachers:admin?[{clerkUserId:"owner",userType:"Admin",gymIds:["gym_1"]}]:[],
    students:[{_id:"a",clerkUserId:"student",gymIds:["gym_1"],plan:{isActive:false}},{_id:"b",gymIds:["gym_1"]},{_id:"outsider",gymIds:["gym_2"]}],
    classSessions:[
      {_id:"first",sessionDate:"2026-11-01",status:"Scheduled",gymIds:["gym_1"]},
      {_id:"last",sessionDate:"2026-11-30",status:"Completed",gymIds:["gym_1"]},
      {_id:"cancelled",sessionDate:"2026-11-15",status:"Cancelled",gymIds:["gym_1"]},
      {_id:"previous",sessionDate:"2026-10-31",status:"Completed",gymIds:["gym_1"]},
      {_id:"next",sessionDate:"2026-12-01",status:"Scheduled",gymIds:["gym_1"]},
      {_id:"other_gym",sessionDate:"2026-11-05",status:"Completed",gymIds:["gym_2"]}
    ],
    enrollments:[
      {classSessionId:"first",studentId:"a",status:"Confirmed"},
      {classSessionId:"last",studentId:"a",status:"Confirmed"},
      {classSessionId:"last",studentId:"b",status:"Confirmed"},
      {classSessionId:"first",studentId:"b",status:"Cancelled"},
      {classSessionId:"first",studentId:"outsider",status:"Confirmed"},
      {classSessionId:"first",studentId:"deleted",status:"Confirmed"},
      ...["cancelled","previous","next","other_gym"].map(classSessionId=>({classSessionId,studentId:"a",status:"Confirmed"}))
    ]
  };
  return {tables,auth:{getUserIdentity:async()=>authenticated?{subject:admin?"owner":"student"}:null},db:{
    get:async(id:string)=>Object.values(tables).flat().find(row=>row._id===id)??null,
    query(table:string){
      let rows=tables[table];
      const chain={withIndex(_name:string,apply:any){const index={
        eq(field:string,value:any){rows=rows.filter(row=>row[field]===value);return index;},
        gte(field:string,value:any){rows=rows.filter(row=>row[field]>=value);return index;},
        lt(field:string,value:any){rows=rows.filter(row=>row[field]<value);return index;}
      };apply(index);return chain;},collect:async()=>rows,unique:async()=>rows[0]??null};
      return chain;
    }
  }};
}

test("monthly presence counts confirmed enrollments by class date and distinct students",async()=>{
  const ctx=context();
  assert.deepEqual(await handler(ctx,{month:"2026-11"}),{month:"2026-11",totalEnrollments:3,studentCount:2});
});

test("empty months return zero, and December excludes January of the next year",async()=>{
  const ctx=context();
  assert.deepEqual(await handler(ctx,{month:"2026-09"}),{month:"2026-09",totalEnrollments:0,studentCount:0});
  ctx.tables.classSessions.push({_id:"january",sessionDate:"2027-01-01",status:"Scheduled",gymIds:["gym_1"]});
  ctx.tables.enrollments.push({classSessionId:"january",studentId:"a",status:"Confirmed"});
  assert.deepEqual(await handler(ctx,{month:"2026-12"}),{month:"2026-12",totalEnrollments:1,studentCount:1});
});

test("duplicate enrollment records do not inflate a student's count in one session",async()=>{
  const ctx=context();
  ctx.tables.enrollments.push({classSessionId:"first",studentId:"a",status:"Confirmed"});
  assert.equal((await handler(ctx,{month:"2026-11"})).totalEnrollments,3);
});

test("monthly presence validates the month and requires admin access",async()=>{
  for(const month of ["2026-00","2026-13","2026-1","invalid"]){
    await assert.rejects(handler(context(),{month}),/Invalid month/);
  }
  await assert.rejects(handler(context({admin:false}),{month:"2026-11"}),/admin role required/);
  await assert.rejects(handler(context({authenticated:false}),{month:"2026-11"}),/Unauthorized/);
});
