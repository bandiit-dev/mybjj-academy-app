import { ClerkProvider } from "@clerk/clerk-expo";
import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { PropsWithChildren, useMemo } from "react";

import { env } from "../utils/env";

export function AppProviders({ children }: PropsWithChildren) {
  const convex = useMemo(() => new ConvexReactClient(env.convexUrl), []);

  return (
    <ClerkProvider publishableKey={env.clerkPublishableKey}>
      <ConvexProvider client={convex}>{children}</ConvexProvider>
    </ClerkProvider>
  );
}
