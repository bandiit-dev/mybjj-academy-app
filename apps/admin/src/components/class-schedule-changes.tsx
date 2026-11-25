"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useState, type FormEvent } from "react";

type ScheduleOccurrence = Extract<
  FunctionReturnType<typeof api.classSessions.getStaffScheduleOccurrence>,
  { kind: "occurrence" }
>;

const hour = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const dateLabel = (date: string) => date.split("-").reverse().join("/");

function ScheduleOccurrenceForm({
  classId,
  selectedDate,
  today,
  occurrence,
  onSaved,
}: {
  classId: Id<"classes">;
  selectedDate: string;
  today: string;
  occurrence: ScheduleOccurrence;
  onSaved: (message: string) => void;
}) {
  const changeSchedule = useMutation(
    api.classSessions.changeStaffScheduleOccurrence,
  );
  const originalTime = hour.format(occurrence.startsAt);
  const currentSubstitute = occurrence.substituteTeacherId ?? "";
  const [date, setDate] = useState(occurrence.date);
  const [startTime, setStartTime] = useState(originalTime);
  const [substitute, setSubstitute] = useState<string>(currentSubstitute);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed =
    date !== occurrence.date ||
    startTime !== originalTime ||
    substitute !== currentSubstitute;

  async function apply(change: "update" | "cancel") {
    if (busy) return;
    if (
      change === "cancel" &&
      !window.confirm("Cancelar esta ocorrência da aula?")
    )
      return;
    setBusy(true);
    setError("");
    try {
      await changeSchedule({
        classId,
        date: selectedDate,
        sessionId: occurrence.sessionId,
        revision: occurrence.revision,
        change:
          change === "cancel"
            ? { type: "cancel" }
            : {
                type: "update",
                date,
                startTime,
                substituteTeacherId:
                  substitute === currentSubstitute
                    ? undefined
                    : substitute
                      ? (substitute as Id<"teachers">)
                      : null,
              },
      });
      onSaved(
        change === "cancel" ? "Ocorrência cancelada." : "Alterações salvas.",
      );
    } catch (cause) {
      setError(
        cause instanceof ConvexError && typeof cause.data === "string"
          ? cause.data
          : "Não foi possível alterar esta ocorrência.",
      );
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (changed) void apply("update");
  }

  return (
    <>
      <p>
        <strong>
          {dateLabel(occurrence.date)} · {originalTime}–
          {hour.format(occurrence.endsAt)}
        </strong>
        {occurrence.teacherNames.length > 0 &&
          ` · ${occurrence.teacherNames.join(", ")}`}
      </p>
      {occurrence.originalDate !== occurrence.date && (
        <p>Data original da aula · {dateLabel(occurrence.originalDate)}</p>
      )}
      {occurrence.status === "Cancelled" ? (
        <p className="empty-copy">Aula cancelada.</p>
      ) : occurrence.canEdit ? (
        <form className="class-schedule-form" onSubmit={submit}>
          <div className="class-history-record">
            <label className="management-field">
              <span>Data da aula</span>
              <input
                type="date"
                required
                min={today}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                disabled={busy}
              />
            </label>
            <label className="management-field">
              <span>Horário de início</span>
              <input
                type="time"
                required
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                disabled={busy}
              />
            </label>
            <label className="management-field">
              <span>Professor substituto</span>
              <select
                value={substitute}
                onChange={(event) => setSubstitute(event.target.value)}
                disabled={busy}
              >
                <option value="">Professores da programação</option>
                {occurrence.teachers.map((teacher) => (
                  <option key={teacher._id} value={teacher._id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="class-history-record">
            <button
              className="button primary"
              type="submit"
              disabled={busy || !changed}
            >
              Salvar alterações
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => void apply("cancel")}
            >
              Cancelar esta aula
            </button>
          </div>
          {error && (
            <p className="payment-error" role="alert">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="empty-copy">
          O horário desta aula já passou ou o registro foi concluído.
        </p>
      )}
    </>
  );
}

export function ClassScheduleChanges({
  classId,
  today,
  nextDate,
}: {
  classId: Id<"classes">;
  today: string;
  nextDate: string;
}) {
  const [selected, setSelected] = useState<string>();
  const [message, setMessage] = useState("");
  const date = selected ?? nextDate;
  const occurrence = useQuery(
    api.classSessions.getStaffScheduleOccurrence,
    date ? { classId, date } : "skip",
  );

  return (
    <section
      id="alteracoes-programacao"
      className="academy-card class-schedule-form"
    >
      <header>
        <h2>Alterações na programação</h2>
      </header>
      <p>Altere uma ocorrência. A programação semanal continua igual.</p>
      <label className="management-field class-history-picker">
        <span>Data da ocorrência</span>
        <input
          type="date"
          value={date}
          onChange={(event) => {
            setSelected(event.target.value);
            setMessage("");
          }}
        />
      </label>
      {!date || occurrence === null ? (
        <p className="empty-copy">Nenhuma ocorrência disponível nesta data.</p>
      ) : occurrence === undefined ? (
        <p role="status">Carregando ocorrência...</p>
      ) : occurrence.kind === "ambiguous" ? (
        <p role="status">
          Há mais de um registro para esta data. Selecione outra data.
        </p>
      ) : (
        <ScheduleOccurrenceForm
          key={`${date}:${occurrence.sessionId}:${occurrence.revision}`}
          classId={classId}
          selectedDate={date}
          today={today}
          occurrence={occurrence}
          onSaved={(savedMessage) => {
            setSelected(date);
            setMessage(savedMessage);
          }}
        />
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
