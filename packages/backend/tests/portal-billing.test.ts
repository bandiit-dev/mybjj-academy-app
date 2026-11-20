import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { getFunctionName } from "convex/server";
import { stripeWebhook } from "../convex/http";
import * as billing from "../convex/billing";
import * as stripe from "../convex/stripe";
import { bootstrapAcademyAdmin } from "../convex/onboarding";
import { getAllStudents, createStudentWithoutAccount } from "../convex/students";
import { hasPaidPortalAccess } from "../convex/lib/portalBilling";
import { billingConfiguration, stripeRequest, subscriptionSnapshot, validPortalPrice, verifyStripeSignature } from "../convex/lib/stripeApi";

const handler = (fn: unknown) => (fn as {_handler:(ctx:any,args:any)=>Promise<any>})._handler;
const future = Date.now() + 86400000;
const checkoutReturnUrls = {success_url:"https://admin.example.com/assinatura?checkout=success&session_id={CHECKOUT_SESSION_ID}",cancel_url:"https://admin.example.com/assinatura?checkout=cancelled"};
const account = () => ({_id:"billing_1",ownerClerkUserId:"owner",gymId:"gym_1",stripeCustomerId:"cus_test",stripeSubscriptionId:"sub_test",checkoutAttempt:0,status:"active",priceId:"price_monthly",paidThrough:future,currentPeriodEnd:future,cancelAtPeriodEnd:false,stripeSyncedAt:0,lastEventCreated:0,createdAt:0,updatedAt:0});
function context({newUser=false, subject="owner"}={}) {
  const tables:Record<string,any[]> = {
    billingAccounts: newUser ? [] : [account()], billingEvents: [],
    teachers: newUser ? [] : [{_id:"teacher_1",clerkUserId:subject,userType:"Admin",gymIds:["gym_1"]}],
    students:[],gyms:newUser?[]:[{_id:"gym_1"}],unities:[{_id:"unity_1",gymId:"gym_1"}]
  };
  const db = {
    get:async(id:string)=>Object.values(tables).flat().find(row=>row._id===id)??null,
    query(table:string) {
      let rows=tables[table]??[];
      const chain={withIndex(_name:string,apply:any){const index={eq(field:string,value:any){rows=rows.filter(row=>row[field]===value);return index;}};apply(index);return chain;},
        filter(apply:any){const expr={field:(field:string)=>field,neq:(field:string,value:any)=>(row:any)=>row[field]!==value};rows=rows.filter(apply(expr));return chain;},
        collect:async()=>rows,first:async()=>rows[0]??null,unique:async()=>{assert.ok(rows.length<=1);return rows[0]??null;}};
      return chain;
    },
    insert:async(table:string,record:any)=>{const id=`${table}_${tables[table].length+1}`;tables[table].push({...record,_id:id});return id;},
    patch:async(id:string,patch:any)=>{const row=await db.get(id);for(const [key,value] of Object.entries(patch)){if(value===undefined)delete row[key];else row[key]=value;}}
  };
  const ctx:any={tables,db,auth:{getUserIdentity:async()=>({subject,email:"owner@example.com"})}};
  const invoke=async(fn:any,args:any)=>{const [module,name]=getFunctionName(fn).split(":");return handler((module==="billing"?billing:stripe as any)[name as keyof typeof billing])(ctx,args);};
  ctx.runQuery=invoke;ctx.runMutation=invoke;
  return ctx;
}
const snapshot=(extra={})=>({accountId:"billing_1",customerId:"cus_test",subscriptionId:"sub_test",status:"active",priceId:"price_monthly",paidThrough:future,currentPeriodEnd:future,cancelAtPeriodEnd:false,checkedAt:100,...extra});
const price={id:"price_monthly",active:true,currency:"brl",unit_amount:3990,recurring:{interval:"month",interval_count:1}};
function subscription(extra={}) {return {id:"sub_test",customer:"cus_test",metadata:{billingAccountId:"billing_1"},status:"active",cancel_at_period_end:false,items:{data:[{quantity:1,price,current_period_end:future/1000}]},latest_invoice:{id:"in_test",status:"paid",currency:"brl",parent:{subscription_details:{subscription:"sub_test"}},lines:{data:[{amount:3990,pricing:{price_details:{price:"price_monthly"}},period:{end:future/1000}}]}},...extra};}
async function withStripe(respond:(path:string,body:URLSearchParams)=>any, work:()=>Promise<void>) {
  const keys=["STRIPE_SECRET_KEY","STRIPE_MONTHLY_PRICE_ID","STRIPE_WEBHOOK_SECRET","APP_URL"];
  const previous=keys.map(key=>process.env[key]);const fetch=globalThis.fetch;
  Object.assign(process.env,{STRIPE_SECRET_KEY:"sk_test_fake",STRIPE_MONTHLY_PRICE_ID:"price_monthly",STRIPE_WEBHOOK_SECRET:"whsec_fake",APP_URL:"https://admin.example.com"});
  globalThis.fetch=async(url,init)=>{
    assert.equal((init?.headers as any).Authorization,"Bearer sk_test_fake");
    return Response.json(await respond(String(url).replace("https://api.stripe.com/v1/",""),new URLSearchParams(String(init?.body??""))));
  };
  try {await work();}finally{globalThis.fetch=fetch;keys.forEach((key,i)=>{if(previous[i]===undefined)delete process.env[key];else process.env[key]=previous[i];});}
}

