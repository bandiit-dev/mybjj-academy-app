import { useMutation } from "convex/react";

import { api } from "../../../../../../packages/backend/convex/_generated/api";

export function useConfirmEnrollment() {
  return useMutation(api.enrollments.confirmEnrollment);
}
