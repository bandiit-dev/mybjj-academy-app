import { getStudentPlan, studentPlanValidator, validateStudentPlan, withStudentPlan } from "./lib/studentPlans";
import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { assertDateOfBirth, assertDegree, beltValidator } from "./lib/validators";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import {
  getAuthUserIdentity,
  getAccessibleGymIds,
  getCurrentPrincipal,
  getCurrentStudentByClerkId,
  requireAcademyUnitAdmin,
  requireStudentOrAdmin
} from "./lib/auth";

const userTypeValidator = v.union(v.literal("Normal"), v.literal("Admin"));

export const createStudent = mutation({
  args: {
    plan: v.optional(studentPlanValidator),
    clerkUserId: v.string(),
    dateOfBirth: v.optional(v.string()),
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

    if (!principal.isAdmin && args.plan) throw new Error("Forbidden: only an admin can choose a student plan");
    if (!principal.isAdmin && args.userType !== "Normal") {
      throw new Error("Forbidden: users cannot assign admin access");
    }
    assertDateOfBirth(args.dateOfBirth);
    assertDegree(args.degree);

    const now = Date.now();

    return ctx.db.insert("students", {
      ...args,
      plan: validateStudentPlan(getStudentPlan(args)),
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateStudent = mutation({
  args: {
    studentId: v.id("students"),
    plan: v.optional(studentPlanValidator),
    clerkUserId: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
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

    if (patch.plan && !authResult.isAdmin) throw new Error("Forbidden: only an admin can change a student plan");
    if (patch.plan) validateStudentPlan(patch.plan);
    assertDateOfBirth(patch.dateOfBirth);

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
      plan: patch.plan ?? getStudentPlan(authResult.targetStudent),
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
    return student?.gymIds.some((gymId: Id<"gyms">) => gymIds.has(gymId)) ? withStudentPlan(student) : null;
  }
});

export const getAllStudents = query({
  args: {},
  handler: async (ctx) => {
    const { gymIds } = await getAccessibleGymIds(ctx);
    const students = await ctx.db.query("students").collect();
    return students.filter((student) => student.gymIds.some((gymId: Id<"gyms">) => gymIds.has(gymId)))
      .map(student => ({ ...student, plan: getStudentPlan(student) }));
  }
});

export const getCurrentStudent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getAuthUserIdentity(ctx);
    return withStudentPlan(await getCurrentStudentByClerkId(ctx, identity.subject));
  }
});

// Academy records without credentials, including children who do not use the app.
export const createStudentWithoutAccount = mutation({
  args: {
    plan: v.optional(studentPlanValidator),
    name: v.string(), email: v.optional(v.string()), phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()), belt: beltValidator, degree: v.number(),
    gymId: v.id("gyms"), unityId: v.id("unities"), picture: v.string()
  },
  handler: async (ctx, args) => {
    await requireAcademyUnitAdmin(ctx, args.gymId, args.unityId);
    assertDegree(args.degree);
    assertDateOfBirth(args.dateOfBirth);
    if (!args.name.trim()) throw new Error("Student name is required");
    const now = Date.now();
    return ctx.db.insert("students", {
      plan: validateStudentPlan(getStudentPlan(args)),
      name: args.name.trim(), email: (args.email ?? "").trim().toLowerCase(),
      phone: (args.phone ?? "").trim(), dateOfBirth: args.dateOfBirth,
      belt: args.belt, degree: args.degree, gymIds: [args.gymId], unityIds: [args.unityId],
      picture: args.picture.trim(), userType: "Normal", createdAt: now, updatedAt: now
    });
  }
});
