"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import { api } from "@mybjj/backend/convex/_generated/api";
import { academyToday } from "@mybjj/backend/convex/lib/studentPlans";
import {
  BELT_CLASSES,
  BELT_LABELS,
} from "@mybjj/backend/convex/lib/validators";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useEffect, useId, useRef, useState } from "react";
import { AdminShell } from "@/components/dashboard";
import styles from "./student-portal.module.css";

type Overview = FunctionReturnType<typeof api.studentPortal.getOverview>;
type ClassEntry = Overview["classes"][number];
type Section = "home" | "classes" | "profile";

const sectionTitle = {
  home: "Visão Geral",
  classes: "Aulas",
  profile: "Meu Perfil",
};
const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const dateOnly = (date: string) => new Date(`${date}T12:00:00Z`);
const longDate = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const paymentDate = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const hour = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function formatPaymentDate(date: string | null) {
  return date
    ? paymentDate
        .formatToParts(dateOnly(date))
        .filter((part) => part.type !== "literal")
        .map((part) => part.value.replace(".", ""))
        .join(" ")
    : "—";
}

function WeeklySummary({ week, today }: Pick<Overview, "week" | "today">) {
  const [selectedDate, setSelectedDate] = useState<string>();
  const trainedDays = week.days.filter((day) => day.attended).length;
  const range = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).formatRange(dateOnly(week.days[0].date), dateOnly(week.days[6].date));

  return (
    <section
      className={`${styles.card} ${styles.week}`}
      aria-labelledby="student-week-heading"
    >
      <div className={styles.weekTotal}>
        <h2 id="student-week-heading" className={styles.eyebrow}>
          Seu resumo da semana
        </h2>
        <div className={styles.totalRow}>
          <strong>{week.total}</strong>
          <div>
            <b>
              {week.total === 1 ? "aula nesta semana" : "aulas nesta semana"}
            </b>
            <p>Presenças confirmadas</p>
          </div>
        </div>
        <p>{range}</p>
      </div>
      <div className={styles.frequency}>
        <div className={styles.between}>
          <h3>Sua frequência</h3>
          <span className={`${styles.badge} ${styles.positive}`}>
            {trainedDays}{" "}
            {trainedDays === 1 ? "dia de treino" : "dias de treino"}
          </span>
        </div>
        <ol className={styles.days}>
          {week.days.map((day, index) => (
            <li key={day.date}>
              <button
                type="button"
                className={day.date === today ? styles.today : undefined}
                aria-current={day.date === today ? "date" : undefined}
                aria-haspopup="dialog"
                aria-label={`Ver aulas de ${longDate.format(dateOnly(day.date))}${day.attended ? ", presença registrada" : ""}`}
                onClick={() => setSelectedDate(day.date)}
              >
                <span>{weekdays[index]}</span>
                <strong className={day.attended ? styles.attended : undefined}>
                  {Number(day.date.slice(-2))}
                </strong>
                <span className={day.attended ? styles.present : undefined}>
                  {day.attended
                    ? "Presente"
                    : day.date === today
                      ? "Hoje"
                      : "—"}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      {selectedDate && (
        <DateAttendanceDialog
          date={selectedDate}
          today={today}
          onClose={() => setSelectedDate(undefined)}
        />
      )}
    </section>
  );
}

function ClassRow({
  entry,
  date,
  canConfirm,
}: {
  entry: ClassEntry;
  date: string;
  canConfirm: boolean;
}) {
  const confirm = useMutation(api.studentPortal.confirmClass);
  const cancel = useMutation(api.enrollments.cancelEnrollment);
  const classSessionId = entry.sessionId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const details = [entry.teachers.join(", "), entry.units.join(", ")]
    .filter(Boolean)
    .join(" · ");
  const confirmed =
    entry.attendance === "Present" ||
    (entry.confirmed && entry.attendance !== "Absent");

  async function updatePresence(
    change: () => Promise<unknown>,
    failureMessage: string,
  ) {
    setBusy(true);
    setError("");
    try {
      await change();
    } catch (cause) {
      setError(
        cause instanceof ConvexError && typeof cause.data === "string"
          ? cause.data
          : failureMessage,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={styles.classRow}>
      <div>
        <strong className={styles.classTime}>
          {hour.format(entry.startsAt)}
        </strong>
        {entry.endsAt !== null && <p>até {hour.format(entry.endsAt)}</p>}
      </div>
      <div className={styles.classInfo}>
        <strong>{entry.title}</strong>
        {details && <p>{details}</p>}
      </div>
      {confirmed ? (
        <div className={styles.confirmedActions}>
          <span className={`${styles.badge} ${styles.positive}`}>
            Presença confirmada
          </span>
          {entry.attendance === null && classSessionId && (
            <button
              className={styles.cancelConfirmation}
              type="button"
              disabled={busy}
              aria-label={`Cancelar confirmação em ${entry.title}, às ${hour.format(entry.startsAt)}`}
              onClick={() =>
                updatePresence(
                  () => cancel({ classSessionId }),
                  "Não foi possível cancelar a confirmação. Tente novamente.",
                )
              }
            >
              {busy ? "Cancelando..." : "Cancelar confirmação"}
            </button>
          )}
        </div>
      ) : entry.attendance === "Absent" ? (
        <span className={styles.badge}>Falta registrada</span>
      ) : (
        canConfirm && (
          <button
            className={`button primary ${styles.confirmButton}`}
            type="button"
            disabled={busy}
            aria-label={`Confirmar presença em ${entry.title}, às ${hour.format(entry.startsAt)}`}
            onClick={() =>
              updatePresence(
                () =>
                  confirm(
                    entry.sessionId
                      ? { sessionId: entry.sessionId }
                      : { classId: entry.classId, date },
                  ),
                "Não foi possível confirmar a presença. Tente novamente.",
              )
            }
          >
            {busy ? "Confirmando..." : "Confirmar presença"}
          </button>
        )
      )}
      {error && (
        <p className={styles.classError} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

function ClassList({
  entries,
  date,
  today,
  onClose,
}: {
  entries: ClassEntry[] | undefined;
  date: string;
  today: string;
  onClose?: () => void;
}) {
  const headingId = useId();
  return (
    <section
      className={`${styles.card} ${styles.classes}`}
      aria-labelledby={headingId}
    >
      <div className={styles.between}>
        <div>
          <h2 id={headingId}>
            {date === today ? "Aulas de hoje" : "Aulas do dia"}
          </h2>
          <p className={styles.classDate}>{longDate.format(dateOnly(date))}</p>
        </div>
        {onClose ? (
          <button className="button secondary" type="button" onClick={onClose}>
            Fechar
          </button>
        ) : (
          entries && (
            <span className={styles.badge}>
              {entries.length} {entries.length === 1 ? "aula" : "aulas"}
            </span>
          )
        )}
      </div>
      {entries === undefined ? (
        <p role="status">Carregando aulas...</p>
      ) : entries.length ? (
        <>
          <ul className={styles.classList}>
            {entries.map((entry) => (
              <ClassRow
                key={entry.sessionId ?? entry.classId}
                entry={entry}
                date={date}
                canConfirm={date <= today}
              />
            ))}
          </ul>
          {date === today && <p>Treinou hoje? Confirme sua presença!</p>}
          {onClose && date > today && (
            <p>A confirmação de presença fica disponível no dia da aula.</p>
          )}
        </>
      ) : (
        <p>Nenhuma aula agendada para este dia.</p>
      )}
    </section>
  );
}

function DateAttendanceDialog({
  date,
  today,
  onClose,
}: {
  date: string;
  today: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const entries = useQuery(api.studentPortal.getSchedule, { date });

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className={styles.attendanceDialog}
      aria-label={`Aulas de ${longDate.format(dateOnly(date))}`}
      onClose={onClose}
    >
      <ClassList
        entries={entries}
        date={date}
        today={today}
        onClose={() => dialog.current?.close()}
      />
    </dialog>
  );
}

function Graduation({ profile }: Pick<Overview, "profile">) {
  return (
    <section className={`${styles.card} ${styles.graduation}`}>
      <h2>Minha graduação</h2>
      <div
        className={`belt-line ${BELT_CLASSES[profile.belt]} ${styles.belt}`}
        aria-hidden="true"
      >
        <div className={styles.rank}>
          {Array.from({ length: profile.degree }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>
      <div className={styles.between}>
        <strong>
          Faixa {BELT_LABELS[profile.belt].toLocaleLowerCase("pt-BR")}
        </strong>
        <span className={styles.badge}>
          {profile.degree ? `${profile.degree}º grau` : "Sem grau"}
        </span>
      </div>
      <p>Cada treino é mais um passo na sua jornada.</p>
    </section>
  );
}

function PaymentSummary({ payments }: Pick<Overview, "payments">) {
  const status = {
    paid: "Em dia",
    pending: "Pendente",
    inactive: "Inativo",
    upcoming: "A iniciar",
  };
  const title = {
    Mensal: "Mensalidade",
    Semestral: "Plano semestral",
    Anual: "Plano anual",
  };
  return (
    <section className={`${styles.card} ${styles.payments}`}>
      <div className={styles.between}>
        <h2>{title[payments.type]}</h2>
        <span
          className={`${styles.badge} ${payments.status === "paid" ? styles.positive : ""}`}
        >
          {status[payments.status]}
        </span>
      </div>
      <div>
        <p>Último pagamento</p>
        <div className={styles.between}>
          <strong>{formatPaymentDate(payments.lastPayment)}</strong>
          {payments.lastPayment && <span className={styles.present}>Pago</span>}
        </div>
      </div>
      <div className={styles.dueDate}>
        <p>
          {payments.status === "pending"
            ? "Vencimento do período"
            : "Próximo vencimento"}
        </p>
        <strong>{formatPaymentDate(payments.dueDate)}</strong>
      </div>
    </section>
  );
}

function StudentSchedule({ today }: { today: string }) {
  const [selected, setSelected] = useState("");
  const date = selected || today;
  const classes = useQuery(api.studentPortal.getSchedule, { date });
  return (
    <>
      <label className={styles.datePicker}>
        Data da aula
        <input
          type="date"
          min="1900-01-01"
          max="2199-12-31"
          value={date}
          onChange={(event) => {
            if (!event.target.value || event.target.validity.valid)
              setSelected(event.target.value);
          }}
        />
      </label>
      <ClassList entries={classes} date={date} today={today} />
    </>
  );
}

export function StudentPortal({ section = "home" }: { section?: Section }) {
  const { user } = useUser();
  const [refreshDay, setRefreshDay] = useState(academyToday);
  const overview = useQuery(api.studentPortal.getOverview, { refreshDay });
  useEffect(() => {
    const timer = window.setInterval(
      () => setRefreshDay(academyToday()),
      30_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  if (!overview)
    return (
      <main className="auth-state" role="status">
        <strong>Carregando painel...</strong>
      </main>
    );

  const { profile, today } = overview;
  const name = profile.name.trim().split(/\s+/)[0] || user?.firstName?.trim();
  return (
    <AdminShell
      title={sectionTitle[section]}
      breadcrumb={section === "home" ? "Visão geral" : sectionTitle[section]}
      student={{ ...profile, beltLabel: BELT_LABELS[profile.belt] }}
    >
      <main className={styles.content}>
        {section === "home" && (
          <>
            <div className={styles.welcome}>
              <h2>
                {name ? `Olá, ${name}.` : "Olá!"}
                <br /> Vamos treinar?
              </h2>
              <p>
                Acompanhe seus treinos, confirme suas presenças e continue
                evoluindo.
              </p>
            </div>
            <WeeklySummary week={overview.week} today={today} />
            <div className={styles.details}>
              <ClassList
                entries={overview.classes}
                date={today}
                today={today}
              />
              <div className={styles.sideCards}>
                <Graduation profile={profile} />
                <PaymentSummary payments={overview.payments} />
              </div>
            </div>
          </>
        )}
        {section === "classes" && <StudentSchedule today={today} />}
        {section === "profile" && (
          <div className={styles.details}>
            <section className={styles.card}>
              <h2>{profile.name}</h2>
              {profile.email && <p>{profile.email}</p>}
              {profile.phone && <p>{profile.phone}</p>}
              <SignOutButton redirectUrl="/">
                <button className="button secondary" type="button">
                  Sair
                </button>
              </SignOutButton>
            </section>
            <Graduation profile={profile} />
          </div>
        )}
      </main>
    </AdminShell>
  );
}