test("only paid, unexpired active periods grant portal access",()=>{
  const paid={status:"active",priceId:"price_test",paidThrough:1000};
  assert.equal(hasPaidPortalAccess(paid,999),true);
  assert.equal(hasPaidPortalAccess({...paid,status:"past_due"},999),true);
  assert.equal(hasPaidPortalAccess(paid,1000),false);
  assert.equal(hasPaidPortalAccess({...paid,paidThrough:undefined},0),false);
  assert.equal(hasPaidPortalAccess({...paid,priceId:undefined},0),false);
  for(const status of ["pending","trialing","unpaid","canceled","incomplete","paused","invalid_plan"])assert.equal(hasPaidPortalAccess({...paid,status},0),false);
});

test("new signup can view billing but cannot access data before payment",async()=>{
  const ctx=context({newUser:true});
  assert.equal((await handler(billing.getStatus)(ctx,{})).hasAccess,false);
  const pending=await handler(billing.ensureAccount)(ctx,{});
  assert.equal(pending.ownerClerkUserId,"owner");assert.equal(pending.gymId,undefined);
  assert.equal(pending.status,"pending");
  assert.equal((await handler(billing.ensureAccount)(ctx,{}))._id,pending._id);
  await assert.rejects(handler(getAllStudents)(ctx,{}));
});

test("expired subscriptions block backend reads and writes while billing remains reachable",async()=>{
  const ctx=context();ctx.tables.billingAccounts[0].paidThrough=Date.now()-1;
  assert.equal((await handler(billing.getStatus)(ctx,{})).hasAccess,false);
  await assert.rejects(handler(getAllStudents)(ctx,{}),/SUBSCRIPTION_REQUIRED/);
  await assert.rejects(handler(createStudentWithoutAccount)(ctx,{gymId:"gym_1",unityId:"unity_1"}),/SUBSCRIPTION_REQUIRED/);
});

test("other admins inherit paid access but cannot manage the owner's subscription",async()=>{
  const ctx=context({subject:"other_admin"});
  const status=await handler(billing.getStatus)(ctx,{});
  assert.equal(status.hasAccess,true);assert.equal(status.canManage,false);
  await assert.rejects(handler(billing.ensureAccount)(ctx,{}),/responsável/);
  await assert.rejects(handler(billing.getStatus)(ctx,{gymId:"gym_other"}),/Forbidden/);
});

