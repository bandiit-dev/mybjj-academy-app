"use client";

import { useAuth } from "@clerk/nextjs";
import { api } from "@mybjj/backend/convex/_generated/api";
import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";

type BillingStatus = FunctionReturnType<typeof api.billing.getStatus>;

export function usePortalSubscription({enabled = true, gymId}: {enabled?: boolean; gymId?: Id<"gyms">} = {}) {
  const {userId, sessionId} = useAuth();
  const {isAuthenticated} = useConvexAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const previous = useRef<{scope: string; value: BillingStatus} | null>(null);
  const active = enabled && isAuthenticated && Boolean(userId && sessionId);
  const scope = JSON.stringify([userId, sessionId, gymId ?? null]);
  const result = useQuery(api.billing.getStatus, active ? {gymId, refreshKey} : "skip");

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setRefreshKey(value => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, [active]);

  // Changing the refresh argument temporarily returns undefined. Preserve the
  // mounted page during that background check, but never carry access across
  // sign-outs, sessions, academies, or a disabled subscription check.
  if (!active) {
    previous.current = null;
    return undefined;
  }
  if (result !== undefined) {
    previous.current = {scope, value: result};
    return result;
  }
  return previous.current?.scope === scope ? previous.current.value : undefined;
}
