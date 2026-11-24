import { assertAdminGymScope } from "./lib/auth";
import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { assertDegree, beltValidator, teacherClassTypeValidator } from "./lib/validators";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import {
  getAccessibleGymIds,
  getCurrentPrincipal,
  requireAdmin,
  requireTeacherOrAdmin
} from "./lib/auth";

const userTypeValidator = v.union(v.literal("Normal"), v.literal("Admin"));

export const createTeacher = mutation({
  args: {
    clerkUserId: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    belt: beltValidator,
    degree: v.number(),
    gymIds: v.array(v.id("gyms")),
    unityIds: v.array(v.id("unities")),
    role: v.string(),
    picture: v.string(),
    classType: teacherClassTypeValidator,
    classIds: v.array(v.id("classes")),
    userType: userTypeValidator
  },
  handler: async (ctx, args) => {
    const principal = await requireAdmin(ctx);
    assertAdminGymScope(principal, args.gymIds);
    assertDegree(args.degree);
    const now = Date.now();

    return ctx.db.insert("teachers", {
      ...args,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateTeacher = mutation({
  args: {
    teacherId: v.id("teachers"),
    clerkUserId: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    belt: v.optional(beltValidator),
    degree: v.optional(v.number()),
    gymIds: v.optional(v.array(v.id("gyms"))),
    unityIds: v.optional(v.array(v.id("unities"))),
    role: v.optional(v.string()),
    picture: v.optional(v.string()),
    classType: v.optional(teacherClassTypeValidator),
    classIds: v.optional(v.array(v.id("classes"))),
    userType: v.optional(userTypeValidator)
  },
  handler: async (ctx, { teacherId, ...patch }) => {
    const authResult = await requireTeacherOrAdmin(ctx, teacherId);

    if (patch.degree !== undefined) {
      assertDegree(patch.degree);
    }

    const isAdmin = authResult.isAdmin;

    if (!isAdmin) {
      const selfPatch: Record<string, unknown> = {};

      if (patch.name !== undefined) selfPatch.name = patch.name;
      if (patch.email !== undefined) selfPatch.email = patch.email;
      if (patch.phone !== undefined) selfPatch.phone = patch.phone;
      if (patch.picture !== undefined) selfPatch.picture = patch.picture;

      await ctx.db.patch(teacherId, {
        ...selfPatch,
        updatedAt: Date.now()
      });

      return teacherId;
    }

    if (patch.clerkUserId !== undefined && patch.clerkUserId !== authResult.targetTeacher.clerkUserId) {
      throw new Error("Forbidden: use the invitation flow to link teacher accounts");
    }
    if (patch.gymIds) assertAdminGymScope(authResult, patch.gymIds);
    const adminGymIds = new Set([...(authResult.teacher?.gymIds ?? []), ...(authResult.student?.gymIds ?? [])]);
    if (!authResult.targetTeacher.gymIds.every((gymId: Id<"gyms">) => adminGymIds.has(gymId))) {
      throw new Error("Forbidden: teacher belongs to another academy");
    }

    await ctx.db.patch(teacherId, {
      ...patch,
      updatedAt: Date.now()
    });

    return teacherId;
  }
});

export const getTeacherById = query({
  args: { teacherId: v.id("teachers") },
  handler: async (ctx, { teacherId }) => {
    const { gymIds } = await getAccessibleGymIds(ctx);
    const teacher = await ctx.db.get(teacherId);
    return teacher?.gymIds.some((gymId: Id<"gyms">) => gymIds.has(gymId)) ? teacher : null;
  }
});

export const getAllTeachers = query({
  args: {},
  handler: async (ctx) => {
    const { gymIds } = await getAccessibleGymIds(ctx);
    const teachers = await ctx.db.query("teachers").collect();
    return teachers.filter((teacher) => teacher.gymIds.some((gymId: Id<"gyms">) => gymIds.has(gymId)));
  }
});

export const getCurrentTeacher = query({
  args: {},
  handler: async (ctx) => {
    return (await getCurrentPrincipal(ctx, { skipSubscription: true })).teacher;
  }
});
