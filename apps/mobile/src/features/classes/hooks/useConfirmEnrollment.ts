import { useMutation } from "convex/react";

import { api } from "../../../lib/convex";

export function useConfirmEnrollment() {
  return useMutation(api.enrollments.confirmEnrollment);
}
