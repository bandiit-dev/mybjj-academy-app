import { useQuery } from "convex/react";

import type { Id } from "../../../lib/convex";
import { api } from "../../../lib/convex";

export function useSessionAttendance(classSessionId: Id<"classSessions"> | null) {
  return useQuery(api.attendance.getSessionAttendance, classSessionId ? { classSessionId } : "skip");
}
