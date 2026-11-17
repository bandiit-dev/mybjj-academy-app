import assert from "node:assert/strict";
import { test } from "node:test";
import { createTeam, getAllTeams, getTeamById, recoverUnlinkedTeam, updateTeam } from "../convex/teams";

const handler=(fn:unknown)=>(fn as {_handler:(ctx:any,args:any)=>Promise<any>})._handler;
function context({admin=true}={}) {
  const tables:Record<string,any[]>={
    teachers:[{_id:"owner",clerkUserId:"user_1",userType:admin?"Admin":"Normal",gymIds:["gym_1"]}],students:[],
    gyms:[{_id:"gym_1",teamId:null},{_id:"gym_2",teamId:"other_team"}],
    teams:[{_id:"other_team",name:"Other academy"}]
  };
  const db={
    get:async(id:string)=>Object.values(tables).flat().find(row=>row._id===id)??null,
    query(table:string){
      let rows=tables[table];
      const chain={
        withIndex(_name:string,apply:any){const index={eq(field:string,value:any){rows=rows.filter(row=>row[field]===value);return index;}};apply(index);return chain;},
        unique:async()=>rows[0]??null,collect:async()=>rows
      };return chain;
    },
    insert:async(table:string,record:any)=>{const id=`${table}_${tables[table].length+1}`;tables[table].push({...record,_id:id});return id;},
    patch:async(id:string,patch:any)=>Object.assign(await db.get(id),patch)
  };
  return {tables,db,auth:{getUserIdentity:async()=>({subject:"user_1"})}};
}
const profile={name:"New team",leader:"Professor",logo:"",history:"",founded:"2026-11-17"};

test("a newly created team is visible immediately and linked to its academy",async()=>{
  const ctx=context();
  const teamId=await handler(createTeam)(ctx,{...profile,gymId:"gym_1"});
  assert.equal(ctx.tables.gyms[0].teamId,teamId);
  assert.equal(ctx.tables.teams.find(team=>team._id===teamId).ownerGymId,"gym_1");
  assert.deepEqual((await handler(getAllTeams)(ctx,{})).map((team:any)=>team._id),[teamId]);
});

test("multiple teams stay visible without replacing an existing academy affiliation",async()=>{
  const ctx=context();
  ctx.tables.teams.push({_id:"legacy_team",name:"Legacy affiliated team"});
  ctx.tables.gyms[0].teamId="legacy_team";
  const first=await handler(createTeam)(ctx,profile);
  const second=await handler(createTeam)(ctx,profile);
  assert.equal(ctx.tables.gyms[0].teamId,"legacy_team");
  assert.deepEqual((await handler(getAllTeams)(ctx,{})).map((team:any)=>team._id),["legacy_team",first,second]);
});

test("team creation and changes enforce academy access and admin permission",async()=>{
  const ctx=context();
  await assert.rejects(handler(createTeam)(ctx,{...profile,gymId:"gym_2"}),/Forbidden/);
  await assert.rejects(handler(createTeam)(context({admin:false}),profile),/admin role required/);
  await assert.rejects(handler(updateTeam)(ctx,{teamId:"other_team",name:"Changed"}),/Forbidden/);
  assert.equal(await handler(getTeamById)(ctx,{teamId:"other_team"}),null);
  assert.equal(ctx.tables.teams[0].name,"Other academy");
});

test("an admin can edit a team owned by their academy before affiliation",async()=>{
  const ctx=context();ctx.tables.gyms[0].teamId="existing_team";
  const teamId=await handler(createTeam)(ctx,profile);
  await handler(updateTeam)(ctx,{teamId,name:"Updated"});
  assert.equal((await handler(getTeamById)(ctx,{teamId})).name,"Updated");
});

test("legacy recovery restores the missing team and is safe to repeat",async()=>{
  const ctx=context();ctx.tables.teams.push({_id:"orphan",name:"Previously saved"});
  await handler(recoverUnlinkedTeam)(ctx,{teamId:"orphan",gymId:"gym_1"});
  await handler(recoverUnlinkedTeam)(ctx,{teamId:"orphan",gymId:"gym_1"});
  assert.equal(ctx.tables.gyms[0].teamId,"orphan");
  assert.equal(ctx.tables.teams.length,2);
  assert.equal((await handler(getAllTeams)(ctx,{}))[0]._id,"orphan");
});

test("legacy recovery cannot take another academy's team",async()=>{
  const ctx=context();
  await assert.rejects(handler(recoverUnlinkedTeam)(ctx,{teamId:"other_team",gymId:"gym_1"}),/another academy/);
  ctx.tables.teams.push({_id:"owned",ownerGymId:"gym_2"});
  await assert.rejects(handler(recoverUnlinkedTeam)(ctx,{teamId:"owned",gymId:"gym_1"}),/another academy/);
});
