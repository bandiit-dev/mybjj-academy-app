import { useQuery } from "convex/react";

import { api } from "../../../lib/convex";

export function useUnities() {
  return useQuery(api.unities.getAllUnities);
}
