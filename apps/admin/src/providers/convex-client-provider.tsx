"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useMemo } from "react";

import { env } from "@/utils/env";

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  const convexUrl = env.convexUrl;
  if (!convexUrl) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_CONVEX_URL");
  }

  const convex = useMemo(() => new ConvexReactClient(convexUrl), [convexUrl]);
  return <ConvexProviderWithClerk client={convex} useAuth={useAuth}>{children}</ConvexProviderWithClerk>;
}