test("renewal failure preserves the previous paid period and cancellation scheduling keeps access",async()=>{
  const ctx=context();
  await handler(billing.applyStripeSnapshot)(ctx,snapshot({status:"past_due",paidThrough:undefined,cancelAtPeriodEnd:true}));
  assert.equal(ctx.tables.billingAccounts[0].paidThrough,future);
  assert.equal((await handler(billing.getStatus)(ctx,{})).hasAccess,true);
  await handler(billing.applyStripeSnapshot)(ctx,snapshot({status:"unpaid",checkedAt:101}));
  assert.equal((await handler(billing.getStatus)(ctx,{})).hasAccess,false);
});

test("webhooks are deduplicated and stale events cannot restore a canceled subscription",async()=>{
  const ctx=context();
  const canceled=snapshot({status:"canceled",eventId:"evt_cancel",eventType:"customer.subscription.deleted",eventCreated:50});
  await handler(billing.applyStripeSnapshot)(ctx,canceled);
  assert.deepEqual(await handler(billing.applyStripeSnapshot)(ctx,canceled),{duplicate:true});
  await handler(billing.applyStripeSnapshot)(ctx,snapshot({checkedAt:101,eventCreated:49,eventId:"evt_old"}));
  await handler(billing.applyStripeSnapshot)(ctx,snapshot({checkedAt:102,eventCreated:51,eventId:"evt_race"}));
  assert.equal(ctx.tables.billingAccounts[0].status,"canceled");assert.equal(ctx.tables.billingEvents.length,3);
  await handler(billing.applyStripeSnapshot)(ctx,snapshot({checkedAt:103,subscriptionId:"sub_new",eventCreated:52}));
  assert.equal(ctx.tables.billingAccounts[0].stripeSubscriptionId,"sub_new");assert.equal(ctx.tables.billingAccounts[0].status,"active");
});

test("snapshot customer mismatch and overlapping subscriptions cannot change an account",async()=>{
  const ctx=context();
  await assert.rejects(handler(billing.applyStripeSnapshot)(ctx,snapshot({customerId:"cus_other"})),/mismatch/);
  await handler(billing.applyStripeSnapshot)(ctx,snapshot({subscriptionId:"sub_other",status:"canceled"}));
  assert.equal(ctx.tables.billingAccounts[0].status,"active");
});

test("webhook HMAC rejects tampered payloads and old signatures, and accepts rotating secrets",async()=>{
  const body=JSON.stringify({id:"evt_test"});const now=1700000000000;const timestamp=now/1000;
  const signature=createHmac("sha256","secret").update(`${timestamp}.${body}`).digest("hex");
  const header=`t=${timestamp},v1=${"0".repeat(64)},v1=${signature}`;
  assert.equal(await verifyStripeSignature(body,header,"secret",now),true);
  assert.equal(await verifyStripeSignature(body+" ",header,"secret",now),false);
  assert.equal(await verifyStripeSignature(body,header,"secret",now+301000),false);
  assert.equal(await verifyStripeSignature(body,header,"wrong",now),false);
  assert.equal(await verifyStripeSignature(body,"v1=invalid","secret",now),false);
});

test("Stripe snapshots require the fixed BRL monthly price and an actually paid invoice",async()=>{
  let current=subscription();
  await withStripe(()=>current,async()=>{
    assert.equal(validPortalPrice(price),true);
    for(const patch of [{unit_amount:3900},{currency:"usd"},{recurring:{interval:"year",interval_count:1}},{id:"price_other"}])assert.equal(validPortalPrice({...price,...patch}),false);
    assert.equal((await subscriptionSnapshot("sub_test")).paidThrough,future);
    current=subscription({latest_invoice:{status:"open",currency:"brl"}});
    assert.equal((await subscriptionSnapshot("sub_test")).paidThrough,undefined);
    current=subscription({items:{data:[{quantity:1,price:{...price,unit_amount:1}}]}});
    assert.equal((await subscriptionSnapshot("sub_test")).status,"invalid_plan");
  });
});

