import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getAccessibleGymIds, requireAdmin } from "./lib/auth";

async function teamScope(ctx: QueryCtx | MutationCtx) {
  const {gymIds} = await getAccessibleGymIds(ctx);
  const gyms = await Promise.all([...gymIds].map(id=>ctx.db.get(id)));
  const linkedTeamIds = new Set(gyms.flatMap(gym=>gym?.teamId?[gym.teamId]:[]));
  return {gymIds, linkedTeamIds};
}

export const createTeam = mutation({
  args: {
    gymId: v.optional(v.id("gyms")), name: v.string(), leader: v.string(),
    logo: v.string(), history: v.string(), founded: v.string()
  },
  handler: async (ctx, {gymId: selectedGymId, ...args}) => {
    await requireAdmin(ctx);
    const {gymIds} = await getAccessibleGymIds(ctx);
    const gymId = selectedGymId ?? (gymIds.size===1 ? [...gymIds][0] : undefined);
    if (!gymId) throw new Error("Selecione a academia responsável pela equipe.");
    if (!gymIds.has(gymId)) throw new Error("Forbidden: academy access required");
    const gym = await ctx.db.get(gymId);
    if (!gym) throw new Error("Academia não encontrada.");
    const now = Date.now();
    const teamId = await ctx.db.insert("teams", {...args, ownerGymId: gymId, createdAt: now, updatedAt: now});
    if (!gym.teamId) await ctx.db.patch(gymId, {teamId, updatedAt: now});
    return teamId;
  }
});

export const updateTeam = mutation({
  args: {
    teamId: v.id("teams"), name: v.optional(v.string()), leader: v.optional(v.string()),
    logo: v.optional(v.string()), history: v.optional(v.string()), founded: v.optional(v.string())
  },
  handler: async (ctx, {teamId, ...patch}) => {
    await requireAdmin(ctx);
    const {gymIds, linkedTeamIds} = await teamScope(ctx);
    const team = await ctx.db.get(teamId);
    if (!team) throw new Error("Team not found");
    if (!(team.ownerGymId && gymIds.has(team.ownerGymId)) && !linkedTeamIds.has(teamId)) {
      throw new Error("Forbidden: team belongs to another academy");
    }
    await ctx.db.patch(teamId, {...patch, updatedAt: Date.now()});
    return teamId;
  }
});

export const getTeamById = query({
  args: {teamId: v.id("teams")},
  handler: async (ctx, {teamId}) => {
    const {gymIds, linkedTeamIds} = await teamScope(ctx);
    const team = await ctx.db.get(teamId);
    return team && ((team.ownerGymId && gymIds.has(team.ownerGymId)) || linkedTeamIds.has(teamId)) ? team : null;
  }
});

export const getAllTeams = query({
  args: {},
  handler: async ctx => {
    const {gymIds, linkedTeamIds} = await teamScope(ctx);
    const teams = await ctx.db.query("teams").collect();
    return teams.filter(team=>(team.ownerGymId && gymIds.has(team.ownerGymId)) || linkedTeamIds.has(team._id));
  }
});

// Recover a known legacy team after verifying its academy; never replace ownership.
export const recoverUnlinkedTeam = internalMutation({
  args: {teamId: v.id("teams"), gymId: v.id("gyms")},
  handler: async (ctx, {teamId, gymId}) => {
    const team = await ctx.db.get(teamId);
    const gym = await ctx.db.get(gymId);
    if (!team || !gym) throw new Error("Team or academy not found");
    if (team.ownerGymId && team.ownerGymId!==gymId) throw new Error("Team already belongs to another academy");
    const gyms = await ctx.db.query("gyms").collect();
    if (gyms.some(item=>item.teamId===teamId && item._id!==gymId)) throw new Error("Team is linked to another academy");
    await ctx.db.patch(teamId, {ownerGymId: gymId, updatedAt: Date.now()});
    if (!gym.teamId) await ctx.db.patch(gymId, {teamId, updatedAt: Date.now()});
    return teamId;
  }
});
