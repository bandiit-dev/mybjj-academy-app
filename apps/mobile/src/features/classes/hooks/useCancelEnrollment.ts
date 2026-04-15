import { useMutation } from "convex/react";

import { api } from "../../../../../../packages/backend/convex/_generated/api";

export function useCancelEnrollment() {
  return useMutation(api.enrollments.cancelEnrollment);
}
