import { useQuery } from "convex/react";

import type { Id } from "../../../lib/convex";
import { api } from "../../../lib/convex";

export function useSessionRoster(classSessionId: Id<"classSessions"> | null) {
  return useQuery(api.enrollments.getSessionRoster, classSessionId ? { classSessionId } : "skip");
}
