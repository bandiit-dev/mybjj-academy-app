"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import {
  BELT_CLASSES,
  BELT_LABELS,
} from "@mybjj/backend/convex/lib/validators";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AdminShell } from "@/components/dashboard";
import { PortalImage } from "@/components/portal-image";
import { SessionAttendancePicker } from "@/components/session-attendance-picker";

const hour = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const dateLabel = (date: string) => date.split("-").reverse().join("/");
const rosterLabel = {
  Confirmed: "Confirmado pelo aluno",
  Present: "Presente",
  Absent: "Falta",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : fallback;
}

function RegisterClassDate({
  classId,
  today,
  onRegistered,
}: {
  classId: Id<"classes">;
  today: string;
  onRegistered: (id: Id<"classSessions">) => void;
}) {
  const record = useMutation(api.classSessions.recordClassDate);
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onRegistered(await record({ classId, date }));
    } catch (cause) {
      setError(errorMessage(cause, "Não foi possível registrar a aula."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="academy-card">
      <header>
        <h2>Registrar aula realizada</h2>
      </header>
      <form className="class-history-record" onSubmit={submit}>
        <label className="management-field">
          <span>Data da aula</span>
          <input
            required
            type="date"
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <button className="button secondary" type="submit" disabled={busy}>
          {busy ? "Registrando..." : "Registrar aula"}
        </button>
      </form>
      {error && (
        <p className="payment-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function SessionRecord({
  sessionId,
  date,
  title,
  startsAt,
}: {
  sessionId: Id<"classSessions">;
  date: string;
  title: string;
  startsAt: number;
}) {
  const data = useQuery(api.classSessions.getStaffSessionLog, { sessionId });
  const save = useMutation(api.classSessions.saveStaffSessionLog);
  const [draftNotes, setDraftNotes] = useState<string>();
  const [draftTeacherId, setDraftTeacherId] = useState<string>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!data) return <p role="status">Carregando registro da aula...</p>;

  const teacherId =
    draftTeacherId ??
    data.leadTeacher?.id ??
    (data.teachers.length === 1 ? data.teachers[0].id : "");
  const notes = draftNotes ?? data.notes;
  const viewer = data.teachers.find(
    (teacher) => teacher.id === data.viewerTeacherId,
  );
  const canSave = !data.isAdmin || Boolean(teacherId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await save({
        sessionId,
        ledByTeacherId: teacherId ? (teacherId as Id<"teachers">) : undefined,
        notes,
      });
      setDraftNotes(undefined);
      setDraftTeacherId(undefined);
      setMessage("Registro salvo.");
    } catch (cause) {
      setError(errorMessage(cause, "Não foi possível salvar o registro."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="academy-card class-history-session"
      aria-labelledby="class-session-heading"
    >
      <header>
        <h2 id="class-session-heading">Aula de {dateLabel(date)}</h2>
      </header>
      <form className="class-history-form" onSubmit={submit}>
        {data.isAdmin ? (
          <label className="management-field">
            <span>Professor responsável</span>
            <select
              required
              value={teacherId}
              disabled={busy}
              onChange={(event) => setDraftTeacherId(event.target.value)}
            >
              <option value="">Selecione um professor</option>
              {data.eligibleTeachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div>
            <strong>Professor responsável</strong>
            <p>{data.leadTeacher?.name ?? viewer?.name ?? "—"}</p>
          </div>
        )}
        <label className="management-field">
          <span>Observações da aula (opcional)</span>
          <textarea
            rows={4}
            maxLength={3000}
            disabled={busy}
            value={notes}
            onChange={(event) => setDraftNotes(event.target.value)}
            placeholder="Ex.: técnicas praticadas ou observações sobre a turma"
          />
        </label>
        <button
          className="button primary"
          type="submit"
          disabled={busy || !canSave}
        >
          {busy ? "Salvando..." : "Salvar registro"}
        </button>
        {message && <p role="status">{message}</p>}
        {error && (
          <p className="payment-error" role="alert">
            {error}
          </p>
        )}
      </form>
      <div className="class-session-roster">
        <h3>Alunos da aula ({data.students.length})</h3>
        <SessionAttendancePicker
          sessionId={sessionId}
          title={title}
          schedule={`${dateLabel(date)}, ${hour.format(startsAt)}`}
          roster={data.students}
          availableStudents={data.availableStudents}
        />
        {data.students.length ? (
          <ul className="class-session-students">
            {data.students.map((student) => (
              <li key={student.id}>
                <div className="student-identity">
                  <PortalImage
                    src={student.picture}
                    className="professor-avatar"
                    fallback={
                      <span aria-hidden="true">
                        {student.name
                          .trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part.charAt(0))
                          .join("")
                          .toLocaleUpperCase("pt-BR")}
                      </span>
                    }
                  />
                  <div className="class-session-student-info">
                    <Link href={`/alunos/${student.id}`}>
                      <strong>{student.name}</strong>
                    </Link>
                    <div className="class-session-student-belt">
                      <span className="belt-badge">
                        <i
                          className={`belt-dot ${BELT_CLASSES[student.belt]}`}
                          aria-hidden="true"
                        />
                        {BELT_LABELS[student.belt]}
                      </span>
                      <small>
                        {student.degree}{" "}
                        {student.degree === 1 ? "Grau" : "Graus"}
                      </small>
                    </div>
                  </div>
                </div>
                <span
                  className={`student-status ${student.status === "Present" ? "active" : student.status === "Absent" ? "inactive" : "pending"}`}
                >
                  {rosterLabel[student.status]}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">Nenhum aluno registrado nesta aula.</p>
        )}
      </div>
    </section>
  );
}

export function ClassDetailsPage({ classId }: { classId: Id<"classes"> }) {
  const history = useQuery(api.classSessions.getStaffClassHistory, { classId });
  const profile = useQuery(api.onboarding.getOnboardingStatus);
  const requestedSession = useSearchParams().get("sessao");
  const [selectedId, setSelectedId] = useState<Id<"classSessions">>();
  const session =
    history?.sessions.find(
      (item) => item._id === (selectedId ?? requestedSession),
    ) ?? history?.sessions[0];
  const teacher = profile?.status === "ready" && !profile.isAdmin;
  const actions = (
    <>
      <Link className="button secondary" href="/aulas">
        ← Voltar
      </Link>
      {history?.isAdmin && (
        <Link className="button primary" href={`/aulas/${classId}/editar`}>
          Editar aula
        </Link>
      )}
    </>
  );

  return (
    <AdminShell
      title="Detalhes da Aula"
      breadcrumb="Aulas / Detalhes"
      actions={actions}
      teacher={teacher}
    >
      <main className="academy-content">
        {history === undefined ? (
          <p role="status">Carregando histórico de aulas...</p>
        ) : !history ? (
          <p>Aula não encontrada ou indisponível para sua conta.</p>
        ) : (
          <>
            <section className="academy-card">
              <header>
                <h2>{history.title}</h2>
              </header>
              {history.sessions.length ? (
                <label className="management-field class-history-picker">
                  <span>Histórico de aulas</span>
                  <select
                    value={session?._id}
                    onChange={(event) =>
                      setSelectedId(event.target.value as Id<"classSessions">)
                    }
                  >
                    {history.sessions.map((item) => (
                      <option key={item._id} value={item._id}>
                        {dateLabel(item.sessionDate)} ·{" "}
                        {hour.format(item.startsAt)}
                        {item.status === "Scheduled"
                          ? " · Registro pendente"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="empty-copy">
                  Nenhuma sessão registrada para esta aula.
                </p>
              )}
            </section>
            {session && (
              <SessionRecord
                key={session._id}
                sessionId={session._id}
                date={session.sessionDate}
                title={history.title}
                startsAt={session.startsAt}
              />
            )}
            {history.canRecord && (
              <RegisterClassDate
                classId={classId}
                today={history.today}
                onRegistered={setSelectedId}
              />
            )}
          </>
        )}
      </main>
    </AdminShell>
  );
}
