"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { useMemo } from "react";

import { env } from "@/utils/env";

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  const convexUrl = env.convexUrl;
  if (!convexUrl) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_CONVEX_URL");
  }

  const convex = useMemo(() => new ConvexReactClient(convexUrl), [convexUrl]);
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
