import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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

export default defineSchema({
  gyms: defineTable({
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
    teacherIds: v.array(v.id("teachers")),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_cnpj", ["cnpj"])
    .index("by_email", ["email"]),

  unities: defineTable({
    address: v.string(),
    gymId: v.union(v.id("gyms"), v.null()),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index("by_gymId", ["gymId"]),

  teams: defineTable({
    name: v.string(),
    leader: v.string(),
    logo: v.string(),
    history: v.string(),
    founded: v.string(),
    createdAt: v.number(),
    updatedAt: v.number()
  }),

  teachers: defineTable({
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
    classType: classTypeValidator,
    classIds: v.array(v.id("classes")),
    userType: userTypeValidator,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_email", ["email"]),

  students: defineTable({
    clerkUserId: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    belt: beltValidator,
    degree: v.number(),
    gymIds: v.array(v.id("gyms")),
    unityIds: v.array(v.id("unities")),
    picture: v.string(),
    userType: userTypeValidator,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_email", ["email"]),

  classes: defineTable({
    teacherIds: v.array(v.id("teachers")),
    gymIds: v.array(v.id("gyms")),
    duration: v.string(),
    startHour: v.string(),
    studentPresenceIds: v.array(v.id("students")),
    level: classLevelValidator,
    classType: classTypeValidator,
    weekDays: v.array(weekDayValidator),
    createdAt: v.number(),
    updatedAt: v.number()
  })
});
