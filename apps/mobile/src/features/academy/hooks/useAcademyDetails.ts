import { useQuery } from "convex/react";

import { api } from "../../../lib/convex";

export function useAcademyDetails() {
  const gyms = useQuery(api.gyms.getAllGyms);
  const teams = useQuery(api.teams.getAllTeams);

  return {
    gyms,
    teams
  };
}
