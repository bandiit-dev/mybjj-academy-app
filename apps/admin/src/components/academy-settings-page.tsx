"use client";

import { AcademySubscriptionTile } from "./portal-subscription";
import { PortalImage } from "@/components/portal-image";
import { api } from "@mybjj/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import Link from "next/link";
import { AdminShell } from "@/components/dashboard";

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="academy-card">
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
export function AcademySettingsPage() {
  const gyms = useQuery(api.gyms.getAllGyms);
  const units = useQuery(api.unities.getAllUnities);
  const teachers = useQuery(api.teachers.getAllTeachers);
  const gym = gyms?.[0];
  const gymUnits = (units ?? []).filter((x) => x.gymId === gym?._id);
  const gymTeachers = (teachers ?? []).filter((x) =>
    gym?.teacherIds.includes(x._id),
  );
  return (
    <AdminShell title="Configurações da Academia" breadcrumb="Academia">
      <main className="academy-content">
        {gyms === undefined ? (
          <div className="students-empty">
            <strong>Carregando academia...</strong>
          </div>
        ) : !gym ? (
          <div className="students-empty">
            <strong>Nenhuma academia cadastrada</strong>
            <span>
              Cadastre uma academia no backend para configurá-la aqui.
            </span>
          </div>
        ) : (
          <>
            <AcademySubscriptionTile gymId={gym._id} />
            <Card
              title="Informações da Academia"
              action={
                <Link className="card-action" href="/academia/editar">
                  Editar
                </Link>
              }
            >
              <div className="academy-fields">
                <label className="academy-field">
                  <span>Nome da Academia</span>
                  <strong>{gym.name}</strong>
                </label>
                <label className="academy-field">
                  <span>CNPJ</span>
                  <strong>{gym.cnpj}</strong>
                </label>
                <label className="academy-field">
                  <span>E-mail de Contato</span>
                  <strong>{gym.email}</strong>
                </label>
                <label className="academy-field">
                  <span>Telefone</span>
                  <strong>{gym.phone}</strong>
                </label>
                <label className="academy-field">
                  <span>Data de Fundação</span>
                  <strong>{gym.founded}</strong>
                </label>
                <label className="academy-field">
                  <span>Data de Vencimento</span>
                  <strong>
                    {gym.studentPaymentDueDay === undefined
                      ? "Não definida"
                      : `Dia ${gym.studentPaymentDueDay} de cada mês`}
                  </strong>
                </label>
              </div>
            </Card>
            <Card
              title="Unidades e Endereços"
              action={
                <Link className="card-action" href="/unidades/nova">
                  Adicionar Unidade
                </Link>
              }
            >
              <div className="academy-units">
                {gymUnits.length ? (
                  gymUnits.map((x) => (
                    <article key={x._id}>
                      <strong>{x.name ?? x.address}</strong>
                      {x.name && <p>{x.address}</p>}
                    </article>
                  ))
                ) : (
                  <p className="empty-copy">Nenhuma unidade cadastrada.</p>
                )}
              </div>
            </Card>
            <Card title="Equipe e Liderança">
              <div className="academy-fields">
                <label className="academy-field">
                  <span>Equipe</span>
                  <strong>{gym.teamName || "Não informada"}</strong>
                </label>
              </div>
              <div className="academy-stats">
                <div>
                  <span>Total Professores</span>
                  <strong>{gymTeachers.length}</strong>
                </div>
                <div>
                  <span>Unidades</span>
                  <strong>{gymUnits.length}</strong>
                </div>
              </div>
            </Card>
            <Card title="Branding e Identidade">
              {gym.branding.logoUrl && (
                <PortalImage
                  src={gym.branding.logoUrl}
                  className="academy-logo"
                  alt={`Logo: ${gym.name}`}
                  fallback=""
                  contain
                />
              )}
              <div className="color-row">
                <label>
                  <span>Cor Primária</span>
                  <div>
                    <input
                      type="color"
                      disabled
                      value={gym.branding.primaryColor ?? "#09090B"}
                    />
                    <input
                      type="text"
                      readOnly
                      value={gym.branding.primaryColor ?? "Não definida"}
                    />
                  </div>
                </label>
                <label>
                  <span>Cor de Destaque</span>
                  <div>
                    <input
                      type="color"
                      disabled
                      value={gym.branding.secondaryColor ?? "#9E9E9E"}
                    />
                    <input
                      type="text"
                      readOnly
                      value={gym.branding.secondaryColor ?? "Não definida"}
                    />
                  </div>
                </label>
              </div>
            </Card>
          </>
        )}
      </main>
    </AdminShell>
  );
}
