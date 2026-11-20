"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { BELT_LABELS } from "@mybjj/backend/convex/lib/validators";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { AdminShell } from "@/components/dashboard";
import { PortalImage } from "@/components/portal-image";

const pageSize = 12;
const time = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function TeacherDetailsPage({
  teacherId,
}: {
  teacherId?: Id<"teachers">;
}) {
  const history = useQuery(api.classSessions.getTeacherClassHistory, {
    teacherId,
  });
  const [page, setPage] = useState(0);
  const teacher = history?.teacher;
  const classes = history?.classes ?? [];
  const pageCount = Math.max(1, Math.ceil(classes.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const actions = (
    <>
      <Link
        className="button secondary"
        href={teacherId ? "/professores" : "/aulas"}
      >
        ← Voltar
      </Link>
      {history?.isAdmin && teacher && (
        <Link
          className="button primary"
          href={`/professores/${teacher.id}/editar`}
        >
          Editar professor
        </Link>
      )}
    </>
  );

  return (
    <AdminShell
      title={teacherId ? "Detalhes do Professor" : "Meu histórico"}
      breadcrumb={teacherId ? "Professores / Detalhes" : "Meu histórico"}
      actions={actions}
      teacher={!teacherId && !history?.isAdmin}
    >
      <main className="academy-content">
        {history === undefined ? (
          <p role="status">Carregando histórico...</p>
        ) : teacher ? (
          <>
            <section className="academy-card">
              <header>
                <div className="student-detail-heading">
                  <PortalImage
                    src={teacher.picture}
                    className="professor-avatar"
                    fallback={teacher.name.slice(0, 2).toUpperCase()}
                  />
                  <h2>{teacher.name}</h2>
                </div>
              </header>
              <p>
                {[teacher.role, `Faixa ${BELT_LABELS[teacher.belt]}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </section>
            <section
              className="academy-card student-billing"
              aria-labelledby="teaching-history-heading"
            >
              <header>
                <h2 id="teaching-history-heading">Aulas ministradas</h2>
                <span className="student-status active">
                  {classes.length} {classes.length === 1 ? "aula" : "aulas"}
                </span>
              </header>
              {classes.length === 0 ? (
                <p className="empty-copy">
                  Nenhuma aula ministrada registrada.
                </p>
              ) : (
                <>
                  <div className="table-scroll">
                    <table className="payments-table attendance-table">
                      <thead>
                        <tr>
                          <th scope="col">Aula</th>
                          <th scope="col">Data</th>
                          <th scope="col">Horário</th>
                          <th scope="col">Unidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classes
                          .slice(
                            currentPage * pageSize,
                            (currentPage + 1) * pageSize,
                          )
                          .map((item) => (
                            <tr key={item.sessionId}>
                              <td>
                                {item.classId ? (
                                  <Link
                                    className="teacher-history-link"
                                    href={`/aulas/${item.classId}?sessao=${item.sessionId}`}
                                  >
                                    <strong>{item.title}</strong>
                                  </Link>
                                ) : (
                                  <strong>{item.title}</strong>
                                )}
                              </td>
                              <td>
                                {item.date.split("-").reverse().join("/")}
                              </td>
                              <td>{time.format(item.startsAt)}</td>
                              <td>{item.units.join(", ") || "—"}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {pageCount > 1 && (
                    <div className="students-pagination">
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
          </>
        ) : (
          <p>Professor não encontrado ou indisponível para sua conta.</p>
        )}
      </main>
    </AdminShell>
  );
}
