import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";

import { requireAdmin } from "./lib/auth";

export const createGym = mutation({
  args: {
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
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateGym = mutation({
  args: {
    gymId: v.id("gyms"),
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
      updatedAt: Date.now()
    });

    return gymId;
  }
});

export const getGymById = query({
  args: { gymId: v.id("gyms") },
  handler: async (ctx, { gymId }) => ctx.db.get(gymId)
});

export const getAllGyms = query({
  args: {},
  handler: async (ctx) => ctx.db.query("gyms").collect()
});
