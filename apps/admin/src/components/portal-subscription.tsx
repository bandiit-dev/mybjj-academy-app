"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { SignOutButton } from "@clerk/nextjs";
import { ConvexError } from "convex/values";
import { useAction } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { usePortalSubscription } from "@/hooks/use-portal-subscription";
import { AuthPageLayout } from "./auth-page-layout";

const date = (value: number | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
      }).format(value)
    : "—";
function usePaymentAction(gymId?: Id<"gyms">) {
  const checkout = useAction(api.stripe.createCheckout);
  const portal = useAction(api.stripe.createPortal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function open(manage: boolean, promotionCode?: string) {
    setBusy(true);
    setError("");
    try {
      const result = await (manage
        ? portal({ gymId })
        : checkout({ promotionCode }));
      window.location.assign(result.url);
    } catch (error) {
      const data = error instanceof ConvexError ? error.data : undefined;
      const message =
        typeof data === "string"
          ? data
          : data &&
              typeof data === "object" &&
              "message" in data &&
              typeof data.message === "string"
            ? data.message
            : undefined;
      setError(
        message ??
          "Não foi possível abrir o pagamento. Tente novamente em alguns instantes.",
      );
      setBusy(false);
    }
  }
  return { busy, error, open };
}

export function SubscriptionPage() {
  const billing = usePortalSubscription();
  const payment = usePaymentAction();
  const confirm = useAction(api.stripe.confirmCheckout);
  const started = useRef(false);
  const [confirmation, setConfirmation] = useState("");
  const [promotionCode, setPromotionCode] = useState("");
  const manageSubscription = Boolean(
    billing?.hasSubscription &&
    !["canceled", "incomplete_expired"].includes(billing.status),
  );
  useEffect(() => {
    if (!billing || started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "cancelled")
      setConfirmation(
        "Pagamento cancelado. Você pode tentar novamente quando quiser.",
      );
    const sessionId = params.get("session_id");
    if (params.get("checkout") === "success" && sessionId) {
      setConfirmation("Confirmando seu pagamento...");
      confirm({ sessionId })
        .then(() =>
          setConfirmation(
            "Aguardando a confirmação do pagamento. O portal abrirá automaticamente assim que ele for aprovado.",
          ),
        )
        .catch(() =>
          setConfirmation(
            "Ainda estamos aguardando a confirmação do pagamento. Você pode tentar verificar novamente.",
          ),
        );
    }
  }, [billing, confirm]);
  return (
    <AuthPageLayout formSideClassName="subscription-form-side">
      <section className="subscription-checkout academy-card">
        <div className="subscription-card-heading">
          <span className="subscription-eyebrow">PLANO DO PORTAL</span>
          <SignOutButton redirectUrl="/">
            <button className="button secondary" type="button">
              Sair
            </button>
          </SignOutButton>
        </div>
        <h1>Sua academia, organizada.</h1>
        <p>
          Ative sua assinatura para gerenciar alunos, professores e aulas no My
          BJJ Academy.
        </p>
        <div className="subscription-price">
          R$ 39,90 <span>/ mês por academia</span>
        </div>
        <ul>
          <li>Gestão de alunos, planos e pagamentos</li>
          <li>Professores, unidades e aulas em um só lugar</li>
          <li>Acesso ao painel administrativo</li>
        </ul>
        {confirmation && (
          <p role="status" className="subscription-notice">
            {confirmation}
          </p>
        )}
        {!billing ? (
          <p>Verificando assinatura...</p>
        ) : !billing.canManage ? (
          <p className="subscription-notice">
            A assinatura desta academia precisa ser regularizada. Peça ao
            responsável pela assinatura para realizar o pagamento.
          </p>
        ) : !billing.configured ? (
          <p className="subscription-notice">
            Os pagamentos ainda não estão disponíveis. Tente novamente mais
            tarde.
          </p>
        ) : (
          <>
            {!manageSubscription && (
              <label
                className="subscription-coupon"
                htmlFor="subscription-promotion-code"
              >
                <span>Tem um cupom?</span>
                <input
                  id="subscription-promotion-code"
                  type="text"
                  value={promotionCode}
                  onChange={(event) => setPromotionCode(event.target.value)}
                  maxLength={100}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={payment.busy}
                  placeholder="Digite seu código"
                  aria-describedby="subscription-coupon-hint"
                />
                <small id="subscription-coupon-hint">
                  O desconto será validado e exibido no pagamento.
                </small>
              </label>
            )}
            <button
              className="button primary"
              type="button"
              disabled={payment.busy}
              onClick={() => payment.open(manageSubscription, promotionCode)}
            >
              {payment.busy
                ? "Abrindo pagamento..."
                : manageSubscription
                  ? "Regularizar assinatura"
                  : promotionCode.trim()
                    ? "Continuar com cupom"
                    : "Assinar por R$ 39,90/mês"}
            </button>
            {confirmation && (
              <button
                className="button secondary"
                type="button"
                onClick={() => window.location.reload()}
              >
                Verificar pagamento
              </button>
            )}
            <p className="subscription-footnote">
              Cobrança mensal recorrente. Gerencie ou cancele sua assinatura a
              qualquer momento.
            </p>
          </>
        )}
        {payment.error && (
          <p role="alert" className="subscription-error">
            {payment.error}
          </p>
        )}
      </section>
    </AuthPageLayout>
  );
}

export function AcademySubscriptionTile({ gymId }: { gymId: Id<"gyms"> }) {
  const billing = usePortalSubscription({ gymId });
  const payment = usePaymentAction(gymId);
  return (
    <section className="academy-card">
      <header>
        <h2>Plano do portal</h2>
        {billing && (
          <span
            className={`subscription-badge ${billing.hasAccess ? "active" : ""}`}
          >
            {billing.hasAccess ? "Ativo" : "Pagamento pendente"}
          </span>
        )}
      </header>
      {!billing ? (
        <p>Carregando assinatura...</p>
      ) : (
        <>
          <div className="academy-fields">
            <div className="academy-field">
              <span>Plano</span>
              <strong>My BJJ Academy · Mensal</strong>
            </div>
            <div className="academy-field">
              <span>Valor</span>
              <strong>R$ 39,90/mês</strong>
            </div>
            <div className="academy-field">
              <span>Acesso pago até</span>
              <strong>{date(billing.paidThrough)}</strong>
            </div>
            <div className="academy-field">
              <span>
                {billing.cancelAtPeriodEnd
                  ? "Encerramento previsto"
                  : "Próxima renovação"}
              </span>
              <strong>{date(billing.currentPeriodEnd)}</strong>
            </div>
          </div>
          {billing.cancelAtPeriodEnd && (
            <p className="subscription-notice">
              Cancelamento agendado. O acesso continua até o fim do período
              pago.
            </p>
          )}
          {billing.canManage ? (
            <button
              className="button secondary"
              type="button"
              disabled={payment.busy || !billing.configured}
              onClick={() => payment.open(billing.hasSubscription)}
            >
              {payment.busy ? "Abrindo..." : "Gerenciar assinatura"}
            </button>
          ) : (
            <p className="subscription-footnote">
              A assinatura é gerenciada pelo responsável da academia.
            </p>
          )}
          {payment.error && (
            <p role="alert" className="subscription-error">
              {payment.error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
