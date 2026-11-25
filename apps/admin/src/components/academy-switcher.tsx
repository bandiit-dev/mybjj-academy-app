"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { createContext, useContext } from "react";

type AcademyRole = "admin" | "teacher" | "student";

export function academyProfileKey(
  gymId?: Id<"gyms">,
  studentId?: Id<"students">,
) {
  return `${gymId ?? ""}:${studentId ?? ""}`;
}

export const AcademySwitchContext = createContext<{
  activeGymId?: Id<"gyms">;
  activeStudentId?: Id<"students">;
  switchAcademy: (
    gymId: Id<"gyms">,
    role: AcademyRole,
    studentId?: Id<"students">,
  ) => void;
  error: string;
} | null>(null);

const labels = { admin: "Admin", teacher: "Professor", student: "Aluno" };

export function AcademySwitcher() {
  const context = useContext(AcademySwitchContext);
  const academies = useQuery(
    api.onboarding.listProfileAccess,
    context?.activeGymId ? {} : "skip",
  );
  if (!context || !academies || academies.length < 2) return null;

  return (
    <div className="academy-switcher">
      <label>
        <span className="sr-only">Trocar academia ou perfil</span>
        <select
          className="academy-selector"
          value={academyProfileKey(
            context.activeGymId,
            context.activeStudentId,
          )}
          onChange={(event) => {
            const academy = academies.find(
              ({ gymId, studentId }) =>
                academyProfileKey(gymId, studentId) === event.target.value,
            );
            if (academy)
              context.switchAcademy(
                academy.gymId,
                academy.role,
                academy.studentId,
              );
          }}
        >
          {academies.map(({ gymId, gymName, role, name, studentId }) => (
            <option
              key={academyProfileKey(gymId, studentId)}
              value={academyProfileKey(gymId, studentId)}
            >
              {role === "student"
                ? `${name} · ${gymName}`
                : `${gymName} · ${labels[role]}`}
            </option>
          ))}
        </select>
      </label>
      {context.error && <p role="alert">{context.error}</p>}
    </div>
  );
}
