"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import { SignOutButton, useAuth } from "@clerk/nextjs";
import { ConvexReactClient, useConvexAuth, useQuery } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { env } from "@/utils/env";

function AdminAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const clerk = useAuth();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [timedOut, setTimedOut] = useState(false);
  const teacher = useQuery(api.teachers.getCurrentTeacher, isAuthenticated ? {} : "skip");
  const student = useQuery(api.students.getCurrentStudent, isAuthenticated ? {} : "skip");

  useEffect(() => {
    if (!clerk.isLoaded || isLoading) {
      const timeout = window.setTimeout(() => setTimedOut(true), 8000);
      return () => window.clearTimeout(timeout);
    }
    setTimedOut(false);
  }, [clerk.isLoaded, isLoading]);

  if (pathname.startsWith("/sign-in")) return children;
  if (timedOut) {
    return <main className="auth-state"><div className="auth-denied"><span>MY<strong>BJJ</strong> ACADEMY</span><h1>Não foi possível validar o acesso</h1><p>{clerk.isLoaded ? "O Clerk iniciou, mas o Convex não recebeu um token válido. Ative a integração Convex no painel do Clerk e entre novamente." : "O Clerk não conseguiu finalizar a inicialização. Verifique a conexão e a chave pública configurada."}</p><div className="auth-recovery"><button className="button secondary" type="button" onClick={() => window.location.reload()}>Tentar novamente</button><SignOutButton redirectUrl="/sign-in"><button className="button primary" type="button">Sair</button></SignOutButton></div></div></main>;
  }
  if (isLoading || (isAuthenticated && (teacher === undefined || student === undefined))) {
    return <main className="auth-state"><div className="auth-spinner"/><strong>Validando acesso...</strong></main>;
  }
  if (!isAuthenticated) return children;
  if (teacher?.userType !== "Admin" && student?.userType !== "Admin") {
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
