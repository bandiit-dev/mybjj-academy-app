import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";

import { getAccessibleGymIds, requireAdmin } from "./lib/auth";

export const createUnity = mutation({
  args: {
    name: v.string(),
    address: v.string(),
    gymId: v.union(v.id("gyms"), v.null())
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();

    return ctx.db.insert("unities", {
      ...args,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateUnity = mutation({
  args: {
    unityId: v.id("unities"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    gymId: v.optional(v.union(v.id("gyms"), v.null()))
  },
  handler: async (ctx, { unityId, ...patch }) => {
    const principal = await requireAdmin(ctx);

    const unity = await ctx.db.get(unityId);
    if (!unity) {
      throw new Error("Unity not found");
    }

    const adminGymIds = new Set([...(principal.teacher?.gymIds ?? []), ...(principal.student?.gymIds ?? [])]);
    if (unity.gymId === null || !adminGymIds.has(unity.gymId)) {
      throw new Error("Forbidden: unit belongs to another academy");
    }

    await ctx.db.patch(unityId, {
      ...patch,
      updatedAt: Date.now()
    });

    return unityId;
  }
});

export const getUnityById = query({
  args: { unityId: v.id("unities") },
  handler: async (ctx, { unityId }) => {
    const { gymIds } = await getAccessibleGymIds(ctx);
    const unity = await ctx.db.get(unityId);
    return unity?.gymId !== null && unity?.gymId !== undefined && gymIds.has(unity.gymId) ? unity : null;
  }
});

export const getAllUnities = query({
  args: {},
  handler: async (ctx) => {
    const { gymIds } = await getAccessibleGymIds(ctx);
    const unities = await ctx.db.query("unities").collect();
    return unities.filter((unity) => unity.gymId !== null && gymIds.has(unity.gymId));
  }
});
