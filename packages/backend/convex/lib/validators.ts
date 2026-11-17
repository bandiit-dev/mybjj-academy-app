import { v, type Infer } from "convex/values";

export const BELT_LABELS = {
  White: "Branca",
  GrayWhite: "Cinza e Branca", Gray: "Cinza", GrayBlack: "Cinza e Preta",
  YellowWhite: "Amarela e Branca", Yellow: "Amarela", YellowBlack: "Amarela e Preta",
  OrangeWhite: "Laranja e Branca", Orange: "Laranja", OrangeBlack: "Laranja e Preta",
  GreenWhite: "Verde e Branca", Green: "Verde", GreenBlack: "Verde e Preta",
  Blue: "Azul", Purple: "Roxa", Brown: "Marrom", Black: "Preta", Coral: "Coral", Red: "Vermelha"
} as const;
export type Belt = keyof typeof BELT_LABELS;
export const BELTS = Object.keys(BELT_LABELS) as Belt[];
export const beltValidator = v.union(...BELTS.map((belt) => v.literal(belt)));
export const teacherClassTypeValidator = v.union(v.literal("GI"), v.literal("NOGI"), v.literal("GI_NOGI"));
export const BELT_CLASSES: Record<Belt, string> = {
  White: "white", GrayWhite: "gray-white", Gray: "gray", GrayBlack: "gray-black",
  YellowWhite: "yellow-white", Yellow: "yellow", YellowBlack: "yellow-black",
  OrangeWhite: "orange-white", Orange: "orange", OrangeBlack: "orange-black",
  GreenWhite: "green-white", Green: "green", GreenBlack: "green-black",
  Blue: "blue", Purple: "purple", Brown: "brown", Black: "black", Coral: "coral", Red: "red"
};
export const CLASS_TYPES = ["GI", "NOGI"] as const;
export const CLASS_LEVELS = ["Beginner", "Advanced"] as const;
export const USER_TYPES = ["Normal", "Admin"] as const;
export const WEEK_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
] as const;

export const SESSION_STATUSES = ["Scheduled", "Cancelled", "Completed"] as const;
export const ENROLLMENT_STATUSES = ["Confirmed", "Cancelled"] as const;
export const ATTENDANCE_STATUSES = ["Present", "Absent"] as const;

const SESSION_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function assertDegree(degree: number): void {
  if (!Number.isInteger(degree) || degree < 0 || degree > 7) {
    throw new Error("Invalid degree. It must be an integer between 0 and 7.");
  }
}

export function assertWeekDays(weekDays: readonly string[]): void {
  for (const day of weekDays) {
    if (!WEEK_DAYS.includes(day as (typeof WEEK_DAYS)[number])) {
      throw new Error(`Invalid weekday value: ${day}`);
    }
  }
}

export function assertSessionDate(sessionDate: string): void {
  if (!SESSION_DATE_REGEX.test(sessionDate)) {
    throw new Error("Invalid sessionDate format. Expected YYYY-MM-DD.");
  }

  const date = new Date(`${sessionDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid sessionDate value.");
  }
}

export function assertTimeRange(startsAt: number, endsAt: number): void {
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    throw new Error("startsAt and endsAt must be valid timestamps.");
  }

  if (startsAt >= endsAt) {
    throw new Error("Invalid time range. startsAt must be less than endsAt.");
  }
}

export function toIsoDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function assertDateOfBirth(dateOfBirth: string | undefined): void {
  if (!dateOfBirth) return;
  const parsed = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (!SESSION_DATE_REGEX.test(dateOfBirth) || Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== dateOfBirth || dateOfBirth > toIsoDate()) {
    throw new Error("Invalid dateOfBirth. Expected a valid date in the past or today.");
  }
}

export function assertInvitationEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error("A valid email is required to create an account");
  }
}

export const unityAddressValidator = v.object({
  street: v.string(),
  number: v.string(),
  complement: v.string(),
  district: v.string(),
  city: v.string(),
  state: v.string(),
  postalCode: v.string()
});

export function formatUnityAddress(address: Infer<typeof unityAddressValidator>): string {
  return [address.street, address.number, address.complement, address.district,
    address.city, address.state, address.postalCode].map(part => part.trim()).filter(Boolean).join(", ");
}
