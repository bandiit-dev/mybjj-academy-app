import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";

import { getAccessibleGymIds, requireAdmin } from "./lib/auth";

async function withTeamName(ctx: Pick<QueryCtx, "db">, gym: Doc<"gyms">) {
  // Prefill the free-text field from an existing affiliation until it is edited.
  const team = gym.teamName === undefined && gym.teamId ? await ctx.db.get(gym.teamId) : null;
  return {...gym, teamName: gym.teamName ?? team?.name ?? ""};
}

export const createGym = mutation({
  args: {
    teamName: v.optional(v.string()),
    name: v.string(),
    cnpj: v.string(),
    phone: v.string(),
    email: v.string(),
    unityIds: v.array(v.id("unities")),
    founded: v.string(),
    teamId: v.union(v.id("teams"), v.null()),
    branding: v.object({
      logoUrl: v.optional(v.string()),
      primaryColor: v.optional(v.string()),
      secondaryColor: v.optional(v.string())
    }),
    teacherIds: v.array(v.id("teachers"))
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();

    return ctx.db.insert("gyms", {
      ...args,
      ...(args.teamName !== undefined ? {teamName: args.teamName.trim()} : {}),
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateGym = mutation({
  args: {
    gymId: v.id("gyms"),
    teamName: v.optional(v.string()),
    name: v.optional(v.string()),
    cnpj: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    unityIds: v.optional(v.array(v.id("unities"))),
    founded: v.optional(v.string()),
    teamId: v.optional(v.union(v.id("teams"), v.null())),
    branding: v.optional(
      v.object({
        logoUrl: v.optional(v.string()),
        primaryColor: v.optional(v.string()),
        secondaryColor: v.optional(v.string())
      })
    ),
    teacherIds: v.optional(v.array(v.id("teachers")))
  },
  handler: async (ctx, { gymId, ...patch }) => {
    await requireAdmin(ctx);

    const gym = await ctx.db.get(gymId);
    if (!gym) {
      throw new Error("Gym not found");
    }

    await ctx.db.patch(gymId, {
      ...patch,
      ...(patch.teamName !== undefined ? {teamName: patch.teamName.trim()} : {}),
      updatedAt: Date.now()
    });

    return gymId;
  }
});

export const getGymById = query({
  args: { gymId: v.id("gyms") },
  handler: async (ctx, { gymId }) => {
    const gym = await ctx.db.get(gymId);
    return gym ? withTeamName(ctx, gym) : null;
  }
});

export const getAllGyms = query({
  args: {},
  handler: async (ctx) => {
    const { gymIds } = await getAccessibleGymIds(ctx);
    const gyms = await Promise.all([...gymIds].map((gymId) => ctx.db.get(gymId)));
    return Promise.all(gyms.filter((gym) => gym !== null).map(gym => withTeamName(ctx, gym)));
  }
});