test("checkout confirmation verifies customer and account before granting paid access",async()=>{
  const ctx=context();ctx.tables.billingAccounts[0].status="pending";delete ctx.tables.billingAccounts[0].paidThrough;
  let customer="cus_other";
  await withStripe(path=>path.startsWith("checkout/")?{mode:"subscription",client_reference_id:"billing_1",customer,subscription:"sub_test"}:subscription(),async()=>{
    await assert.rejects(handler(stripe.confirmCheckout)(ctx,{sessionId:"cs_test"}),/ownership/);
    assert.equal((await handler(billing.getStatus)(ctx,{})).hasAccess,false);
    customer="cus_test";
    await handler(stripe.confirmCheckout)(ctx,{sessionId:"cs_test"});
    assert.equal((await handler(billing.getStatus)(ctx,{})).hasAccess,true);
  });
});

test("checkout uses server price and reuses an open session",async()=>{
  const ctx=context();const row=ctx.tables.billingAccounts[0];row.status="pending";delete row.stripeSubscriptionId;
  const creates:any[]=[];
  await withStripe((path,body)=>{
    if(path.startsWith("subscriptions?"))return {data:[]};
    if(path.startsWith("checkout/sessions?"))return {data:[]};
    if(path.startsWith("prices/"))return price;
    if(path==="checkout/sessions") {creates.push(Object.fromEntries(body));return {id:"cs_existing",url:"https://checkout.stripe.com/test",expires_at:future/1000};}
    if(path==="checkout/sessions/cs_existing")return {...checkoutReturnUrls,status:"open",allow_promotion_codes:true,url:"https://checkout.stripe.com/test",expires_at:future/1000};
    throw new Error(`Unexpected Stripe request ${path}`);
  },async()=>{
    assert.equal((await handler(stripe.createCheckout)(ctx,{})).url,"https://checkout.stripe.com/test");
    assert.equal((await handler(stripe.createCheckout)(ctx,{})).url,"https://checkout.stripe.com/test");
    assert.equal(creates.length,1);assert.equal(creates[0]["line_items[0][price]"],"price_monthly");
    assert.equal(creates[0]["allowed_payment_method_types[0]"],"card");
    assert.equal(creates[0]["payment_method_types[0]"],undefined);
    assert.equal(creates[0].allow_promotion_codes,"true");
    assert.equal(creates[0]["discounts[0][promotion_code]"],undefined);
    assert.match(creates[0].success_url,/\/assinatura\?checkout=success/);
    assert.equal(row.checkoutLockUntil,undefined);
  });
});

test("new academy setup requires payment and atomically binds the paid account",async()=>{
  const ctx=context({newUser:true});
  const args={adminName:"Owner",adminPhone:"",adminBelt:"Black",adminDegree:0,gymName:"Academy",cnpj:"123",gymPhone:"",contactEmail:"owner@example.com",founded:"2026-11-01",unityName:"Centro",unityAddress:"Rua A"};
  await assert.rejects(handler(bootstrapAcademyAdmin)(ctx,args),/SUBSCRIPTION_REQUIRED/);
  ctx.tables.billingAccounts.push({...account(),gymId:undefined});
  const result=await handler(bootstrapAcademyAdmin)(ctx,args);
  assert.equal(ctx.tables.billingAccounts[0].gymId,result.gymId);
  assert.equal(ctx.tables.teachers[0].clerkUserId,"owner");
  assert.equal((await handler(billing.getStatus)(ctx,{})).hasAccess,true);
  await assert.rejects(handler(bootstrapAcademyAdmin)(ctx,args),/already has a profile/);
});


test("HTTP webhook rejects unsigned requests and retries failed processing",async()=>{
  const previous=process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET="secret";
  const body=JSON.stringify({id:"evt_http",type:"invoice.paid",created:Math.floor(Date.now()/1000),data:{object:{}}});
  const timestamp=Math.floor(Date.now()/1000);
  const signature=createHmac("sha256","secret").update(`${timestamp}.${body}`).digest("hex");
  const request=(signed=true)=>new Request("https://example.convex.site/stripe/webhook",{method:"POST",body,headers:signed?{"stripe-signature":`t=${timestamp},v1=${signature}`}:{}});
  let processed=0;
  const ctx={runAction:async()=>{processed++;}};
  try {
    assert.equal((await handler(stripeWebhook)(ctx,request(false))).status,400);
    assert.equal(processed,0);
    assert.equal((await handler(stripeWebhook)(ctx,request())).status,200);
    assert.equal(processed,1);
    assert.equal((await handler(stripeWebhook)({runAction:async()=>{throw new Error("Retry");}},request())).status,500);
  }finally{if(previous===undefined)delete process.env.STRIPE_WEBHOOK_SECRET;else process.env.STRIPE_WEBHOOK_SECRET=previous;}
});


