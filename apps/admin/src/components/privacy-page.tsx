"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { AdminShell } from "@/components/dashboard";
import { PrivacyRequests } from "@/components/privacy-requests";
import { PrivacyRetention } from "@/components/privacy-retention";
import type { PrivacyScope } from "@/utils/privacy";

export function PrivacyPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const access = useQuery(api.privacy.getAccess, isAuthenticated ? {} : "skip");
  const [selection, setSelection] = useState("");
  const [view, setView] = useState<"requests" | "retention">("requests");
  if (isLoading || (isAuthenticated && access === undefined)) {
    return (
      <main className="auth-state" role="status">
        <strong>Validando acesso à privacidade...</strong>
      </main>
    );
  }
  const scopes =
    access?.gyms.map((gym) => ({
      key: gym.id as string,
      label: gym.name,
      gymId: gym.id,
    })) ?? [];
  const options: ({ key: string; label: string } & PrivacyScope)[] =
    access?.platform
      ? [...scopes, { key: "platform", label: "My BJJ Academy · Plataforma" }]
      : scopes;
  const selected =
    options.find((option) => option.key === selection) ?? options[0];

  if (!selected) {
    return (
      <main className="auth-state">
        <div className="auth-denied">
          <h1>Acesso restrito</h1>
          <p>
            Use o canal de privacidade para enviar solicitações sobre seus
            dados.
          </p>
          <p>
            <a href="mailto:contato@mybjjacademy.com.br">
              contato@mybjjacademy.com.br
            </a>
          </p>
          <Link href="/" className="button secondary">
            Voltar ao portal
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AdminShell
      title="Privacidade"
      privacyOnly
      actions={
        <Link className="button secondary" href="/">
          Voltar ao portal
        </Link>
      }
    >
      <main className="management-content privacy-workspace">
        <section
          className="panel privacy-navigation"
          aria-label="Espaço de privacidade"
        >
          <label className="management-field">
            <b>Espaço</b>
            <select
              value={selected.key}
              onChange={(event) => setSelection(event.target.value)}
            >
              {options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="privacy-actions" aria-label="Seções de privacidade">
            <button
              type="button"
              aria-pressed={view === "requests"}
              className={`button ${view === "requests" ? "primary" : "secondary"}`}
              onClick={() => setView("requests")}
            >
              Solicitações
            </button>
            <button
              type="button"
              aria-pressed={view === "retention"}
              className={`button ${view === "retention" ? "primary" : "secondary"}`}
              onClick={() => setView("retention")}
            >
              Tabela de retenção
            </button>
          </div>
        </section>
        {view === "requests" ? (
          <PrivacyRequests key={selected.key} gymId={selected.gymId} />
        ) : (
          <PrivacyRetention key={selected.key} gymId={selected.gymId} />
        )}
      </main>
    </AdminShell>
  );
}
