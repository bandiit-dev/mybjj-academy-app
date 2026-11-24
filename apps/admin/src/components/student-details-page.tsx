"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import Link from "next/link";
import { api } from "@mybjj/backend/convex/_generated/api";
import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { BELT_LABELS } from "@mybjj/backend/convex/lib/validators";
import {
  getStudentPlan,
  paymentKey,
  type PlanType,
} from "@mybjj/backend/convex/lib/studentPlans";
import { AdminShell } from "@/components/dashboard";
import { PortalImage } from "@/components/portal-image";
import { StudentGraduationHistory } from "@/components/student-graduation-history";
import { useAcademyDay } from "@/hooks/use-academy-day";

const dateLabel = (date?: string) =>
  date ? date.split("-").reverse().join("/") : "—";
const attendanceTime = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
function lastCoveredDay(exclusiveEnd: string) {
  return new Date(new Date(`${exclusiveEnd}T00:00:00Z`).getTime() - 86400000)
    .toISOString()
    .slice(0, 10);
}
type PaymentPeriod = {
  planType: PlanType;
  periodStart: string;
  periodEnd: string;
  paid: boolean;
  paidOn: string;
  notes: string;
  updatedAt: number;
  dueDate: string | null;
};

function PaymentRow({
  studentId,
  period,
  today,
  active,
}: {
  studentId: Id<"students">;
  period: PaymentPeriod;
  today: string;
  active: boolean;
}) {
  const save = useMutation(api.studentPlans.setPayment);
  const [paidOn, setPaidOn] = useState(period.paidOn || today);
  const [notes, setNotes] = useState(period.notes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overdue = active && period.dueDate !== null && today > period.dueDate;
  async function record(paid: boolean) {
    setBusy(true);
    setError(null);
    try {
      await save({
        studentId,
        planType: period.planType,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        paid,
        paidOn: paid ? paidOn : undefined,
        notes,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível registrar o pagamento.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <tr>
      <td>
        <strong>{period.planType}</strong>
        <small>
          {dateLabel(period.periodStart)} a{" "}
          {dateLabel(lastCoveredDay(period.periodEnd))}
        </small>
        {period.dueDate && (
          <small>Vencimento em {dateLabel(period.dueDate)}</small>
        )}
      </td>
      <td>
        <span
          className={`student-status ${period.paid ? "paid" : overdue ? "inactive" : "pending"}`}
        >
          {period.paid ? "Pago" : overdue ? "Em atraso" : "Pendente"}
        </span>
      </td>
      <td>
        <label className="management-field">
          <span className="sr-only">
            Data do pagamento do período iniciado em{" "}
            {dateLabel(period.periodStart)}
          </span>
          <input
            type="date"
            value={paidOn}
            max={today}
            disabled={busy}
            onChange={(event) => setPaidOn(event.target.value)}
          />
        </label>
      </td>
      <td>
        <label className="management-field">
          <span className="sr-only">
            Observação do período iniciado em {dateLabel(period.periodStart)}
          </span>
          <input
            value={notes}
            maxLength={2000}
            placeholder="Observação (opcional)"
            disabled={busy}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
      </td>
      <td>
        <div className="payment-actions">
          <button
            className="button primary"
            type="button"
            disabled={busy || !paidOn}
            onClick={() => record(true)}
          >
            {busy
              ? "Salvando..."
              : period.paid
                ? "Salvar registro"
                : "Marcar como pago"}
          </button>
          {period.paid && (
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => record(false)}
            >
              Marcar pendente
            </button>
          )}
        </div>
        {error && (
          <p className="payment-error" role="alert">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}

function StudentBilling({ studentId }: { studentId: Id<"students"> }) {
  const refreshDay = useAcademyDay();
  const data = useQuery(api.studentPlans.getStudentBilling, {
    studentId,
    refreshDay,
  });
  const [scope, setScope] = useState("history");
  const [page, setPage] = useState(0);
  if (data === undefined)
    return (
      <section className="academy-card">
        Carregando histórico de pagamentos...
      </section>
    );
  const rows = data.periods.filter((period) => {
    const start = period.dueDate
      ? `${period.dueDate.slice(0, 7)}-01`
      : period.periodStart;
    return scope === "future" ? start > data.today : start <= data.today;
  });
  const pageCount = Math.max(1, Math.ceil(rows.length / 12));
  const currentPage = Math.min(page, pageCount - 1);
  return (
    <section className="academy-card student-billing">
      <header>
        <div>
          <h2>Histórico de pagamentos</h2>
          <p className="account-access-help">
            Registre cada período manualmente. Alterar um pagamento preserva a
            situação ativa ou inativa definida pela academia.
          </p>
        </div>
        <label className="management-field">
          <span>Exibir</span>
          <select
            value={scope}
            onChange={(event) => {
              setScope(event.target.value);
              setPage(0);
            }}
          >
            <option value="history">Períodos atuais e anteriores</option>
            <option value="future">Próximos períodos</option>
          </select>
        </label>
      </header>
      <div className="table-scroll">
        <table className="payments-table">
          <thead>
            <tr>
              <th>Plano / período</th>
              <th>Situação</th>
              <th>Data do pagamento</th>
              <th>Observação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .slice(currentPage * 12, (currentPage + 1) * 12)
              .map((period) => (
                <PaymentRow
                  key={`${paymentKey(period)}:${period.updatedAt}`}
                  studentId={studentId}
                  period={period}
                  today={data.today}
                  active={data.student.plan.isActive}
                />
              ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="empty-copy">Nenhum período nesta visualização.</p>
      )}
      <div className="students-pagination">
        <span>
          {rows.length} períodos · Página {currentPage + 1} de {pageCount}
        </span>
        <div className="payment-actions">
          <button
            className="button secondary"
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={currentPage + 1 >= pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Próxima
          </button>
        </div>
      </div>
    </section>
  );
}

function StudentAttendance({ studentId }: { studentId: Id<"students"> }) {
  const history = useQuery(api.attendance.getStudentAttendanceHistory, {
    studentId,
  });
  const [page, setPage] = useState(0);
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil((history?.total ?? 0) / pageSize));
  const currentPage = Math.min(page, pageCount - 1);

  return (
    <section
      className="academy-card student-billing"
      aria-labelledby="student-attendance-heading"
    >
      <header>
        <h2 id="student-attendance-heading">Histórico de presenças</h2>
        {history && (
          <span className="student-status active">
            {history.total} {history.total === 1 ? "presença" : "presenças"}
          </span>
        )}
      </header>
      {!history ? (
        <p role="status">Carregando histórico de presenças...</p>
      ) : history.classes.length === 0 ? (
        <p className="empty-copy">Nenhuma presença registrada.</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="payments-table attendance-table">
              <thead>
                <tr>
                  <th>Aula</th>
                  <th>Data</th>
                  <th>Horário</th>
                  <th>Unidade</th>
                </tr>
              </thead>
              <tbody>
                {history.classes
                  .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                  .map((entry) => (
                    <tr key={entry.sessionId}>
                      <td>
                        <strong>{entry.title}</strong>
                      </td>
                      <td>{dateLabel(entry.date)}</td>
                      <td>{attendanceTime.format(entry.startsAt)}</td>
                      <td>{entry.units.join(", ") || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div
              className="students-pagination"
              aria-label="Paginação do histórico de presenças"
            >
              <span>
                Página {currentPage + 1} de {pageCount}
              </span>
              <div className="payment-actions">
                <button
                  className="button secondary"
                  type="button"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Anterior
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={currentPage + 1 >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function StudentDetailsPage({
  studentId,
}: {
  studentId: Id<"students">;
}) {
  const details = useQuery(api.students.getStudentDetailsForStaff, {
    studentId,
  });
  const profile = useQuery(api.onboarding.getOnboardingStatus);
  const teacher =
    profile?.status === "ready" &&
    !profile.isAdmin &&
    profile.profileType === "teacher";
  const student = details?.role === "admin" ? details.student : null;
  const units = useQuery(api.unities.getAllUnities, student ? {} : "skip");
  const setActive = useMutation(api.studentPlans.setPlanActive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actions =
    details?.role === "teacher" || teacher ? (
      <Link className="button secondary" href="/aulas">
        ← Voltar para aulas
      </Link>
    ) : (
      <>
        <Link className="button secondary" href="/alunos">
          ← Voltar
        </Link>
        <Link className="button primary" href={`/alunos/${studentId}/editar`}>
          Editar aluno
        </Link>
      </>
    );
  const plan = student ? getStudentPlan(student) : null;
  async function toggle() {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      await setActive({ studentId, isActive: !plan.isActive });
    } catch {
      setError("Não foi possível alterar a situação do aluno.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminShell
      title="Detalhes do Aluno"
      breadcrumb="Alunos / Detalhes"
      actions={actions}
      teacher={teacher}
    >
      <main className="academy-content">
        {error && (
          <div className="students-notice" role="alert">
            {error}
          </div>
        )}
        {details === undefined ? (
          <p>Carregando aluno...</p>
        ) : details?.role === "teacher" ? (
          <>
            <section className="academy-card">
              <header className="student-detail-heading">
                <PortalImage
                  src={details.student.picture}
                  className="professor-avatar"
                  fallback={details.student.name.slice(0, 2).toUpperCase()}
                />
                <h2>{details.student.name}</h2>
              </header>
              <p>
                Faixa {BELT_LABELS[details.student.belt]} ·{" "}
                {details.student.degree}{" "}
                {details.student.degree === 1 ? "grau" : "graus"}
              </p>
            </section>
            <StudentGraduationHistory studentId={studentId} />
          </>
        ) : !student || !plan ? (
          <p>Aluno não encontrado.</p>
        ) : (
          <>
            <section className="academy-card">
              <header>
                <div className="student-detail-heading">
                  <PortalImage
                    src={student.picture}
                    className="professor-avatar"
                    fallback={student.name.slice(0, 2).toUpperCase()}
                  />
                  <h2>{student.name}</h2>
                </div>
                <span
                  className={`student-status ${plan.isActive ? "active" : "inactive"}`}
                >
                  {plan.isActive ? "Ativo" : "Inativo"}
                </span>
              </header>
              <dl className="student-detail-grid">
                <div>
                  <dt>E-mail</dt>
                  <dd>{student.email || "—"}</dd>
                </div>
                <div>
                  <dt>Telefone</dt>
                  <dd>{student.phone || "—"}</dd>
                </div>
                <div>
                  <dt>Data de nascimento</dt>
                  <dd>{dateLabel(student.dateOfBirth)}</dd>
                </div>
                <div>
                  <dt>Faixa / grau</dt>
                  <dd>
                    {BELT_LABELS[student.belt]} · {student.degree} grau(s)
                  </dd>
                </div>
                <div>
                  <dt>Unidade</dt>
                  <dd>
                    {(units ?? [])
                      .filter((unit) => student.unityIds.includes(unit._id))
                      .map((unit) => unit.name ?? unit.address)
                      .join(", ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt>Cadastro</dt>
                  <dd>
                    {dateLabel(
                      new Date(student.createdAt).toISOString().slice(0, 10),
                    )}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="academy-card">
              <header>
                <h2>Plano {plan.type}</h2>
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy}
                  onClick={toggle}
                >
                  {busy
                    ? "Salvando..."
                    : plan.isActive
                      ? "Desativar aluno"
                      : "Ativar aluno"}
                </button>
              </header>
              <p>
                Início do plano: <strong>{dateLabel(plan.startDate)}</strong>
              </p>
              <p className="account-access-help">
                Desativar o aluno suspende o acesso ao aplicativo e preserva o
                histórico de pagamentos.
              </p>
            </section>
            <StudentGraduationHistory studentId={studentId} />
            <StudentAttendance key={studentId} studentId={studentId} />
            <StudentBilling studentId={studentId} />
          </>
        )}
      </main>
    </AdminShell>
  );
}
