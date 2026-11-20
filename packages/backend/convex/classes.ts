import { assertAdminGymScope } from "./lib/auth";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getAccessibleGymIds, requireAdmin } from "./lib/auth";
import { assertWeekDays } from "./lib/validators";

export function classTitle(template?: Pick<Doc<"classes">, "level" | "classType"> | null) {
  if (!template) return "Aula de jiu-jitsu";
  const level = template.level === "Advanced" ? "Avançado" : "Fundamentos";
  const modality = template.classType === "NOGI" ? "NO-GI" : "GI";
  return `${level} ${modality}`;
}

const classTypeValidator = v.union(v.literal("GI"), v.literal("NOGI"));
const classLevelValidator = v.union(v.literal("Beginner"), v.literal("Advanced"));
const weekDayValidator = v.union(
  v.literal("Sunday"),
  v.literal("Monday"),
  v.literal("Tuesday"),
  v.literal("Wednesday"),
  v.literal("Thursday"),
  v.literal("Friday"),
  v.literal("Saturday")
);

export const createClass = mutation({
  args: {
    teacherIds: v.array(v.id("teachers")),
    gymIds: v.array(v.id("gyms")),
    unityIds: v.array(v.id("unities")),
    duration: v.string(),
    startHour: v.string(),
    level: classLevelValidator,
    classType: classTypeValidator,
    weekDays: v.array(weekDayValidator)
  },
  handler: async (ctx, args) => {
    const principal = await requireAdmin(ctx);
    assertAdminGymScope(principal, args.gymIds);
    assertWeekDays(args.weekDays);
    const now = Date.now();

    return ctx.db.insert("classes", {
      ...args,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateClass = mutation({
  args: {
    classId: v.id("classes"),
    teacherIds: v.optional(v.array(v.id("teachers"))),
    gymIds: v.optional(v.array(v.id("gyms"))),
    unityIds: v.optional(v.array(v.id("unities"))),
    duration: v.optional(v.string()),
    startHour: v.optional(v.string()),
    level: v.optional(classLevelValidator),
    classType: v.optional(classTypeValidator),
    weekDays: v.optional(v.array(weekDayValidator))
  },
  handler: async (ctx, { classId, ...patch }) => {
    const principal = await requireAdmin(ctx);

    const classDoc = await ctx.db.get(classId);
    if (!classDoc) {
      throw new Error("Class not found");
    }

    const adminGymIds = new Set([...(principal.teacher?.gymIds ?? []), ...(principal.student?.gymIds ?? [])]);
    if (!classDoc.gymIds.some((gymId) => adminGymIds.has(gymId))) {
      throw new Error("Forbidden: class belongs to another academy");
    }

    if (patch.weekDays) {
      assertWeekDays(patch.weekDays);
    }

    if (patch.gymIds) assertAdminGymScope(principal, patch.gymIds);
    await ctx.db.patch(classId, {
      ...patch,
      updatedAt: Date.now()
    });

    return classId;
  }
});

export const getClassById = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, { classId }) => {
    const { gymIds } = await getAccessibleGymIds(ctx);
    const classDoc = await ctx.db.get(classId);
    return classDoc?.gymIds.some((gymId) => gymIds.has(gymId)) ? classDoc : null;
  }
});

export const getAllClasses = query({
  args: {},
  handler: async (ctx) => {
    const { gymIds } = await getAccessibleGymIds(ctx);
    const classes = await ctx.db.query("classes").collect();
    return classes.filter((classDoc) => classDoc.gymIds.some((gymId) => gymIds.has(gymId)));
  }
});
