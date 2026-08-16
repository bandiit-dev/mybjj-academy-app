"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import { SignOutButton, useAuth } from "@clerk/nextjs";
import { ConvexReactClient, useConvexAuth, useQuery } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { env } from "@/utils/env";

function AdminAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const clerk = useAuth();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [timedOut, setTimedOut] = useState(false);
  const onboarding = useQuery(api.onboarding.getOnboardingStatus, isAuthenticated ? {} : "skip");

  useEffect(() => {
    if (!clerk.isLoaded || isLoading) {
      const timeout = window.setTimeout(() => setTimedOut(true), 8000);
      return () => window.clearTimeout(timeout);
    }
    setTimedOut(false);
  }, [clerk.isLoaded, isLoading]);

  useEffect(() => {
    if (!isAuthenticated || onboarding === undefined) return;
    if (onboarding.status === "ready" && pathname.startsWith("/onboarding")) router.replace("/");
    if (onboarding.status !== "ready" && onboarding.status !== "unauthenticated" && !pathname.startsWith("/onboarding")) router.replace("/onboarding");
  }, [isAuthenticated, onboarding, pathname, router]);

  if (pathname.startsWith("/sign-in")) return children;
  if (timedOut) {
    return <main className="auth-state"><div className="auth-denied"><span>MY<strong>BJJ</strong> ACADEMY</span><h1>Não foi possível validar o acesso</h1><p>{clerk.isLoaded ? "O Clerk iniciou, mas o Convex não confirmou a sessão. Saia, entre novamente e tente recarregar a página." : "O Clerk não conseguiu finalizar a inicialização. Verifique a conexão e a chave pública configurada."}</p><div className="auth-recovery"><button className="button secondary" type="button" onClick={() => window.location.reload()}>Tentar novamente</button><SignOutButton redirectUrl="/sign-in"><button className="button primary" type="button">Sair</button></SignOutButton></div></div></main>;
  }
  if (isLoading || (isAuthenticated && onboarding === undefined)) {
    return <main className="auth-state"><div className="auth-spinner"/><strong>Validando acesso...</strong></main>;
  }
  if (!isAuthenticated) return children;
  if (onboarding?.status !== "ready") {
    return pathname.startsWith("/onboarding") ? children : <main className="auth-state"><div className="auth-spinner"/><strong>Preparando seu cadastro...</strong></main>;
  }
  if (!onboarding.isAdmin) {
    return <main className="auth-state"><div className="auth-denied"><span>MY<strong>BJJ</strong> ACADEMY</span><h1>Acesso não autorizado</h1><p>Esta conta não possui permissão administrativa no MyBJJAcademy.</p><SignOutButton redirectUrl="/sign-in"><button className="button primary" type="button">Sair e entrar com outra conta</button></SignOutButton></div></main>;
  }
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
