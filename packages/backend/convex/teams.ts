import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";

import { getAccessibleGymIds, requireAdmin } from "./lib/auth";

export const createTeam = mutation({
  args: {
    name: v.string(),
    leader: v.string(),
    logo: v.string(),
    history: v.string(),
    founded: v.string()
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();

    return ctx.db.insert("teams", {
      ...args,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateTeam = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    leader: v.optional(v.string()),
    logo: v.optional(v.string()),
    history: v.optional(v.string()),
    founded: v.optional(v.string())
  },
  handler: async (ctx, { teamId, ...patch }) => {
    await requireAdmin(ctx);

    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    await ctx.db.patch(teamId, {
      ...patch,
      updatedAt: Date.now()
    });

    return teamId;
  }
});

export const getTeamById = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => ctx.db.get(teamId)
});

export const getAllTeams = query({
  args: {},
  handler: async (ctx) => {
    const { gymIds } = await getAccessibleGymIds(ctx);
    const gyms = await Promise.all([...gymIds].map((gymId) => ctx.db.get(gymId)));
    const teamIds = new Set(gyms.flatMap((gym) => gym?.teamId ? [gym.teamId] : []));
    const teams = await Promise.all([...teamIds].map((teamId) => ctx.db.get(teamId)));
    return teams.filter((team) => team !== null);
  }
});
