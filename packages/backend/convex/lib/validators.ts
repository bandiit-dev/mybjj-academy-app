export const BELTS = ["White", "Blue", "Purple", "Brown", "Black", "Coral", "Red"] as const;
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