test("an interrupted checkout request recovers its existing Stripe session",async()=>{
  const ctx=context();const row=ctx.tables.billingAccounts[0];row.status="pending";delete row.stripeSubscriptionId;
  await withStripe(path=>{
    if(path.startsWith("subscriptions?"))return {data:[]};
    if(path.startsWith("checkout/sessions?"))return {data:[{...checkoutReturnUrls,id:"cs_recovered",allow_promotion_codes:true,client_reference_id:"billing_1",mode:"subscription",expires_at:future/1000,url:"https://checkout.stripe.com/recovered"}]};
    throw new Error("Must reuse checkout, without creating another");
  },async()=>{
    assert.equal((await handler(stripe.createCheckout)(ctx,{})).url,"https://checkout.stripe.com/recovered");
    assert.equal(row.checkoutSessionId,"cs_recovered");
  });
});

test("simultaneous checkout requests are serialized",async()=>{
  const ctx=context();const args={accountId:"billing_1"};
  const attempt=await handler(billing.reserveCheckout)(ctx,args);
  await assert.rejects(handler(billing.reserveCheckout)(ctx,args),/preparado/);
  await handler(billing.finishCheckout)(ctx,{...args,attempt});
  assert.equal(await handler(billing.reserveCheckout)(ctx,args),attempt+1);
});


test("billing status tolerates sign-out while protected billing operations still require auth",async()=>{
  const ctx=context();ctx.auth.getUserIdentity=async()=>null;
  assert.equal(await handler(billing.getStatus)(ctx,{}),null);
  await assert.rejects(handler(billing.getCheckoutContext)(ctx,{}),/Unauthorized/);
  await assert.rejects(handler(billing.ensureAccount)(ctx,{}),/Unauthorized/);
});

test("product IDs are rejected before sending a Stripe price request",async()=>{
  await withStripe(()=>assert.fail("Invalid price configuration must not reach Stripe"),async()=>{
    process.env.STRIPE_MONTHLY_PRICE_ID="prod_example";
    assert.throws(()=>billingConfiguration(),(error:any)=>error.data?.code==="STRIPE_PRICE_CONFIGURATION");
    await assert.rejects(stripeRequest("prices/prod_example"),(error:any)=>error.data?.code==="STRIPE_PRICE_CONFIGURATION");
  });
});

test("Stripe 404 diagnostics expose a useful safe error without logging raw provider messages",async()=>{
  await withStripe(()=>null,async()=>{
    const errorLog=console.error;const logs:any[]=[];
    console.error=(...args:any[])=>{logs.push(args);};
    globalThis.fetch=async()=>Response.json({error:{code:"resource_missing",param:"price",message:"private provider message sk_test_fake"}},{status:404,headers:{"request-id":"req_diagnostic"}});
    try {
      await assert.rejects(stripeRequest("prices/price_missing"),(error:any)=>error.data?.code==="STRIPE_PRICE_NOT_FOUND" && error.data.message.includes("não foi encontrado"));
      assert.equal(logs[0][1].status,404);
      assert.equal(logs[0][1].code,"resource_missing");
      assert.equal(logs[0][1].requestId,"req_diagnostic");
      assert.equal(JSON.stringify(logs).includes("sk_test_fake"),false);
      assert.equal(JSON.stringify(logs).includes("private provider message"),false);
    }finally{console.error=errorLog;}
  });
});


