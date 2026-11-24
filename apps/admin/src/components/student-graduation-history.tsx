"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { BELT_LABELS, type Belt } from "@mybjj/backend/convex/lib/validators";
import { useQuery } from "convex/react";
import { useId } from "react";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function rankLabel(belt: Belt, degree: number) {
  return `${BELT_LABELS[belt]} · ${degree} ${degree === 1 ? "grau" : "graus"}`;
}

export function StudentGraduationHistory({
  studentId,
  className = "academy-card",
}: {
  studentId?: Id<"students">;
  className?: string;
}) {
  const entries = useQuery(api.students.getGraduationHistory, { studentId });
  const headingId = useId();

  return (
    <section className={className} aria-labelledby={headingId}>
      <header>
        <h2 id={headingId}>Histórico de graduação</h2>
      </header>
      {entries === undefined ? (
        <p role="status">Carregando histórico de graduação...</p>
      ) : entries.length === 0 ? (
        <p className="empty-copy">
          Nenhuma mudança de faixa ou grau registrada.
        </p>
      ) : (
        <ol className="student-graduation-history">
          {entries.map((entry) => (
            <li key={entry._id}>
              <div>
                <strong>
                  {entry.belt !== entry.previousBelt
                    ? "Mudança de faixa"
                    : entry.degree > entry.previousDegree
                      ? "Grau concedido"
                      : "Ajuste de grau"}
                </strong>
                <p>
                  {rankLabel(entry.previousBelt, entry.previousDegree)} →{" "}
                  {rankLabel(entry.belt, entry.degree)}
                </p>
              </div>
              <time dateTime={new Date(entry.recordedAt).toISOString()}>
                {dateFormat.format(entry.recordedAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
