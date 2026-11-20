"use client";

import { usePortalSubscription } from "@/hooks/use-portal-subscription";
import { LoginPage } from "@/components/login-page";
import { api } from "@mybjj/backend/convex/_generated/api";
import { SignOutButton, useAuth } from "@clerk/nextjs";
import {
  ConvexReactClient,
  useAction,
  useConvexAuth,
  useQuery,
} from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { env } from "@/utils/env";
import {
  parseCheckoutPlan,
  pendingCheckoutPlanKey,
} from "@/utils/checkout-plan";
import { BrandLogo } from "@/components/brand-logo";

function PortalAccessGate({ children }: { children: React.ReactNode }) {
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

  const studentAccount =
    onboarding?.status === "ready" &&
    !onboarding.isAdmin &&
    onboarding.profileType === "student";
  const teacherAccount =
    onboarding?.status === "ready" &&
    !onboarding.isAdmin &&
    onboarding.profileType === "teacher";
  const teacherRoute =
    /^\/aulas(?:\/[^/]+)?$/.test(pathname) && pathname !== "/aulas/nova";
  const studentRoute = pathname === "/aluno" || pathname.startsWith("/aluno/");

  const resolveAccount = useAction(api.onboarding.resolvePortalAccount);
  const accountKey =
    isAuthenticated && clerk.userId && clerk.sessionId
      ? `${clerk.userId}:${clerk.sessionId}`
      : null;
  const resolveBeforeBilling =
    onboarding?.status === "needs_academy" ||
    (onboarding?.status === "link_required" &&
      onboarding.profileType === "student");
  const resolutionKey =
    accountKey && resolveBeforeBilling
      ? `${accountKey}:${onboarding.status}`
      : null;
  const [resolution, setResolution] = useState<{
    key: string;
    status: "linked" | "needs_academy" | "failed";
  } | null>(null);
  const resolutionStatus =
    resolution?.key === resolutionKey ? resolution.status : undefined;

  useEffect(() => {
    if (!resolutionKey || resolutionStatus) return;
    let current = true;
    resolveAccount({})
      .then(({ status }) => {
        if (current) setResolution({ key: resolutionKey, status });
      })
      .catch(() => {
        if (current) setResolution({ key: resolutionKey, status: "failed" });
      });
    return () => {
      current = false;
    };
  }, [resolutionKey, resolutionStatus, resolveAccount]);

  const needsBilling =
    isAuthenticated &&
    ((onboarding?.status === "needs_academy" &&
      resolutionStatus === "needs_academy") ||
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
      if (onboarding.profileType === "student") return;
      if (!pathname.startsWith("/onboarding"))
        router.replace(`/onboarding${selection}`);
      return;
    }
    if (studentAccount) {
      if (!studentRoute) router.replace("/aluno");
      return;
    }
    if (teacherAccount) {
      if (!teacherRoute) router.replace("/aulas");
      return;
    }
    if (needsBilling && studentRoute) {
      router.replace("/");
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
    studentAccount,
    studentRoute,
    teacherAccount,
    teacherRoute,
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
  if (resolveBeforeBilling && resolutionStatus !== "needs_academy") {
    return resolutionStatus === "failed" ? (
      <main className="auth-state">
        <div className="auth-denied" role="alert">
          <BrandLogo className="auth-brand-logo" />
          <h1>Não foi possível verificar sua conta</h1>
          <p>
            Confira se você entrou com o e-mail que recebeu o convite da
            academia.
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
    ) : (
      <main className="auth-state" role="status">
        <div className="auth-spinner" />
        <strong>Verificando seu perfil...</strong>
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
  if (studentAccount || (needsBilling && studentRoute)) {
    return studentAccount && studentRoute ? (
      children
    ) : (
      <main className="auth-state">
        <div className="auth-spinner" />
        <strong>Abrindo o painel...</strong>
      </main>
    );
  }
  if (teacherAccount) {
    return teacherRoute ? (
      children
    ) : (
      <main className="auth-state" role="status">
        <div className="auth-spinner" />
        <strong>Abrindo as aulas...</strong>
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
        <PortalAccessGate>{children}</PortalAccessGate>
      </Suspense>
    </ConvexProviderWithClerk>
  );
}
