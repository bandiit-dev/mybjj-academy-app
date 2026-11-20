"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import {
  BELT_CLASSES,
  BELT_LABELS,
} from "@mybjj/backend/convex/lib/validators";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useId, useRef, useState, type FormEvent } from "react";
import styles from "./session-attendance-picker.module.css";

type SessionLog = FunctionReturnType<
  typeof api.classSessions.getStaffSessionLog
>;

function searchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function SessionAttendancePicker({
  sessionId,
  title,
  schedule,
  roster,
  availableStudents,
}: {
  sessionId: Id<"classSessions">;
  title: string;
  schedule: string;
  roster: SessionLog["students"];
  availableStudents: SessionLog["availableStudents"];
}) {
  const mark = useMutation(api.classSessions.markStaffSessionPresences);
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Id<"students">[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const present = roster.filter((student) => student.status === "Present");
  const students = [
    ...present.map((student) => ({ ...student, present: true })),
    ...availableStudents.map((student) => ({ ...student, present: false })),
  ];
  const pending = availableStudents
    .filter((student) => selected.includes(student.id))
    .map((student) => student.id);
  const query = searchText(search.trim());
  const visible = students.filter((student) =>
    searchText(student.name).includes(query),
  );

  function open() {
    setSearch("");
    setSelected([]);
    setError("");
    setMessage("");
    dialog.current?.showModal();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || pending.length === 0) return;
    setBusy(true);
    setError("");
    try {
      await mark({ sessionId, studentIds: pending });
      dialog.current?.close();
      setMessage(
        pending.length === 1
          ? "Presença registrada."
          : `${pending.length} presenças registradas.`,
      );
    } catch (cause) {
      setError(
        cause instanceof ConvexError && typeof cause.data === "string"
          ? cause.data
          : "Não foi possível registrar as presenças.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="button secondary" type="button" onClick={open}>
        Marcar presença
      </button>
      {message && <p role="status">{message}</p>}
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={headingId}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.header}>
            <h3 id={headingId}>{title}</h3>
            <p>
              {schedule} · {present.length} de {students.length} presentes
            </p>
            <label className="management-field">
              <span className="sr-only">Buscar aluno</span>
              <input
                type="search"
                placeholder="Buscar aluno"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
          <ul className={styles.list} aria-label="Alunos da academia">
            {visible.map((student) => (
              <li key={student.id}>
                <label className={styles.row}>
                  <input
                    type="checkbox"
                    checked={student.present || selected.includes(student.id)}
                    disabled={student.present || busy}
                    onChange={(event) => {
                      const { checked } = event.target;
                      setSelected((ids) =>
                        checked
                          ? [...ids, student.id]
                          : ids.filter((id) => id !== student.id),
                      );
                    }}
                  />
                  <span className={styles.student}>
                    <span>{student.name}</span>
                    <small>
                      {BELT_LABELS[student.belt]} {student.degree}°
                      {student.present && " · Presença registrada"}
                    </small>
                  </span>
                  <span
                    className={`belt-line ${BELT_CLASSES[student.belt]} ${styles.belt}`}
                    aria-hidden="true"
                  >
                    <span className={styles.stripes}>
                      {Array.from({ length: student.degree }, (_, index) => (
                        <i key={index} />
                      ))}
                    </span>
                  </span>
                </label>
              </li>
            ))}
            {visible.length === 0 && (
              <li className={styles.empty}>Nenhum aluno encontrado.</li>
            )}
          </ul>
          <div className={styles.footer}>
            {error && <p role="alert">{error}</p>}
            <div className={styles.actions}>
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => dialog.current?.close()}
              >
                {pending.length ? "Cancelar" : "Fechar"}
              </button>
              <button
                className="button primary"
                type="submit"
                disabled={busy || !pending.length}
              >
                {busy ? "Salvando..." : `Salvar presenças (${pending.length})`}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
