import { useQuery } from "convex/react";

import { api } from "../../../../../../packages/backend/convex/_generated/api";

export function useTeacherUpcomingSessions(limit = 20) {
  return useQuery(api.classSessions.getTeacherUpcomingSessions, { limit });
}
