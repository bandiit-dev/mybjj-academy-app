import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import {
  getAuthUserIdentity,
  getAccessibleGymIds,
  getCurrentPrincipal,
  getCurrentStudentByClerkId,
  requireStudentOrAdmin
} from "./lib/auth";
import { assertDegree } from "./lib/validators";

const beltValidator = v.union(
  v.literal("White"),
  v.literal("Blue"),
  v.literal("Purple"),
  v.literal("Brown"),
  v.literal("Black"),
  v.literal("Coral"),
  v.literal("Red")
);

const userTypeValidator = v.union(v.literal("Normal"), v.literal("Admin"));

export const createStudent = mutation({
  args: {
    clerkUserId: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    belt: beltValidator,
    degree: v.number(),
    gymIds: v.array(v.id("gyms")),
    unityIds: v.array(v.id("unities")),
    picture: v.string(),
    userType: userTypeValidator
  },
  handler: async (ctx, args) => {
    const principal = await getCurrentPrincipal(ctx);

    // Policy choice: authenticated users can create only their own student profile.
    if (!principal.isAdmin && args.clerkUserId !== principal.identity.subject) {
      throw new Error("Forbidden: users can only create their own student profile");
    }

    assertDegree(args.degree);

    const now = Date.now();

    return ctx.db.insert("students", {
      ...args,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateStudent = mutation({
  args: {
    studentId: v.id("students"),
    clerkUserId: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    belt: v.optional(beltValidator),
    degree: v.optional(v.number()),
    gymIds: v.optional(v.array(v.id("gyms"))),
    unityIds: v.optional(v.array(v.id("unities"))),
    picture: v.optional(v.string()),
    userType: v.optional(userTypeValidator)
  },
  handler: async (ctx, { studentId, ...patch }) => {
    const authResult = await requireStudentOrAdmin(ctx, studentId);

    if (patch.degree !== undefined) {
      assertDegree(patch.degree);
    }

    if (!authResult.isAdmin) {
      const selfPatch: Record<string, unknown> = {};

      if (patch.name !== undefined) selfPatch.name = patch.name;
      if (patch.email !== undefined) selfPatch.email = patch.email;
      if (patch.phone !== undefined) selfPatch.phone = patch.phone;
      if (patch.picture !== undefined) selfPatch.picture = patch.picture;

      await ctx.db.patch(studentId, {
        ...selfPatch,
        updatedAt: Date.now()
      });

      return studentId;
    }

    const adminGymIds = new Set([...(authResult.teacher?.gymIds ?? []), ...(authResult.student?.gymIds ?? [])]);
    if (!authResult.targetStudent.gymIds.some((gymId: Id<"gyms">) => adminGymIds.has(gymId))) {
      throw new Error("Forbidden: student belongs to another academy");
    }

    await ctx.db.patch(studentId, {
      ...patch,
      updatedAt: Date.now()
    });

    return studentId;
  }
});

export const getStudentById = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const { gymIds } = await getAccessibleGymIds(ctx);
    const student = await ctx.db.get(studentId);
    return student?.gymIds.some((gymId: Id<"gyms">) => gymIds.has(gymId)) ? student : null;
  }
});

export const getAllStudents = query({
  args: {},
  handler: async (ctx) => {
    const { gymIds } = await getAccessibleGymIds(ctx);
    const students = await ctx.db.query("students").collect();
    return students.filter((student) => student.gymIds.some((gymId: Id<"gyms">) => gymIds.has(gymId)));
  }
});

export const getCurrentStudent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getAuthUserIdentity(ctx);
    return getCurrentStudentByClerkId(ctx, identity.subject);
  }
});
