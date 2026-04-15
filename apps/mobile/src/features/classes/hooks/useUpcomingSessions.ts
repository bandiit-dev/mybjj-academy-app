import { useQuery } from "convex/react";

import { api } from "../../../../../../packages/backend/convex/_generated/api";

export function useUpcomingSessions(limit = 20) {
  return useQuery(api.classSessions.getUpcomingClassSessions, { limit });
}
