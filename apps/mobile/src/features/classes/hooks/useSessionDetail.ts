import { useQuery } from "convex/react";

import type { Id } from "../../../lib/convex";
import { api } from "../../../lib/convex";

export function useSessionDetail(classSessionId: Id<"classSessions"> | null) {
  return useQuery(api.classSessions.getClassSessionDetail, classSessionId ? { classSessionId } : "skip");
}
