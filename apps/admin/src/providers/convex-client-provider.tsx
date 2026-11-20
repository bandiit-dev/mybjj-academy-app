"use client";

import { usePortalSubscription } from "@/hooks/use-portal-subscription";
import { LoginPage } from "@/components/login-page";
import { api } from "@mybjj/backend/convex/_generated/api";
import { SignOutButton, useAuth } from "@clerk/nextjs";
import { ConvexReactClient, useConvexAuth, useQuery } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { env } from "@/utils/env";
import {
  parseCheckoutPlan,
  pendingCheckoutPlanKey,
} from "@/utils/checkout-plan";
import { BrandLogo } from "@/components/brand-logo";

function AdminAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryPlan = parseCheckoutPlan(searchParams.get("plano"));
  const [pendingPlan, setPendingPlan] =
    useState<ReturnType<typeof parseCheckoutPlan>>();
  const plan = queryPlan ?? pendingPlan;
  const selectionReady = plan !== undefined;
  const selection = plan ? `?plano=${plan}` : "";
  const restoreCheckoutPlan =
    pathname === "/assinatura" &&
    plan &&
    !queryPlan &&
    !searchParams.has("checkout");

  useEffect(() => {
    // Clerk can return to the root without its original query string after signup.
    if (queryPlan) sessionStorage.setItem(pendingCheckoutPlanKey, queryPlan);
    setPendingPlan(
      queryPlan ??
        parseCheckoutPlan(sessionStorage.getItem(pendingCheckoutPlanKey)),
    );
  }, [queryPlan]);

  const clerk = useAuth();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [timedOut, setTimedOut] = useState(false);
  const onboarding = useQuery(
    api.onboarding.getOnboardingStatus,
    isAuthenticated ? {} : "skip",
  );

  const needsBilling =
    isAuthenticated &&
    (onboarding?.status === "needs_academy" ||
      (onboarding?.status === "ready" && onboarding.isAdmin));
  const billing = usePortalSubscription({ enabled: needsBilling });

  useEffect(() => {
    if (
      !clerk.isLoaded ||
      (clerk.isSignedIn && (isLoading || !isAuthenticated))
    ) {
      const timeout = window.setTimeout(() => setTimedOut(true), 8000);
      return () => window.clearTimeout(timeout);
    }
    setTimedOut(false);
  }, [clerk.isLoaded, clerk.isSignedIn, isLoading, isAuthenticated]);

  useEffect(() => {
    if (!selectionReady) return;
    if (clerk.isLoaded && !clerk.isSignedIn && pathname !== "/")
      router.replace(`/${selection}`);
    if (!isAuthenticated || onboarding === undefined) return;
    if (onboarding.status === "link_required") {
      if (!pathname.startsWith("/onboarding"))
        router.replace(`/onboarding${selection}`);
      return;
    }
    if (!needsBilling || !billing) return;
    if (!billing.hasAccess) {
      if (pathname !== "/assinatura" || restoreCheckoutPlan) {
        router.replace(`/assinatura${selection}`);
      }
      return;
    }

    sessionStorage.removeItem(pendingCheckoutPlanKey);
    setPendingPlan(null);
    if (onboarding.status === "needs_academy") {
      if (!pathname.startsWith("/onboarding")) router.replace("/onboarding");
    } else if (pathname.startsWith("/onboarding") || pathname === "/assinatura")
      router.replace("/");
  }, [
    clerk.isLoaded,
    clerk.isSignedIn,
    isAuthenticated,
    onboarding,
    billing,
    needsBilling,
    pathname,
    router,
    selection,
    selectionReady,
    restoreCheckoutPlan,
  ]);

  if (selectionReady && clerk.isLoaded && !clerk.isSignedIn)
    return <LoginPage redirectUrl={`/${selection}`} />;
  if (timedOut) {
    return (
      <main className="auth-state">
        <div className="auth-denied">
          <BrandLogo className="auth-brand-logo" />
          <h1>Não foi possível validar o acesso</h1>
          <p>
            {clerk.isLoaded
              ? "O Clerk iniciou, mas o Convex não confirmou a sessão. Saia, entre novamente e tente recarregar a página."
              : "O Clerk não conseguiu finalizar a inicialização. Verifique a conexão e a chave pública configurada."}
          </p>
          <div className="auth-recovery">
            <button
              className="button secondary"
              type="button"
              onClick={() => window.location.reload()}
            >
              Tentar novamente
            </button>
            <SignOutButton redirectUrl="/">
              <button className="button primary" type="button">
                Sair
              </button>
            </SignOutButton>
          </div>
        </div>
      </main>
    );
  }
  if (
    !selectionReady ||
    !clerk.isLoaded ||
    isLoading ||
    !isAuthenticated ||
    onboarding === undefined
  ) {
    return (
      <main className="auth-state">
        <div className="auth-spinner" />
        <strong>Validando acesso...</strong>
      </main>
    );
  }
  if (onboarding?.status === "link_required") {
    return pathname.startsWith("/onboarding") ? (
      children
    ) : (
      <main className="auth-state">
        <div className="auth-spinner" />
        <strong>Preparando seu cadastro...</strong>
      </main>
    );
  }
  if (onboarding.status === "ready" && !onboarding.isAdmin) {
    return (
      <main className="auth-state">
        <div className="auth-denied">
          <BrandLogo className="auth-brand-logo" />
          <h1>Acesso não autorizado</h1>
          <p>Esta conta não possui permissão administrativa no MyBJJAcademy.</p>
          <SignOutButton redirectUrl="/">
            <button className="button primary" type="button">
              Sair e entrar com outra conta
            </button>
          </SignOutButton>
        </div>
      </main>
    );
  }
  if (
    !billing ||
    (!billing.hasAccess && (pathname !== "/assinatura" || restoreCheckoutPlan))
  )
    return (
      <main className="auth-state">
        <div className="auth-spinner" />
        <strong>Verificando assinatura...</strong>
      </main>
    );
  if (!billing.hasAccess) return children;
  if (onboarding.status === "needs_academy")
    return pathname.startsWith("/onboarding") ? (
      children
    ) : (
      <main className="auth-state">
        <strong>Preparando sua academia...</strong>
      </main>
    );
  if (pathname === "/assinatura" || pathname.startsWith("/onboarding"))
    return (
      <main className="auth-state">
        <strong>Abrindo o portal...</strong>
      </main>
    );
  return children;
}

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const convexUrl = env.convexUrl;
  if (!convexUrl) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_CONVEX_URL",
    );
  }

  const convex = useMemo(() => new ConvexReactClient(convexUrl), [convexUrl]);
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <Suspense
        fallback={
          <main className="auth-state">
            <div className="auth-spinner" />
            <strong>Validando acesso...</strong>
          </main>
        }
      >
        <AdminAccessGate>{children}</AdminAccessGate>
      </Suspense>
    </ConvexProviderWithClerk>
  );
}
