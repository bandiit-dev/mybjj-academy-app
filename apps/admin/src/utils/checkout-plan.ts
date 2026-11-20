import type { CheckoutOption } from "@mybjj/backend/convex/lib/portalBilling";

export function parseCheckoutPlan(value: string | null): CheckoutOption | null {
  return value === "trial" || value === "starter" || value === "full"
    ? value
    : null;
}

export const pendingCheckoutPlanKey = "mybjj.checkout-plan";
