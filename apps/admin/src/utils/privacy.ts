import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { ConvexError } from "convex/values";

export type PrivacyScope = { gymId?: Id<"gyms"> };

export const privacyDate = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
export const dateLabel = (value?: string) =>
  value ? value.split("-").reverse().join("/") : "—";
export const field = (data: FormData, name: string) =>
  String(data.get(name) ?? "");

export function privacyError(error: unknown) {
  return error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : "Não foi possível concluir a operação. Tente novamente.";
}
