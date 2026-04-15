import { useQuery } from "convex/react";

import type { Id } from "../../../../../../packages/backend/convex/_generated/dataModel";
import { api } from "../../../../../../packages/backend/convex/_generated/api";

export function useSessionDetail(classSessionId: Id<"classSessions"> | null) {
  return useQuery(
    api.classSessions.getClassSessionDetail,
    classSessionId ? { classSessionId } : "skip"
  );
}
