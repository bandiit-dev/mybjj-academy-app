"use client";

import { usePortalSubscription } from "@/hooks/use-portal-subscription";
import { LoginPage } from "@/components/login-page";
import { api } from "@mybjj/backend/convex/_generated/api";
import { SignOutButton, useAuth } from "@clerk/nextjs";
import { ConvexReactClient, useConvexAuth, useQuery } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { env } from "@/utils/env";
import { BrandLogo } from "@/components/brand-logo";

function AdminAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const clerk = useAuth();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [timedOut, setTimedOut] = useState(false);
  const onboarding = useQuery(api.onboarding.getOnboardingStatus, isAuthenticated ? {} : "skip");

  const needsBilling = isAuthenticated && (onboarding?.status === "needs_academy" || (onboarding?.status === "ready" && onboarding.isAdmin));
  const billing = usePortalSubscription({enabled:needsBilling});

  useEffect(() => {
    if (!clerk.isLoaded || (clerk.isSignedIn && (isLoading || !isAuthenticated))) {
      const timeout = window.setTimeout(() => setTimedOut(true), 8000);
      return () => window.clearTimeout(timeout);
    }
    setTimedOut(false);
  }, [clerk.isLoaded, clerk.isSignedIn, isLoading, isAuthenticated]);

  useEffect(() => {
    if (clerk.isLoaded && !clerk.isSignedIn && pathname !== "/") router.replace("/");
    if (!isAuthenticated || onboarding === undefined) return;
    if (onboarding.status === "link_required") {
      if (!pathname.startsWith("/onboarding")) router.replace("/onboarding");
      return;
    }
    if (!needsBilling || !billing) return;
    if (!billing.hasAccess) {
      if (pathname !== "/assinatura") router.replace("/assinatura");
    } else if (onboarding.status === "needs_academy") {
      if (!pathname.startsWith("/onboarding")) router.replace("/onboarding");
    } else if (pathname.startsWith("/onboarding") || pathname === "/assinatura") router.replace("/");
  }, [clerk.isLoaded, clerk.isSignedIn, isAuthenticated, onboarding, billing, needsBilling, pathname, router]);

  if (clerk.isLoaded && !clerk.isSignedIn) return <LoginPage/>;
  if (timedOut) {
    return <main className="auth-state"><div className="auth-denied"><BrandLogo className="auth-brand-logo"/><h1>Não foi possível validar o acesso</h1><p>{clerk.isLoaded ? "O Clerk iniciou, mas o Convex não confirmou a sessão. Saia, entre novamente e tente recarregar a página." : "O Clerk não conseguiu finalizar a inicialização. Verifique a conexão e a chave pública configurada."}</p><div className="auth-recovery"><button className="button secondary" type="button" onClick={() => window.location.reload()}>Tentar novamente</button><SignOutButton redirectUrl="/"><button className="button primary" type="button">Sair</button></SignOutButton></div></div></main>;
  }
  if (!clerk.isLoaded || isLoading || !isAuthenticated || onboarding === undefined) {
    return <main className="auth-state"><div className="auth-spinner"/><strong>Validando acesso...</strong></main>;
  }
  if (onboarding?.status === "link_required") {
    return pathname.startsWith("/onboarding") ? children : <main className="auth-state"><div className="auth-spinner"/><strong>Preparando seu cadastro...</strong></main>;
  }
  if (onboarding.status === "ready" && !onboarding.isAdmin) {
    return <main className="auth-state"><div className="auth-denied"><BrandLogo className="auth-brand-logo"/><h1>Acesso não autorizado</h1><p>Esta conta não possui permissão administrativa no MyBJJAcademy.</p><SignOutButton redirectUrl="/"><button className="button primary" type="button">Sair e entrar com outra conta</button></SignOutButton></div></main>;
  }
  if (!billing || (!billing.hasAccess && pathname !== "/assinatura")) return <main className="auth-state"><div className="auth-spinner"/><strong>Verificando assinatura...</strong></main>;
  if (!billing.hasAccess) return children;
  if (onboarding.status === "needs_academy") return pathname.startsWith("/onboarding") ? children : <main className="auth-state"><strong>Preparando sua academia...</strong></main>;
  if (pathname === "/assinatura" || pathname.startsWith("/onboarding")) return <main className="auth-state"><strong>Abrindo o portal...</strong></main>;
  return children;
}

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  const convexUrl = env.convexUrl;
  if (!convexUrl) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_CONVEX_URL");
  }

  const convex = useMemo(() => new ConvexReactClient(convexUrl), [convexUrl]);
  return <ConvexProviderWithClerk client={convex} useAuth={useAuth}><AdminAccessGate>{children}</AdminAccessGate></ConvexProviderWithClerk>;
}
