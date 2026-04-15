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

export function assertDegree(degree: number): void {
  if (!Number.isInteger(degree) || degree < 1 || degree > 7) {
    throw new Error("Invalid degree. It must be an integer between 1 and 7.");
  }
}

export function assertWeekDays(weekDays: readonly string[]): void {
  for (const day of weekDays) {
    if (!WEEK_DAYS.includes(day as (typeof WEEK_DAYS)[number])) {
      throw new Error(`Invalid weekday value: ${day}`);
    }
  }
}

export function assertEnumValue<T extends readonly string[]>(
  label: string,
  value: string,
  allowedValues: T
): void {
  if (!allowedValues.includes(value as T[number])) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}
