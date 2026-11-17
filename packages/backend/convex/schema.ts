import { defineSchema, defineTable } from "convex/server";
import { beltValidator, teacherClassTypeValidator, unityAddressValidator } from "./lib/validators";
import { v } from "convex/values";

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

const classSessionStatusValidator = v.union(
  v.literal("Scheduled"),
  v.literal("Cancelled"),
  v.literal("Completed")
);

const enrollmentStatusValidator = v.union(v.literal("Confirmed"), v.literal("Cancelled"));
const attendanceStatusValidator = v.union(v.literal("Present"), v.literal("Absent"));

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
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.string(),
    addressDetails: v.optional(unityAddressValidator),
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
    classType: teacherClassTypeValidator,
    classIds: v.array(v.id("classes")),
    userType: userTypeValidator,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_email", ["email"]),

  students: defineTable({
    clerkUserId: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
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
    unityIds: v.array(v.id("unities")),
    duration: v.string(),
    startHour: v.string(),
    level: classLevelValidator,
    classType: classTypeValidator,
    weekDays: v.array(weekDayValidator),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_classType", ["classType"])
    .index("by_level", ["level"]),

  classSessions: defineTable({
    classId: v.id("classes"),
    sessionDate: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    teacherIds: v.array(v.id("teachers")),
    gymIds: v.array(v.id("gyms")),
    unityIds: v.array(v.id("unities")),
    status: classSessionStatusValidator,
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_classId", ["classId"])
    .index("by_sessionDate", ["sessionDate"])
    .index("by_status", ["status"])
    .index("by_sessionDate_status", ["sessionDate", "status"]),

  enrollments: defineTable({
    classSessionId: v.id("classSessions"),
    studentId: v.id("students"),
    status: enrollmentStatusValidator,
    confirmedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_classSessionId", ["classSessionId"])
    .index("by_studentId", ["studentId"])
    .index("by_classSessionId_studentId", ["classSessionId", "studentId"]),

  attendance: defineTable({
    classSessionId: v.id("classSessions"),
    studentId: v.id("students"),
    status: attendanceStatusValidator,
    markedByTeacherId: v.id("teachers"),
    markedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_classSessionId", ["classSessionId"])
    .index("by_studentId", ["studentId"])
    .index("by_classSessionId_studentId", ["classSessionId", "studentId"])
});
