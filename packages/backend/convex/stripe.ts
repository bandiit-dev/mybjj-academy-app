import { ConvexError, v } from "convex/values";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { billingConfiguration, stripeId, stripeRequest, subscriptionSnapshot, validPortalPrice, type StripeData } from "./lib/stripeApi";

async function applySubscription(ctx:ActionCtx,account:Doc<"billingAccounts">,subscriptionId:string,event?:{id:string;type:string;created:number}) {
  const {billingAccountId,...snapshot}=await subscriptionSnapshot(subscriptionId);
  if(snapshot.customerId!==account.stripeCustomerId || billingAccountId!==account._id) throw new Error("Subscription ownership mismatch");
  await ctx.runMutation(internal.billing.applyStripeSnapshot,{
    ...snapshot,accountId:account._id,...(event?{eventId:event.id,eventType:event.type,eventCreated:event.created}:{})
  });
  return snapshot;
}
async function portalUrl(account:Doc<"billingAccounts">) {
  if(!account.stripeCustomerId) throw new ConvexError("Nenhuma assinatura foi encontrada para gerenciar.");
  const result=await stripeRequest("billing_portal/sessions",{customer:account.stripeCustomerId,return_url:`${billingConfiguration().appUrl}/assinatura`});
  return {url:String(result.url)};
}

