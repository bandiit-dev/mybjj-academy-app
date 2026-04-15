import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";

import { requireAdmin } from "./lib/auth";

export const createUnity = mutation({
  args: {
    address: v.string(),
    gymId: v.union(v.id("gyms"), v.null())
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx as never);
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
    address: v.optional(v.string()),
    gymId: v.optional(v.union(v.id("gyms"), v.null()))
  },
  handler: async (ctx, { unityId, ...patch }) => {
    await requireAdmin(ctx as never);

    const unity = await ctx.db.get(unityId);
    if (!unity) {
      throw new Error("Unity not found");
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
  handler: async (ctx, { unityId }) => ctx.db.get(unityId)
});

export const getAllUnities = query({
  args: {},
  handler: async (ctx) => ctx.db.query("unities").collect()
});
