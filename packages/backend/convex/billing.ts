import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentPrincipal } from "./lib/auth";
import { hasPaidPortalAccess, PORTAL_PLANS, stripeConfigured } from "./lib/portalBilling";

type Ctx = QueryCtx | MutationCtx;
async function billingContext(ctx: Ctx, selectedGymId?: Id<"gyms">) {
  const principal = await getCurrentPrincipal(ctx,{skipSubscription:true});
  if((principal.teacher||principal.student)&&!principal.isAdmin) throw new Error("Forbidden: admin role required");
  const gyms = new Set([...(principal.teacher?.gymIds??[]),...(principal.student?.gymIds??[])]);
  if(selectedGymId && !gyms.has(selectedGymId)) throw new Error("Forbidden: academy access required");
  let gymId = selectedGymId ?? [...gyms][0];
  if (!selectedGymId && gyms.size > 1) {
    const accounts = await Promise.all([...gyms].map(id => ctx.db.query("billingAccounts").withIndex("by_gymId", q => q.eq("gymId", id)).unique()));
    gymId = accounts.find(account => hasPaidPortalAccess(account))?.gymId ?? gymId;
  }
  const account = gymId
    ? await ctx.db.query("billingAccounts").withIndex("by_gymId",q=>q.eq("gymId",gymId)).unique()
    : (await ctx.db.query("billingAccounts").withIndex("by_owner",q=>q.eq("ownerClerkUserId",principal.identity.subject)).collect()).find(item=>!item.gymId) ?? null;
  return {account,gymId,principal,canManage:!account||account.ownerClerkUserId===principal.identity.subject};
}

async function trialAvailable(ctx: Ctx, owner: string, accountId?: Id<"billingAccounts">) {
  const accounts = await ctx.db.query("billingAccounts").withIndex("by_owner", q => q.eq("ownerClerkUserId", owner)).collect();
  return accounts.every(account =>
    !account.trialUsed && !account.stripeSubscriptionId &&
    (!account.trialCheckoutReserved || account._id === accountId)
  );
}

export const getStatus = query({
  args:{gymId:v.optional(v.id("gyms")),refreshKey:v.optional(v.number())},
  handler:async(ctx,{gymId})=>{
    if (!(await ctx.auth.getUserIdentity())?.subject) return null;
    const context=await billingContext(ctx,gymId);
    const account=context.account;
    return {
      hasAccess:hasPaidPortalAccess(account),canManage:context.canManage,configured:stripeConfigured(),
      plan: PORTAL_PLANS[account?.plan ?? "starter"],
      trialEndsAt: account?.trialEndsAt ?? null,
      canStartTrial: context.canManage && await trialAvailable(ctx, context.principal.identity.subject, account?._id),
      status:account?.status??"pending",paidThrough:account?.paidThrough??null,
      currentPeriodEnd:account?.currentPeriodEnd??null,cancelAtPeriodEnd:account?.cancelAtPeriodEnd??false,
      hasCustomer:Boolean(account?.stripeCustomerId),hasSubscription:Boolean(account?.stripeSubscriptionId),
      gymId:context.gymId??null
    };
  }
});

export const getCheckoutContext = internalQuery({
  args:{gymId:v.optional(v.id("gyms"))},handler:async (ctx,{gymId})=>{
    const context=await billingContext(ctx,gymId);
    const identity=await ctx.auth.getUserIdentity();
    return {...context,email:typeof identity?.email==="string"?identity.email:undefined};
  }
});

export const ensureAccount = internalMutation({
  args:{},handler:async ctx=>{
    const context=await billingContext(ctx);
    if(!context.canManage) throw new Error("Somente o responsável pela assinatura pode gerenciar o pagamento.");
    if(context.account) return context.account;
    const now=Date.now();
    const id=await ctx.db.insert("billingAccounts",{
      ownerClerkUserId:context.principal.identity.subject,gymId:context.gymId,status:"pending",
      checkoutAttempt:0,cancelAtPeriodEnd:false,stripeSyncedAt:0,lastEventCreated:0,createdAt:now,updatedAt:now
    });
    return (await ctx.db.get(id))!;
  }
});

export const setCustomer = internalMutation({
  args:{accountId:v.id("billingAccounts"),customerId:v.string()},
  handler:async(ctx,{accountId,customerId})=>{
    const context=await billingContext(ctx);
    if(!context.canManage||context.account?._id!==accountId) throw new Error("Forbidden");
    if(context.account.stripeCustomerId && context.account.stripeCustomerId!==customerId) throw new Error("Customer conflict");
    await ctx.db.patch(accountId,{stripeCustomerId:customerId,updatedAt:Date.now()});
  }
});