export const createCheckout = action({
  args:{},handler:async(ctx):Promise<{url:string}>=>{
    const config=billingConfiguration();
    const context=await ctx.runQuery(internal.billing.getCheckoutContext,{});
    if(!context.canManage) throw new ConvexError("Somente o responsável pela assinatura pode gerenciar o pagamento.");
    const account=await ctx.runMutation(internal.billing.ensureAccount,{});
    if(account.stripeSubscriptionId && !["canceled","incomplete_expired"].includes(account.status)) return portalUrl(account);
    const attempt=await ctx.runMutation(internal.billing.reserveCheckout,{accountId:account._id});
    try {
      let customerId=account.stripeCustomerId;
      if(!customerId) {
        const customer=await stripeRequest("customers",{
          "metadata[billingAccountId]":account._id,"metadata[ownerClerkUserId]":account.ownerClerkUserId,
          ...(context.email?{email:context.email}:{})
        },`customer:${account._id}`);
        customerId=customer.id;
        await ctx.runMutation(internal.billing.setCustomer,{accountId:account._id,customerId:customerId!});
      }
      if(account.checkoutSessionId) {
        const previous=await stripeRequest(`checkout/sessions/${encodeURIComponent(account.checkoutSessionId)}`);
        if(previous.status==="open" && previous.expires_at*1000>Date.now() && previous.url) return {url:previous.url};
        if(previous.status==="complete" && stripeId(previous.subscription)) {
          const snapshot = await applySubscription(ctx,{...account,stripeCustomerId:customerId},stripeId(previous.subscription)!);
          if (!["canceled", "incomplete_expired"].includes(snapshot.status)) return {url:`${config.appUrl}/assinatura?checkout=success`};
        }
      }
      const subscriptions=await stripeRequest(`subscriptions?customer=${encodeURIComponent(customerId!)}&status=all&limit=100`);
      const existing=subscriptions.data?.find((sub:StripeData)=>sub.metadata?.billingAccountId===account._id && !["canceled","incomplete_expired"].includes(sub.status));
      if(existing) {
        await applySubscription(ctx,{...account,stripeCustomerId:customerId},existing.id);
        return portalUrl({...account,stripeCustomerId:customerId});
      }
      // Recover a session whose creation succeeded before a network timeout.
      const openSessions=await stripeRequest(`checkout/sessions?customer=${encodeURIComponent(customerId!)}&status=open&limit=100`);
      const openSession=openSessions.data?.find((session:StripeData)=>session.client_reference_id===account._id && session.mode==="subscription" && session.expires_at*1000>Date.now() && session.url);
      if(openSession) {
        await ctx.runMutation(internal.billing.finishCheckout,{accountId:account._id,attempt,sessionId:openSession.id,expiresAt:openSession.expires_at*1000});
        return {url:openSession.url};
      }
      const price=await stripeRequest(`prices/${encodeURIComponent(config.priceId)}`);
      if(!price.active||!validPortalPrice(price)) throw new ConvexError("O plano de pagamento não está disponível. Entre em contato com o suporte.");
      const session=await stripeRequest("checkout/sessions",{
        mode:"subscription",customer:customerId!,client_reference_id:account._id,locale:"pt-BR",
        "line_items[0][price]":config.priceId,"line_items[0][quantity]":"1","payment_method_types[0]":"card",
        "metadata[billingAccountId]":account._id,"subscription_data[metadata][billingAccountId]":account._id,
        success_url:`${config.appUrl}/assinatura?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:`${config.appUrl}/assinatura?checkout=cancelled`
      },`checkout:${account._id}:${attempt}`);
      if(!session.url) throw new Error("Missing checkout URL");
      await ctx.runMutation(internal.billing.finishCheckout,{accountId:account._id,attempt,sessionId:session.id,expiresAt:session.expires_at*1000});
      return {url:session.url};
    } finally {
      await ctx.runMutation(internal.billing.finishCheckout,{accountId:account._id,attempt});
    }
  }
});

export const createPortal = action({
  args:{gymId:v.optional(v.id("gyms"))},handler:async(ctx,{gymId}):Promise<{url:string}>=>{
    billingConfiguration();
    const context=await ctx.runQuery(internal.billing.getCheckoutContext,{gymId});
    if(!context.canManage||!context.account) throw new ConvexError("Somente o responsável pela assinatura pode gerenciar o pagamento.");
    return portalUrl(context.account);
  }
});

export const confirmCheckout = action({
  args:{sessionId:v.string()},handler:async(ctx,{sessionId}):Promise<{verified:boolean}>=>{
    billingConfiguration();
    const context=await ctx.runQuery(internal.billing.getCheckoutContext,{});
    if(!context.canManage||!context.account?.stripeCustomerId||!/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) throw new Error("Forbidden");
    const session=await stripeRequest(`checkout/sessions/${encodeURIComponent(sessionId)}`);
    if(session.mode!=="subscription"||session.client_reference_id!==context.account._id||stripeId(session.customer)!==context.account.stripeCustomerId) throw new Error("Checkout ownership mismatch");
    const subscriptionId=stripeId(session.subscription);
    if(!subscriptionId) return {verified:false};
    await applySubscription(ctx,context.account,subscriptionId);
    return {verified:true};
  }
});

const eventTypes=new Set(["checkout.session.completed","checkout.session.async_payment_succeeded","invoice.paid","invoice.payment_failed","invoice.payment_action_required","customer.subscription.created","customer.subscription.updated","customer.subscription.deleted","customer.subscription.paused","customer.subscription.resumed"]);
export const processWebhook = internalAction({
  args:{event:v.string()},handler:async(ctx,{event}):Promise<void>=>{
    const parsed=JSON.parse(event) as {id:string;type:string;created:number;data:{object:StripeData}};
    if(!eventTypes.has(parsed.type)) {await ctx.runMutation(internal.billing.recordIgnoredEvent,{eventId:parsed.id,type:parsed.type});return;}
    const object=parsed.data.object;
    const customerId=stripeId(object.customer);
    const subscriptionId=parsed.type.startsWith("customer.subscription.")?object.id:stripeId(object.parent?.subscription_details?.subscription??object.subscription);
    if(!customerId||!subscriptionId) {await ctx.runMutation(internal.billing.recordIgnoredEvent,{eventId:parsed.id,type:parsed.type});return;}
    const account=await ctx.runQuery(internal.billing.findAccount,{customerId});
    if(!account) {await ctx.runMutation(internal.billing.recordIgnoredEvent,{eventId:parsed.id,type:parsed.type});return;}
    await applySubscription(ctx,account,subscriptionId,parsed);
  }
});
