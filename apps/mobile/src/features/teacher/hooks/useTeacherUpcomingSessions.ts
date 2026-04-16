import { useQuery } from "convex/react";

import { api } from "../../../lib/convex";

export function useTeacherUpcomingSessions(limit = 20) {
  return useQuery(api.classSessions.getTeacherUpcomingSessions, { limit });
}
