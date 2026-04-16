import { useQuery } from "convex/react";

import { api } from "../../../lib/convex";

export function useTeachers() {
  return useQuery(api.teachers.getAllTeachers);
}