export const reserveCheckout = internalMutation({
  args:{accountId:v.id("billingAccounts"),trial:v.optional(v.boolean())},
  handler:async(ctx,{accountId,trial})=>{
    const context=await billingContext(ctx);
    if(!context.canManage||context.account?._id!==accountId) throw new Error("Forbidden");
    const account=context.account;
    if((account.checkoutLockUntil??0)>Date.now()) throw new ConvexError("O pagamento está sendo preparado. Aguarde alguns segundos e tente novamente.");
    if (trial && !await trialAvailable(ctx, account.ownerClerkUserId, accountId)) {
      throw new ConvexError("O teste de 7 dias está disponível apenas para a primeira assinatura.");
    }
    const attempt=account.checkoutAttempt+1;
    await ctx.db.patch(accountId,{checkoutAttempt:attempt,checkoutLockUntil:Date.now()+60000,...(trial?{trialCheckoutReserved:true}:{})});
    return attempt;
  }
});

export const finishCheckout = internalMutation({
  args:{accountId:v.id("billingAccounts"),attempt:v.number(),sessionId:v.optional(v.string()),expiresAt:v.optional(v.number())},
  handler:async(ctx,args)=>{
    const context=await billingContext(ctx);
    if(!context.canManage||context.account?._id!==args.accountId) throw new Error("Forbidden");
    if(context.account.checkoutAttempt!==args.attempt) return;
    await ctx.db.patch(args.accountId,{
      checkoutLockUntil:undefined,
      ...(args.sessionId?{checkoutSessionId:args.sessionId,checkoutExpiresAt:args.expiresAt}:{}),updatedAt:Date.now()
    });
  }
});

export const findAccount = internalQuery({
  args:{customerId:v.string()},
  handler:async(ctx,{customerId})=>ctx.db.query("billingAccounts").withIndex("by_customer",q=>q.eq("stripeCustomerId",customerId)).unique()
});

export const applyStripeSnapshot = internalMutation({
  args:{
    accountId:v.id("billingAccounts"),customerId:v.string(),subscriptionId:v.string(),status:v.string(),
    priceId:v.optional(v.string()),plan:v.optional(v.union(v.literal("starter"),v.literal("full"))),
    trialEndsAt:v.optional(v.number()),trialUsed:v.optional(v.boolean()),paidThrough:v.optional(v.number()),currentPeriodEnd:v.optional(v.number()),
    cancelAtPeriodEnd:v.boolean(),checkedAt:v.number(),eventId:v.optional(v.string()),eventType:v.optional(v.string()),eventCreated:v.optional(v.number())
  },
  handler:async(ctx,args)=>{
    if(args.eventId && await ctx.db.query("billingEvents").withIndex("by_eventId",q=>q.eq("eventId",args.eventId!)).unique()) return {duplicate:true};
    const account=await ctx.db.get(args.accountId);
    if(!account||account.stripeCustomerId!==args.customerId) throw new Error("Billing account/customer mismatch");
    const older=args.checkedAt<account.stripeSyncedAt || (args.eventCreated!==undefined && args.eventCreated<account.lastEventCreated);
    const terminal=account.stripeSubscriptionId===args.subscriptionId && ["canceled","incomplete_expired"].includes(account.status) && !["canceled","incomplete_expired"].includes(args.status);
    const differentLiveSubscription=account.stripeSubscriptionId && account.stripeSubscriptionId!==args.subscriptionId && !["canceled","incomplete_expired","pending"].includes(account.status);
    if(!older&&!terminal&&!differentLiveSubscription) {
      const sameSubscription=account.stripeSubscriptionId===args.subscriptionId && account.priceId===args.priceId;
      const paidThrough=Math.max(sameSubscription?(account.paidThrough??0):0,args.paidThrough??0)||undefined;
      await ctx.db.patch(account._id,{
        stripeSubscriptionId:args.subscriptionId,status:args.status,priceId:args.priceId,plan:args.plan,
        trialEndsAt:args.trialEndsAt,trialUsed:account.trialUsed || args.trialUsed || undefined,
        paidThrough,currentPeriodEnd:args.currentPeriodEnd,cancelAtPeriodEnd:args.cancelAtPeriodEnd,
        stripeSyncedAt:args.checkedAt,lastEventCreated:Math.max(account.lastEventCreated,args.eventCreated??0),updatedAt:Date.now()
      });
    }
    if(args.eventId) await ctx.db.insert("billingEvents",{eventId:args.eventId,type:args.eventType??"unknown",processedAt:Date.now()});
    return {duplicate:false};
  }
});

export const recordIgnoredEvent = internalMutation({
  args:{eventId:v.string(),type:v.string()},handler:async(ctx,args)=>{
    if(!await ctx.db.query("billingEvents").withIndex("by_eventId",q=>q.eq("eventId",args.eventId)).unique()) {
      await ctx.db.insert("billingEvents",{...args,processedAt:Date.now()});
    }
  }
});
