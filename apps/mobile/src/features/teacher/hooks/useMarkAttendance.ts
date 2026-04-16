import { useMutation } from "convex/react";

import { api } from "../../../lib/convex";

export function useMarkAttendance() {
  return useMutation(api.attendance.markAttendance);
}
