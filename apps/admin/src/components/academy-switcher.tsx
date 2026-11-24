"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { createContext, useContext } from "react";

type AcademyRole = "admin" | "teacher" | "student";

export const AcademySwitchContext = createContext<{
  activeGymId?: Id<"gyms">;
  switchAcademy: (gymId: Id<"gyms">, role: AcademyRole) => void;
  error: string;
} | null>(null);

const labels = { admin: "Admin", teacher: "Professor", student: "Aluno" };

export function AcademySwitcher() {
  const context = useContext(AcademySwitchContext);
  const academies = useQuery(
    api.onboarding.listAcademyAccess,
    context?.activeGymId ? {} : "skip",
  );
  if (!context || !academies || academies.length < 2) return null;

  return (
    <div className="academy-switcher">
      <label>
        <span className="sr-only">Trocar academia</span>
        <select
          className="academy-selector"
          value={context.activeGymId}
          onChange={(event) => {
            const academy = academies.find(
              ({ gymId }) => gymId === event.target.value,
            );
            if (academy) context.switchAcademy(academy.gymId, academy.role);
          }}
        >
          {academies.map(({ gymId, role, name }) => (
            <option key={gymId} value={gymId}>
              {name} · {labels[role]}
            </option>
          ))}
        </select>
      </label>
      {context.error && <p role="alert">{context.error}</p>}
    </div>
  );
}
