import { ConvexError, v } from "convex/values";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { billingConfiguration, checkoutPrice, stripeId, stripeRequest, subscriptionSnapshot, type StripeData } from "./lib/stripeApi";

const terminalStatuses = ["canceled", "incomplete_expired"];
const checkoutOptionValidator = v.union(v.literal("starter"), v.literal("full"), v.literal("trial"));

async function applySubscription(ctx:ActionCtx,account:Doc<"billingAccounts">,subscriptionId:string,event?:{id:string;type:string;created:number}) {
  const {billingAccountId,...snapshot}=await subscriptionSnapshot(subscriptionId);
  if(snapshot.customerId!==account.stripeCustomerId || billingAccountId!==account._id) throw new Error("Subscription ownership mismatch");
  await ctx.runMutation(internal.billing.applyStripeSnapshot,{
    ...snapshot,accountId:account._id,...(event?{eventId:event.id,eventType:event.type,eventCreated:event.created}:{})
  });
  return snapshot;
}
async function portalUrl(account:Doc<"billingAccounts">) {
  if (account.status === "trialing") throw new ConvexError("O teste termina automaticamente. Escolha um plano após o encerramento.");
  if(!account.stripeCustomerId || !account.stripeSubscriptionId) throw new ConvexError("Nenhuma assinatura foi encontrada para gerenciar.");
  const result=await stripeRequest("billing_portal/sessions",{customer:account.stripeCustomerId,return_url:`${billingConfiguration().appUrl}/assinatura`});
  return {url:String(result.url)};
}

async function assertOwnerSignup(ctx: ActionCtx, principal: { teacher: unknown; student: unknown }) {
  if (principal.teacher || principal.student) return;
  const resolved = await ctx.runAction(api.onboarding.resolvePortalAccount, {});
  if (resolved.status !== "needs_academy") {
    throw new ConvexError("Somente o responsável pela assinatura pode gerenciar o pagamento.");
  }
}