test("coupon entered in the portal is resolved by Stripe and applied to checkout",async()=>{
  const ctx=context();const row=ctx.tables.billingAccounts[0];row.status="pending";delete row.stripeSubscriptionId;
  const requests:any[]=[];
  await withStripe((path,body)=>{
    requests.push({path,body:Object.fromEntries(body)});
    if(path.startsWith("promotion_codes?"))return {data:[{id:"promo_valid",code:"WELCOME",active:true}]};
    if(path.startsWith("subscriptions?") || path.startsWith("checkout/sessions?"))return {data:[]};
    if(path.startsWith("prices/"))return price;
    if(path==="checkout/sessions")return {id:"cs_promo",url:"https://checkout.stripe.com/discount",expires_at:future/1000};
    throw new Error(`Unexpected Stripe request ${path}`);
  },async()=>{
    await handler(stripe.createCheckout)(ctx,{promotionCode:"  welcome  "});
    const create=requests.find(request=>request.path==="checkout/sessions").body;
    assert.equal(create["allowed_payment_method_types[0]"],"card");
    assert.equal(create["payment_method_types[0]"],undefined);
    assert.equal(create["discounts[0][promotion_code]"],"promo_valid");
    assert.equal(create["metadata[promotionCodeId]"],"promo_valid");
    assert.equal(create["line_items[0][price]"],"price_monthly");
    assert.equal(create.allow_promotion_codes,undefined);
    assert.equal(row.paidThrough,future); // Checkout never extends access itself.
    assert.equal(row.status,"pending");
  });
});

test("invalid, expired, exhausted and other-customer coupons never create checkout",async()=>{
  for(const promo of [null,{active:false},{expires_at:1},{max_redemptions:1,times_redeemed:1},{customer:"cus_other"}]) {
    const ctx=context();const row=ctx.tables.billingAccounts[0];row.status="pending";delete row.stripeSubscriptionId;
    await withStripe(path=>{
      assert.ok(path.startsWith("promotion_codes?"));
      return {data:promo?[{id:"promo_invalid",code:"WELCOME",active:true,...promo}]:[]};
    },async()=>{
      await assert.rejects(handler(stripe.createCheckout)(ctx,{promotionCode:"WELCOME"}),/Cupom inválido/);
      assert.equal(row.checkoutLockUntil,undefined);
    });
  }
});

test("old checkout is expired and replaced when adding a coupon",async()=>{
  const ctx=context();const row=ctx.tables.billingAccounts[0];row.status="pending";delete row.stripeSubscriptionId;
  row.checkoutSessionId="cs_old";let expired=false;
  await withStripe((path,body)=>{
    if(path.startsWith("promotion_codes?"))return {data:[{id:"promo_valid",code:"WELCOME",active:true}]};
    if(path==="checkout/sessions/cs_old")return {id:"cs_old",status:"open",allow_promotion_codes:false,url:"https://checkout.stripe.com/old",expires_at:future/1000};
    if(path==="checkout/sessions/cs_old/expire"){expired=true;return {status:"expired"};}
    if(path.startsWith("subscriptions?") || path.startsWith("checkout/sessions?"))return {data:[]};
    if(path.startsWith("prices/"))return price;
    if(path==="checkout/sessions") {
      assert.equal(expired,true);assert.equal(body.get("discounts[0][promotion_code]"),"promo_valid");
      return {id:"cs_new",url:"https://checkout.stripe.com/new",expires_at:future/1000};
    }
    throw new Error(`Unexpected request ${path}`);
  },async()=>{
    assert.equal((await handler(stripe.createCheckout)(ctx,{promotionCode:"WELCOME"})).url,"https://checkout.stripe.com/new");
    assert.equal(row.checkoutSessionId,"cs_new");
  });
});

test("a paid zero-total coupon invoice still grants the verified period",async()=>{
  const current=subscription();current.latest_invoice.lines.data[0].amount=0;
  await withStripe(()=>({...current,latest_invoice:{...current.latest_invoice,amount_paid:0,total:0}}),async()=>{
    const verified=await subscriptionSnapshot("sub_test");
    assert.equal(verified.paidThrough,future);
    assert.equal(hasPaidPortalAccess(verified),true);
  });
});


