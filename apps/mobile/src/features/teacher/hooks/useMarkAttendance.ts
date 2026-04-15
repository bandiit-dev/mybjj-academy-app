import { useMutation } from "convex/react";

import { api } from "../../../../../../packages/backend/convex/_generated/api";

export function useMarkAttendance() {
  return useMutation(api.attendance.markAttendance);
}
