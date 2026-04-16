import { useQuery } from "convex/react";

import { api } from "../../../lib/convex";

export function useUpcomingSessions(limit = 20) {
  return useQuery(api.classSessions.getUpcomingClassSessions, { limit });
}
