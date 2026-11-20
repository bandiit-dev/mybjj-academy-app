import { assertAdminGymScope } from "./lib/auth";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

import { mutation, query, type QueryCtx } from "./_generated/server";
import { getAccessibleGymIds, requireAdmin } from "./lib/auth";
import { assertWeekDays, WEEK_DAYS } from "./lib/validators";

import { academyToday } from "./lib/studentPlans";

export function classTitle(
  template?: Pick<Doc<"classes">, "level" | "classType"> | null,
) {
  if (!template) return "Aula de jiu-jitsu";
  const level = template.level === "Advanced" ? "Avançado" : "Fundamentos";
  const modality = template.classType === "NOGI" ? "NO-GI" : "GI";
  return `${level} ${modality}`;
}

export function recurringTime(template: Doc<"classes">, date: string) {
  const day = WEEK_DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  const start = template.startHour.trim();
  if (
    date < academyToday(template.createdAt) ||
    !template.weekDays.includes(day) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(start)
  )
    return null;

  const startsAt = Date.parse(`${date}T${start}:00-03:00`);
  const label = template.duration.trim().toLowerCase();
  const minutes = label.match(/^(\d+)\s*(?:min(?:utos?)?)?$/);
  const hours = label.match(
    /^(\d+)\s*(?:h|horas?)\s*(?:(\d{1,2})\s*(?:min)?)?$/,
  );
  const clock = label.match(/^(\d{1,2}):([0-5]\d)$/);
  const duration = minutes
    ? Number(minutes[1])
    : hours
      ? Number(hours[1]) * 60 + Number(hours[2] ?? 0)
      : clock
        ? Number(clock[1]) * 60 + Number(clock[2])
        : 0;
  return {
    startsAt,
    endsAt:
      duration > 0 && duration <= 1440 ? startsAt + duration * 60_000 : null,
  };
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

export async function getClassStaff(ctx: Pick<QueryCtx, "db" | "auth">) {
  const { principal, gymIds } = await getAccessibleGymIds(ctx);
  if (!principal.isAdmin && !principal.teacher)
    throw new Error("Forbidden: teacher or admin role required");
  return { ...principal, gymIds };
}

export function staffClassSessions(
  ctx: Pick<QueryCtx, "db">,
  classId: Doc<"classes">["_id"],
) {
  return ctx.db
    .query("classSessions")
    .withIndex("by_classId", (q) => q.eq("classId", classId));
}

export function staffHasClassScope(
  staff: Awaited<ReturnType<typeof getClassStaff>>,
  entry: Pick<Doc<"classes">, "gymIds">,
) {
  return entry.gymIds.some((id) => staff.gymIds.has(id));
}

export function staffCanManageSession(
  staff: Awaited<ReturnType<typeof getClassStaff>>,
  session: Doc<"classSessions">,
) {
  return (
    staffHasClassScope(staff, session) &&
    (staff.isAdmin ||
      session.teacherIds.some((id) => id === staff.teacher?._id))
  );
}

export const getStaffClasses = query({
  args: {},
  handler: async (ctx) => {
    const staff = await getClassStaff(ctx);
    const classes = (await ctx.db.query("classes").collect()).filter((item) =>
      staffHasClassScope(staff, item),
    );
    if (staff.isAdmin) return { isAdmin: true, classes };

    const visible = await Promise.all(
      classes.map(async (item) => {
        if (item.teacherIds.some((id) => id === staff.teacher?._id))
          return item;
        for await (const session of staffClassSessions(ctx, item._id)) {
          if (staffCanManageSession(staff, session)) return item;
        }
        return null;
      }),
    );
    return { isAdmin: false, classes: visible.filter((item) => item !== null) };
  },
});
