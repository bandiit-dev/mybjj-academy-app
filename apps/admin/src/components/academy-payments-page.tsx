"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import { lastCoveredDay } from "@mybjj/backend/convex/lib/studentPlans";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useState } from "react";
import { AdminShell } from "@/components/dashboard";
import { useAcademyDay } from "@/hooks/use-academy-day";

type PaymentRow = FunctionReturnType<
  typeof api.studentPlans.getAcademyPaymentOverview
>["rows"][number];
type PaymentStatus = PaymentRow["status"];

const statuses = {
  paid: { label: "Pago", style: "paid" },
  pending: { label: "Pendente", style: "pending" },
  overdue: { label: "Em atraso", style: "inactive" },
  inactive: { label: "Plano inativo", style: "neutral" },
  upcoming: { label: "Ainda não iniciado", style: "neutral" },
} satisfies Record<PaymentStatus, { label: string; style: string }>;

const reminderLabels = {
  sent: "Aceito para envio",
  failed: "Última tentativa falhou",
  processing: "Envio em andamento",
};

const summary = [
  { status: "overdue", label: "Em atraso" },
  { status: "pending", label: "Pendentes" },
  { status: "paid", label: "Pagos" },
] as const;

const statusOrder = ["overdue", "pending", "paid", "upcoming", "inactive"];
const pageSize = 20;
const monthLabel = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const reminderDate = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const dateLabel = (date: string | null) =>
  date ? date.split("-").reverse().join("/") : "—";
const searchable = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");

export function AcademyPaymentsPage() {
  const refreshDay = useAcademyDay();
  const data = useQuery(api.studentPlans.getAcademyPaymentOverview, {
    refreshDay,
  });
  const [search, setSearch] = useState("");
  const [unit, setUnit] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);

  const units = new Map(data?.units.map(({ id, name }) => [id, name]));
  const unitRows =
    data?.rows.filter(
      (row) => !unit || row.unitIds.some((id) => id === unit),
    ) ?? [];
  const term = searchable(search.trim());
  const rows = unitRows
    .filter(
      (row) =>
        (!status || row.status === status) &&
        searchable(row.name).includes(term),
    )
    .sort(
      (a, b) =>
        statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status) ||
        a.name.localeCompare(b.name, "pt-BR"),
    );

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const month = monthLabel.format(
    new Date(`${data?.today ?? refreshDay}T12:00:00Z`),
  );

  return (
    <AdminShell title="Gestão de mensalidades" breadcrumb="Mensalidades">
      <main className="students-content">
        <section aria-labelledby="payments-summary">
          <h2 id="payments-summary" className="payment-month-heading">
            Situação em {month}
          </h2>
          <div className="metrics-grid">
            {summary.map((item) => (
              <div className="metric-card" key={item.status}>
                <div className="metric-heading">
                  <span>{item.label}</span>
                </div>
                <div className="metric-value">
                  <strong>
                    {data
                      ? unitRows.filter((row) => row.status === item.status)
                          .length
                      : "—"}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="filters-bar" aria-label="Filtros de pagamentos">
          <label className="search-field">
            <span className="sr-only">Buscar aluno</span>
            <input
              value={search}
              placeholder="Buscar aluno..."
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <label className="filter-select">
            <span>Unidade</span>
            <select
              value={unit}
              onChange={(event) => {
                setUnit(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Todas</option>
              {data?.units.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-select">
            <span>Situação</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Todas</option>
              {Object.entries(statuses).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section
          className="students-table-card"
          aria-label="Pagamentos dos alunos"
        >
          {data === undefined ? (
            <p className="students-empty" role="status">
              Carregando pagamentos...
            </p>
          ) : rows.length === 0 ? (
            <p className="students-empty" role="status">
              {data.rows.length
                ? "Nenhum aluno encontrado com esses filtros."
                : "Nenhum aluno cadastrado na academia."}
            </p>
          ) : (
            <>
              <div className="table-scroll">
                <table className="payments-table academy-payments-table">
                  <thead>
                    <tr>
                      <th scope="col">Aluno</th>
                      <th scope="col">Unidade</th>
                      <th scope="col">Plano / período</th>
                      <th scope="col">Vencimento</th>
                      <th scope="col">Situação</th>
                      <th scope="col">Pagamento</th>
                      <th scope="col">Lembrete por e-mail</th>
                      <th scope="col">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      .slice(
                        currentPage * pageSize,
                        (currentPage + 1) * pageSize,
                      )
                      .map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.name}</strong>
                          </td>
                          <td>
                            {row.unitIds
                              .map((id) => units.get(id))
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </td>
                          <td>
                            <strong>{row.planType}</strong>
                            {row.period && (
                              <small>
                                {dateLabel(row.period.periodStart)} a{" "}
                                {dateLabel(
                                  lastCoveredDay(row.period.periodEnd),
                                )}
                              </small>
                            )}
                          </td>
                          <td>{dateLabel(row.dueDate)}</td>
                          <td>
                            <span
                              className={`student-status ${statuses[row.status].style}`}
                            >
                              {statuses[row.status].label}
                            </span>
                          </td>
                          <td>{dateLabel(row.paidOn)}</td>
                          <td>
                            {row.reminder
                              ? reminderLabels[row.reminder.status]
                              : row.planType === "Mensal" && row.period
                                ? "Sem registro"
                                : "—"}
                            {row.reminder?.at != null && (
                              <small>
                                {reminderDate.format(row.reminder.at)}
                              </small>
                            )}
                          </td>
                          <td>
                            <Link
                              className="card-action"
                              href={`/alunos/${row.id}`}
                              aria-label={`Ver pagamentos de ${row.name}`}
                            >
                              Ver pagamentos
                            </Link>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="students-pagination">
                <span>
                  {rows.length} {rows.length === 1 ? "aluno" : "alunos"} ·
                  Página {currentPage + 1} de {pageCount}
                </span>
                {pageCount > 1 && (
                  <nav aria-label="Páginas de pagamentos">
                    <button
                      type="button"
                      disabled={currentPage === 0}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      disabled={currentPage + 1 >= pageCount}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      Próxima
                    </button>
                  </nav>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </AdminShell>
  );
}
