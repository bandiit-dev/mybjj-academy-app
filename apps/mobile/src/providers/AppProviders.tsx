import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { useMemo, type ReactNode } from "react";

import { env } from "../utils/env";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const convex = useMemo(() => new ConvexReactClient(env.convexUrl), []);

  return <ConvexProvider client={convex}>{children as any}</ConvexProvider>;
}
