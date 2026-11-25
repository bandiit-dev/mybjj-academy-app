import { defineSchema, defineTable } from "convex/server";
import { beltValidator, teacherClassTypeValidator, unityAddressValidator } from "./lib/validators";
import { planTypeValidator, studentPlanValidator } from "./lib/studentPlans";
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
  academySelections: defineTable({
    clerkUserId: v.string(),
    gymId: v.id("gyms"),
    studentId: v.optional(v.id("students")),
  }).index("by_clerkUserId", ["clerkUserId"]),

  billingAccounts: defineTable({
    ownerClerkUserId: v.string(), gymId: v.optional(v.id("gyms")),
    stripeCustomerId: v.optional(v.string()), stripeSubscriptionId: v.optional(v.string()),
    checkoutSessionId: v.optional(v.string()), checkoutExpiresAt: v.optional(v.number()),
    checkoutAttempt: v.number(), checkoutLockUntil: v.optional(v.number()),
    status: v.string(), priceId: v.optional(v.string()),
    plan: v.optional(v.union(v.literal("starter"), v.literal("full"))),
    trialEndsAt: v.optional(v.number()), trialUsed: v.optional(v.boolean()),
    trialCheckoutReserved: v.optional(v.boolean()),
    trialPromotionCode: v.optional(v.string()),
    paidThrough: v.optional(v.number()), currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(), stripeSyncedAt: v.number(), lastEventCreated: v.number(),
    createdAt: v.number(), updatedAt: v.number()
  }).index("by_owner", ["ownerClerkUserId"]).index("by_gymId", ["gymId"])
    .index("by_customer", ["stripeCustomerId"]).index("by_subscription", ["stripeSubscriptionId"]),
  billingEvents: defineTable({eventId: v.string(), type: v.string(), processedAt: v.number()})
    .index("by_eventId", ["eventId"]),

  images: defineTable({
    storageId: v.id("_storage"),
    url: v.optional(v.string()),
    studentPhotoGymId: v.optional(v.id("gyms")),
    attachedToStudent: v.optional(v.boolean()),
    contentType: v.string(),
    fileName: v.string(),
    size: v.number(),
    uploadedBy: v.string(),
    createdAt: v.number()
  }).index("by_uploadedBy", ["uploadedBy"]).index("by_url", ["url"]),

  gyms: defineTable({
    teamName: v.optional(v.string()),
    studentPaymentDueDay: v.optional(v.number()),
    studentPaymentRemindersEnabled: v.optional(v.boolean()),
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
    .index("by_email", ["email"])
    .index("by_brandingLogo", ["branding.logoUrl"])
    .index("by_studentPaymentRemindersEnabled", ["studentPaymentRemindersEnabled"]),

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
    ownerGymId: v.optional(v.id("gyms")),
    name: v.string(),
    leader: v.string(),
    logo: v.string(),
    history: v.string(),
    founded: v.string(),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index("by_logo", ["logo"]),

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
    .index("by_picture", ["picture"])
    .index("by_email", ["email"]),

  students: defineTable({
    plan: v.optional(studentPlanValidator),
    clerkUserId: v.optional(v.string()),
    guardianEmail: v.optional(v.string()),
    photoId: v.optional(v.id("images")),
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
    .index("by_guardianEmail", ["guardianEmail"])
    .index("by_picture", ["picture"])
    .index("by_email", ["email"]),

  studentGraduations: defineTable({
    studentId: v.id("students"),
    previousBelt: beltValidator,
    previousDegree: v.number(),
    belt: beltValidator,
    degree: v.number(),
    recordedAt: v.number(),
  }).index("by_studentId", ["studentId"]),

  studentPayments: defineTable({
    studentId: v.id("students"), planType: planTypeValidator,
    periodStart: v.string(), periodEnd: v.string(), paid: v.boolean(),
    paidOn: v.optional(v.string()), notes: v.string(), recordedBy: v.string(),
    createdAt: v.number(), updatedAt: v.number()
  }).index("by_studentId", ["studentId"])
    .index("by_period", ["studentId", "planType", "periodStart", "periodEnd"]),

  monthlyPaymentReminders: defineTable({
    studentId: v.id("students"),
    gymId: v.id("gyms"),
    month: v.string(),
    dueDate: v.string(),
    recipient: v.string(),
    subject: v.string(),
    text: v.string(),
    attempts: v.number(),
    retryAfter: v.number(),
    providerId: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
  }).index("by_student_gym_month", ["studentId", "gymId", "month"]),

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
    originalSessionDate: v.optional(v.string()),
    originalStartsAt: v.optional(v.number()),
    substituteTeacherId: v.optional(v.id("teachers")),
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
    .index("by_classId_sessionDate", ["classId", "sessionDate"])
    .index("by_sessionDate", ["sessionDate"])
    .index("by_originalSessionDate_classId", ["originalSessionDate", "classId"])
    .index("by_status", ["status"])
    .index("by_sessionDate_status", ["sessionDate", "status"]),

  classSessionLogs: defineTable({
    sessionId: v.id("classSessions"),
    ledByTeacherId: v.id("teachers"),
    notes: v.string(),
    updatedAt: v.number()
  }).index("by_sessionId", ["sessionId"])
    .index("by_ledByTeacherId", ["ledByTeacherId"]),

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
