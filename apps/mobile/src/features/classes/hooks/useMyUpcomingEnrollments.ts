import { useQuery } from "convex/react";

import { api } from "../../../lib/convex";

export function useMyUpcomingEnrollments() {
  return useQuery(api.enrollments.getMyUpcomingEnrollments);
}