test("Stripe eligibility errors return a coupon-specific message",async()=>{
  await withStripe(()=>null,async()=>{
    globalThis.fetch=async()=>Response.json({error:{code:"coupon_expired",param:"discounts[0][promotion_code]"}},{status:400});
    await assert.rejects(stripeRequest("checkout/sessions",{"discounts[0][promotion_code]":"promo_expired"}),(error:any)=>error.data?.code==="STRIPE_COUPON_REJECTED");
  });
});


test("changing APP_URL replaces an open checkout that returns to the old domain",async()=>{
  const ctx=context();const row=ctx.tables.billingAccounts[0];row.status="pending";delete row.stripeSubscriptionId;
  row.checkoutSessionId="cs_old_origin";let expired=false;
  await withStripe((path,body)=>{
    if(path==="checkout/sessions/cs_old_origin")return {...checkoutReturnUrls,id:"cs_old_origin",status:"open",allow_promotion_codes:true,url:"https://checkout.stripe.com/old",expires_at:future/1000};
    if(path==="checkout/sessions/cs_old_origin/expire"){expired=true;return {status:"expired"};}
    if(path.startsWith("subscriptions?") || path.startsWith("checkout/sessions?"))return {data:[]};
    if(path.startsWith("prices/"))return price;
    if(path==="checkout/sessions") {
      assert.equal(expired,true);
      assert.equal(body.get("success_url"),"http://localhost:3000/assinatura?checkout=success&session_id={CHECKOUT_SESSION_ID}");
      assert.equal(body.get("cancel_url"),"http://localhost:3000/assinatura?checkout=cancelled");
      return {id:"cs_local",url:"https://checkout.stripe.com/local",expires_at:future/1000};
    }
    throw new Error(`Unexpected request ${path}`);
  },async()=>{
    process.env.APP_URL="http://localhost:3000";
    assert.equal((await handler(stripe.createCheckout)(ctx,{})).url,"https://checkout.stripe.com/local");
    assert.equal(row.checkoutSessionId,"cs_local");
  });
});

test("trial checkout is card-free, grants time-limited access, and cannot be repeated", async () => {
  const ctx = context();
  const row = ctx.tables.billingAccounts[0];
  row.status = "pending";
  delete row.stripeSubscriptionId;
  delete row.paidThrough;
  const trialEnd = Math.floor(future / 1000) * 1000;
  let subscriptionStatus = "trialing";
  await withStripe((path, body) => {
    if (path.startsWith("subscriptions?") || path.startsWith("checkout/sessions?")) return { data: [] };
    if (path === "prices/price_monthly") return price;
    if (path === "checkout/sessions") {
      assert.equal(body.get("line_items[0][price]"), "price_monthly");
      assert.equal(body.get("payment_method_collection"), "if_required");
      assert.equal(body.get("subscription_data[trial_period_days]"), "7");
      assert.equal(body.get("subscription_data[trial_settings][end_behavior][missing_payment_method]"), "cancel");
      assert.equal(body.get("subscription_data[metadata][checkoutOption]"), "trial");
      assert.equal(body.get("allow_promotion_codes"), null);
      return { id: "cs_trial", url: "https://checkout.stripe.com/trial", expires_at: future / 1000 };
    }
    if (path === "checkout/sessions/cs_trial") return {
      mode: "subscription", client_reference_id: row._id, customer: "cus_test", subscription: "sub_test",
    };
    if (path.startsWith("subscriptions/sub_test")) return subscription({
      status: subscriptionStatus, trial_end: trialEnd / 1000, latest_invoice: null,
      metadata: { billingAccountId: row._id, checkoutOption: "trial" },
    });
    throw new Error(`Unexpected Stripe request ${path}`);
  }, async () => {
    assert.equal((await handler(billing.getStatus)(ctx, {})).canStartTrial, true);
    await handler(stripe.createCheckout)(ctx, { option: "trial" });
    await handler(stripe.confirmCheckout)(ctx, { sessionId: "cs_trial" });
    assert.equal((await handler(billing.getStatus)(ctx, {})).hasAccess, true);
    assert.equal(row.trialEndsAt, trialEnd);
    assert.equal(row.paidThrough, undefined);
    assert.equal(hasPaidPortalAccess(row, trialEnd), false);
    subscriptionStatus = "canceled";
    await handler(stripe.confirmCheckout)(ctx, { sessionId: "cs_trial" });
    assert.equal((await handler(billing.getStatus)(ctx, {})).hasAccess, false);
    assert.equal((await handler(billing.getStatus)(ctx, {})).canStartTrial, false);
    await assert.rejects(handler(stripe.createCheckout)(ctx, { option: "trial" }), /primeira assinatura/);
  });
});

