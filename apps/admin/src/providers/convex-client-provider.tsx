"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { useMemo } from "react";

import { env } from "@/utils/env";

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  const convex = useMemo(() => new ConvexReactClient(env.convexUrl), []);
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