export const createCheckout = action({
  args:{promotionCode:v.optional(v.string()),option:v.optional(checkoutOptionValidator)},handler:async(ctx,{promotionCode,option="starter"}):Promise<{url:string}>=>{
    const trial = option === "trial";
    const code = promotionCode?.trim() ?? "";
    if(code.length>100) throw new ConvexError("O cupom deve ter no máximo 100 caracteres.");
    const config=billingConfiguration();
    const successUrl=`${config.appUrl}/assinatura?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${config.appUrl}/assinatura?checkout=cancelled${option === "starter" ? "" : `&plano=${option}`}`;
    const context=await ctx.runQuery(internal.billing.getCheckoutContext,{});
    if(!context.canManage) throw new ConvexError("Somente o responsável pela assinatura pode gerenciar o pagamento.");
    await assertOwnerSignup(ctx, context.principal);
    const account=await ctx.runMutation(internal.billing.ensureAccount,{});
    if (!trial && account.stripeSubscriptionId && account.status !== "trialing" && !terminalStatuses.includes(account.status)) return portalUrl(account);
    const attempt=await ctx.runMutation(internal.billing.reserveCheckout,{accountId:account._id,trial});
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
      let promotionCodeId:string|undefined;
      if(code) {
        const promotions=await stripeRequest(`promotion_codes?code=${encodeURIComponent(code)}&active=true&limit=100`);
        const eligible=(promotions.data??[]).filter((promo:StripeData)=>promo.active &&
          typeof promo.code==="string" && promo.code.toLowerCase()===code.toLowerCase() &&
          (!promo.customer || stripeId(promo.customer)===customerId) &&
          (!promo.expires_at || promo.expires_at*1000>Date.now()) &&
          (promo.max_redemptions==null || promo.times_redeemed<promo.max_redemptions));
        const promotion=eligible.find((promo:StripeData)=>stripeId(promo.customer)===customerId)??eligible[0];
        if(!promotion) throw new ConvexError("Cupom inválido, expirado ou indisponível para sua conta.");
        if ((trial || account.trialUsed) && promotion.restrictions?.first_time_transaction) {
          throw new ConvexError("Este cupom só vale antes da primeira assinatura e não pode ser usado após o teste grátis.");
        }
        promotionCodeId=promotion.id;
      }
      const matchesPromotion=(session:StripeData)=>trial || (promotionCodeId
        ? session.metadata?.promotionCodeId===promotionCodeId
        : !session.metadata?.promotionCodeId && session.allow_promotion_codes===true);
      const matchesCheckout=(session:StripeData)=> (session.metadata?.checkoutOption ?? "starter") === option && matchesPromotion(session) && session.success_url===successUrl && session.cancel_url===cancelUrl;
      async function saveCheckoutSession(session: StripeData) {
        await ctx.runMutation(internal.billing.finishCheckout, {
          accountId: account._id,
          attempt,
          sessionId: session.id,
          expiresAt: session.expires_at * 1000,
          ...(trial ? { trialPromotionCode: code || null } : {}),
        });
      }
      if(account.checkoutSessionId) {
        const previous=await stripeRequest(`checkout/sessions/${encodeURIComponent(account.checkoutSessionId)}`);
        if(previous.status==="open" && previous.expires_at*1000>Date.now() && previous.url) {
          if(matchesCheckout(previous)) {
            if (trial) await saveCheckoutSession(previous);
            return {url:previous.url};
          }
          await stripeRequest(`checkout/sessions/${encodeURIComponent(previous.id??account.checkoutSessionId)}/expire`,{});
        }
        if(previous.status==="complete" && stripeId(previous.subscription)) {
          const snapshot = await applySubscription(ctx,{...account,stripeCustomerId:customerId},stripeId(previous.subscription)!);
          if (snapshot.status === "trialing" && (snapshot.trialEndsAt ?? 0) <= Date.now()) {
            throw new ConvexError("Estamos confirmando o encerramento do teste. Tente novamente em instantes.");
          }
          if (!terminalStatuses.includes(snapshot.status)) return {url:`${config.appUrl}/assinatura?checkout=success`};
        }
      }
      const subscriptions=await stripeRequest(`subscriptions?customer=${encodeURIComponent(customerId!)}&status=all&limit=100`);
      const ownedSubscriptions = (subscriptions.data ?? []).filter((sub: StripeData) => sub.metadata?.billingAccountId === account._id);
      const existing = ownedSubscriptions.find((sub: StripeData) => !terminalStatuses.includes(sub.status));
      if(existing) {
        const snapshot = await applySubscription(ctx,{...account,stripeCustomerId:customerId},existing.id);
        return portalUrl({...account,...snapshot,stripeCustomerId:customerId,stripeSubscriptionId:existing.id});
      }
      if (trial && subscriptions.data?.length) throw new ConvexError("O teste de 7 dias está disponível apenas para a primeira assinatura.");
      // Recover a session whose creation succeeded before a network timeout.
      const openSessions=await stripeRequest(`checkout/sessions?customer=${encodeURIComponent(customerId!)}&status=open&limit=100`);
      const ownedSessions=(openSessions.data??[]).filter((session:StripeData)=>session.client_reference_id===account._id && session.mode==="subscription" && session.expires_at*1000>Date.now() && session.url);
      for(const session of ownedSessions) {
        if(!matchesCheckout(session)) await stripeRequest(`checkout/sessions/${encodeURIComponent(session.id)}/expire`,{});
      }
      const openSession=ownedSessions.find(matchesCheckout);
      if(openSession) {
        await saveCheckoutSession(openSession);
        return {url:openSession.url};
      }
      const priceId = await checkoutPrice(option === "full" ? "full" : "starter");
      const session=await stripeRequest("checkout/sessions",{
        mode:"subscription",customer:customerId!,client_reference_id:account._id,locale:"pt-BR",
        ...(trial ? {
          payment_method_collection: "if_required",
          "subscription_data[trial_period_days]": "7",
          "subscription_data[trial_settings][end_behavior][missing_payment_method]": "cancel",
        } : promotionCodeId ? {
          "discounts[0][promotion_code]": promotionCodeId, "metadata[promotionCodeId]": promotionCodeId,
        } : {allow_promotion_codes:"true"}),
        "line_items[0][price]":priceId,"line_items[0][quantity]":"1","allowed_payment_method_types[0]":"card",
        "metadata[billingAccountId]":account._id,"subscription_data[metadata][billingAccountId]":account._id,
        "metadata[checkoutOption]": option, "subscription_data[metadata][checkoutOption]": option,
        success_url:successUrl,
        cancel_url:cancelUrl
      },`checkout:${account._id}:${attempt}`);
      if(!session.url) throw new Error("Missing checkout URL");
      await saveCheckoutSession(session);
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
    await assertOwnerSignup(ctx, context.principal);
    return portalUrl(context.account);
  }
});

export const confirmCheckout = action({
  args:{sessionId:v.string()},handler:async(ctx,{sessionId}):Promise<{verified:boolean}>=>{
    billingConfiguration();
    const context=await ctx.runQuery(internal.billing.getCheckoutContext,{});
    if(!context.canManage||!context.account?.stripeCustomerId||!/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) throw new Error("Forbidden");
    await assertOwnerSignup(ctx, context.principal);
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