test("Full checkout uses the active default monthly price on the configured product", async () => {
  const ctx = context();
  const row = ctx.tables.billingAccounts[0];
  row.status = "pending";
  delete row.stripeSubscriptionId;
  const product = process.env.STRIPE_FULL_PRODUCT_ID ?? "prod_Veu8nfnXHEiuWY";
  const fullPrice = { ...price, id: "price_full", product, unit_amount: 9990 };
  let defaultPrice = fullPrice;
  await withStripe((path, body) => {
    if (path.startsWith("subscriptions?") || path.startsWith("checkout/sessions?")) return { data: [] };
    if (path === `products/${product}?expand[]=default_price`) return { active: true, default_price: defaultPrice };
    if (path === "checkout/sessions") {
      assert.equal(body.get("line_items[0][price]"), "price_full");
      assert.equal(body.get("subscription_data[metadata][checkoutOption]"), "full");
      assert.equal(body.get("subscription_data[trial_period_days]"), null);
      return { id: "cs_full", url: "https://checkout.stripe.com/full", expires_at: future / 1000 };
    }
    if (path === "checkout/sessions/cs_full") return {
      mode: "subscription", client_reference_id: row._id, customer: "cus_test", subscription: "sub_test",
    };
    if (path.startsWith("subscriptions/sub_test")) return subscription({
      items: { data: [{ quantity: 1, price: fullPrice, current_period_end: future / 1000 }] },
      latest_invoice: {
        ...subscription().latest_invoice,
        lines: { data: [{ amount: 9990, price: fullPrice.id, period: { end: future / 1000 } }] },
      },
    });
    throw new Error(`Unexpected Stripe request ${path}`);
  }, async () => {
    defaultPrice = { ...fullPrice, unit_amount: 10000 };
    await assert.rejects(handler(stripe.createCheckout)(ctx, { option: "full" }), /não está disponível/);
    defaultPrice = fullPrice;
    await handler(stripe.createCheckout)(ctx, { option: "full" });
    await handler(stripe.confirmCheckout)(ctx, { sessionId: "cs_full" });
    const status = await handler(billing.getStatus)(ctx, {});
    assert.equal(status.hasAccess, true);
    assert.equal(status.plan.name, "Full");
  });
});

test("student creation counts legacy active records against the trial and Starter limits", async () => {
  const ctx = context();
  const billingAccount = ctx.tables.billingAccounts[0];
  const create = handler(createStudentWithoutAccount);
  const args = { name: "Aluno", gymId: "gym_1", unityId: "unity_1", belt: "White", degree: 0, picture: "" };
  ctx.tables.students.push(...Array.from({ length: 24 }, (_, i) => ({ _id: `legacy_${i}`, gymIds: ["gym_1"] })));
  billingAccount.status = "trialing";
  billingAccount.trialEndsAt = future;
  await create(ctx, args);
  await assert.rejects(create(ctx, args), /até 25 alunos ativos/);
  billingAccount.status = "active";
  ctx.tables.students.push(...Array.from({ length: 55 }, (_, i) => ({ _id: `starter_${i}`, gymIds: ["gym_1"] })));
  await assert.rejects(create(ctx, args), /até 80 alunos ativos/);
  await create(ctx, { ...args, plan: { type: "Mensal", startDate: "2026-11-01", isActive: false } });
  billingAccount.plan = "full";
  await create(ctx, args);
});
