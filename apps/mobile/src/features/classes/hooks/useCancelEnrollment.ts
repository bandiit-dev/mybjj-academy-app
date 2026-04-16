import { useMutation } from "convex/react";

import { api } from "../../../lib/convex";

export function useCancelEnrollment() {
  return useMutation(api.enrollments.cancelEnrollment);
}
