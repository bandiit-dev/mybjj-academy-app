"use client";

import {
  BELTS,
  BELT_LABELS,
  type Belt,
} from "@mybjj/backend/convex/lib/validators";
import { api } from "@mybjj/backend/convex/_generated/api";
import { SignOutButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { FormEvent, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("CNPJ"))
    return "Já existe uma academia cadastrada com este CNPJ.";
  if (message.includes("profile") || message.includes("email"))
    return "Já existe um perfil com este e-mail. Use a opção de vincular conta.";
  return "Não foi possível concluir o cadastro. Revise os dados e tente novamente.";
}

export function OwnerOnboarding() {
  const { user } = useUser();
  const status = useQuery(api.onboarding.getOnboardingStatus);
  const linkProfile = useMutation(api.onboarding.linkExistingProfile);
  const bootstrap = useMutation(api.onboarding.bootstrapAcademyAdmin);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function link() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await linkProfile({});
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function createAcademy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await bootstrap({
        adminName: String(data.get("adminName")),
        adminPhone: String(data.get("adminPhone")),
        adminBelt: String(data.get("adminBelt")) as Belt,
        adminDegree: Number(data.get("adminDegree")),
        teamName: String(data.get("teamName") ?? ""),
        gymName: String(data.get("gymName")),
        cnpj: String(data.get("cnpj")),
        gymPhone: String(data.get("gymPhone")),
        contactEmail: String(data.get("contactEmail")),
        founded: String(data.get("founded")),
        unityName: String(data.get("unityName")),
        unityAddress: [
          data.get("street"),
          data.get("number"),
          data.get("complement"),
          data.get("district"),
          data.get("city"),
          data.get("state"),
          data.get("postalCode"),
        ]
          .filter(Boolean)
          .join(", "),
      });
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }

  if (status === undefined || status.status === "unauthenticated")
    return (
      <main className="auth-state">
        <div className="auth-spinner" />
        <strong>Preparando seu cadastro...</strong>
      </main>
    );
  if (status.status === "ready")
    return (
      <main className="auth-state">
        <div className="auth-spinner" />
        <strong>Abrindo o painel...</strong>
      </main>
    );

  return (
    <main className="onboarding-page bjj-pattern-background">
      <header className="onboarding-header">
        <BrandLogo className="onboarding-brand-logo" />
        <SignOutButton redirectUrl="/">
          <button className="button secondary" type="button">
            Sair
          </button>
        </SignOutButton>
      </header>
      <section className="onboarding-shell">
        <div className="onboarding-intro">
          <span>PRIMEIRO ACESSO</span>
          <h1>Vamos preparar sua academia</h1>
          <p>
            Preencha seus dados e as informações da sua academia para começar.
          </p>
          <div className="onboarding-user">
            <span>{user?.firstName?.slice(0, 1) ?? "A"}</span>
            <div>
              <strong>{user?.fullName ?? status.displayName}</strong>
              <small>
                {user?.primaryEmailAddress?.emailAddress ?? status.email}
              </small>
            </div>
          </div>
        </div>
        {error && (
          <div className="students-notice" role="alert">
            <span>{error}</span>
          </div>
        )}
        {status.status === "link_required" ? (
          <section className="onboarding-card link-card">
            <span className="onboarding-step">Perfil encontrado</span>
            <h2>Vincular conta existente</h2>
            <p>
              Encontramos o perfil <strong>{status.displayName}</strong> usando
              o mesmo e-mail verificado no Clerk. Confirme para associar esta
              identidade ao cadastro existente.
            </p>
            <button
              className="button primary onboarding-submit"
              disabled={busy}
              type="button"
              onClick={link}
            >
              {busy ? "Vinculando..." : "Vincular e acessar painel"}
            </button>
          </section>
        ) : (
          <form className="onboarding-card" onSubmit={createAcademy}>
            <div className="onboarding-section">
              <span className="onboarding-step">1</span>
              <div>
                <h2>Seu perfil administrativo</h2>
                <p>
                  Você será o primeiro administrador e proprietário desta
                  academia.
                </p>
              </div>
            </div>
            <div className="onboarding-grid">
              <label className="management-field">
                <span>Nome completo *</span>
                <input
                  name="adminName"
                  required
                  defaultValue={status.displayName}
                />
              </label>
              <label className="management-field">
                <span>Telefone *</span>
                <input
                  name="adminPhone"
                  required
                  placeholder="(11) 99999-9999"
                />
              </label>
              <label className="management-field">
                <span>Faixa *</span>
                <select name="adminBelt" required defaultValue="White">
                  {BELTS.map((belt) => (
                    <option key={belt} value={belt}>
                      {BELT_LABELS[belt]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="management-field">
                <span>Grau *</span>
                <input
                  name="adminDegree"
                  required
                  type="number"
                  min="0"
                  max="7"
                  defaultValue="0"
                />
              </label>
            </div>
            <div className="onboarding-divider" />
            <div className="onboarding-section">
              <span className="onboarding-step">2</span>
              <div>
                <h2>Dados da academia</h2>
                <p>Informações institucionais do seu centro de treinamento.</p>
              </div>
            </div>
            <div className="onboarding-grid">
              <label className="management-field wide">
                <span>Nome da academia *</span>
                <input
                  name="gymName"
                  required
                  placeholder="Ex.: CT Maré Alta"
                />
              </label>
              <label className="management-field wide">
                <span>Equipe</span>
                <input name="teamName" placeholder="Nome da equipe" />
              </label>
              <label className="management-field">
                <span>CNPJ *</span>
                <input name="cnpj" required placeholder="00.000.000/0000-00" />
              </label>
              <label className="management-field">
                <span>Data de fundação *</span>
                <input name="founded" required type="date" />
              </label>
              <label className="management-field">
                <span>Telefone da academia *</span>
                <input name="gymPhone" required placeholder="(11) 99999-9999" />
              </label>
              <label className="management-field">
                <span>E-mail de contato *</span>
                <input
                  name="contactEmail"
                  required
                  type="email"
                  defaultValue={status.email}
                />
              </label>
            </div>
            <div className="onboarding-divider" />
            <div className="onboarding-section">
              <span className="onboarding-step">3</span>
              <div>
                <h2>Primeira unidade</h2>
                <p>
                  Cadastre o nome e o endereço da unidade principal. Outras
                  poderão ser adicionadas depois.
                </p>
              </div>
            </div>
            <div className="onboarding-grid address">
              <label className="management-field wide">
                <span>Nome da unidade *</span>
                <input
                  name="unityName"
                  required
                  placeholder="Ex.: Unidade Centro"
                />
              </label>
              <label className="management-field">
                <span>CEP</span>
                <input name="postalCode" placeholder="01310-100" />
              </label>
              <label className="management-field wide">
                <span>Endereço *</span>
                <input name="street" required placeholder="Avenida Paulista" />
              </label>
              <label className="management-field">
                <span>Número *</span>
                <input name="number" required />
              </label>
              <label className="management-field">
                <span>Complemento</span>
                <input name="complement" />
              </label>
              <label className="management-field">
                <span>Bairro</span>
                <input name="district" />
              </label>
              <label className="management-field">
                <span>Cidade *</span>
                <input name="city" required />
              </label>
              <label className="management-field">
                <span>Estado *</span>
                <input name="state" required maxLength={2} placeholder="SP" />
              </label>
            </div>
            <button
              className="button primary onboarding-submit"
              disabled={busy}
              type="submit"
            >
              {busy ? "Criando academia..." : "Criar academia e acessar painel"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
