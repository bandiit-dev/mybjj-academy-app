import { v, type Infer } from "convex/values";

export const privacyRequestKind = v.union(
  v.literal("access"),
  v.literal("correction"),
  v.literal("deletion"),
);
export const privacyRequestStatus = v.union(
  v.literal("received"),
  v.literal("verification"),
  v.literal("review"),
  v.literal("completed"),
);
export const privacyRequestOutcome = v.union(
  v.literal("fulfilled"),
  v.literal("partial"),
  v.literal("declined"),
);
export const retentionCategory = v.union(
  v.literal("reminders"),
  v.literal("unlinkedPhotos"),
  v.literal("studentRecords"),
  v.literal("studentPayments"),
  v.literal("portalBilling"),
  v.literal("backups"),
  v.literal("requests"),
);
export const retentionDisposition = v.union(
  v.literal("delete"),
  v.literal("anonymize"),
  v.literal("minimize"),
  v.literal("review"),
);
export const retentionRuleStatus = v.union(
  v.literal("draft"),
  v.literal("approved"),
);

export type RetentionCategory = Infer<typeof retentionCategory>;
export const academyRetentionCategories = [
  "unlinkedPhotos",
  "reminders",
  "studentRecords",
  "studentPayments",
  "backups",
  "requests",
] as const;
export const platformRetentionCategories = [
  "portalBilling",
  "backups",
  "requests",
] as const;
export const reminderRetentionTrigger = "Fim da janela de reenvio";
