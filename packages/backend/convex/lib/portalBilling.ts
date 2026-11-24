import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

export const PORTAL_PLANS = {
  starter: { name: "Starter", amount: 3990, currency: "brl", interval: "month", studentLimit: 50 },
  full: { name: "Full", amount: 9990, currency: "brl", interval: "month", studentLimit: null },
} as const;
export type PortalPlan = keyof typeof PORTAL_PLANS;
export type CheckoutOption = PortalPlan | "trial";
export const TRIAL_STUDENT_LIMIT = 25;
export const fullProductId = () => process.env.STRIPE_FULL_PRODUCT_ID ?? "prod_Veu8nfnXHEiuWY";
export type BillingReader = Pick<QueryCtx | MutationCtx,"db">;

export function hasPaidPortalAccess(account: Pick<Doc<"billingAccounts">,"status"|"paidThrough"|"priceId"|"trialEndsAt"> | null, now=Date.now()) {
  return Boolean(account?.priceId && (account.status === "trialing" ? (account.trialEndsAt ?? 0) > now : ["active","past_due"].includes(account.status) && (account.paidThrough??0)>now));
}

export function subscriptionRequired(): never {
  throw new ConvexError({code:"SUBSCRIPTION_REQUIRED",message:"Assine ou regularize o plano para acessar o portal."});
}

export async function paidGymIds(ctx: BillingReader, gymIds: Iterable<Id<"gyms">>) {
  const paid = new Set<Id<"gyms">>();
  await Promise.all([...gymIds].map(async gymId=>{
    const account = await ctx.db.query("billingAccounts").withIndex("by_gymId",q=>q.eq("gymId",gymId)).unique();
    if(hasPaidPortalAccess(account)) paid.add(gymId);
  }));
  if(!paid.size) subscriptionRequired();
  return paid;
}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_MONTHLY_PRICE_ID && process.env.APP_URL);
}
