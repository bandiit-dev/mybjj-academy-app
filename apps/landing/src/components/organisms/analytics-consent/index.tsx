"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import {
  isAnalyticsChoiceChange,
  readAnalyticsChoice,
  saveAnalyticsChoice,
  startAnalytics,
  stopAnalytics,
  trackPageView,
  type AnalyticsChoice,
} from "@/lib/analytics";

const Preferences = createContext<(() => void) | null>(null);

export function AnalyticsPreferencesButton() {
  const open = useContext(Preferences);
  if (!open) return null;
  return (
    <button
      type="button"
      onClick={open}
      className="cursor-pointer underline-offset-4 hover:underline"
    >
      Preferências de cookies
    </button>
  );
}

export function AnalyticsConsent({
  containerId,
  children,
}: {
  containerId: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [choice, setChoice] = useState<AnalyticsChoice | null | undefined>(
    undefined,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setChoice(readAnalyticsChoice());
    function syncChoice(event: StorageEvent) {
      if (!isAnalyticsChoiceChange(event)) return;
      const updated = readAnalyticsChoice();
      setChoice(updated);
      if (updated !== "accepted") stopAnalytics();
    }
    window.addEventListener("storage", syncChoice);
    return () => window.removeEventListener("storage", syncChoice);
  }, []);

  useEffect(() => {
    if (choice !== "accepted") return;
    startAnalytics(containerId, pathname);
    trackPageView(pathname);
  }, [choice, containerId, pathname]);

  function choose(updated: AnalyticsChoice) {
    saveAnalyticsChoice(updated);
    setChoice(updated);
    setSettingsOpen(false);
    if (updated === "rejected") stopAnalytics();
  }

  return (
    <Preferences.Provider value={() => setSettingsOpen(true)}>
      {children}
      {(choice === null || settingsOpen) && (
        <section
          aria-labelledby="analytics-consent-heading"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-neutral-300 bg-white p-4 text-black shadow-lg sm:bottom-5 sm:p-5"
        >
          <h2 id="analytics-consent-heading" className="text-lg font-semibold">
            Cookies de análise
          </h2>
          <p className="mt-1 text-sm text-neutral-700">
            Com sua permissão, usamos o Google Analytics para entender como o
            site é usado. Você pode mudar sua escolha no rodapé.{" "}
            <Link
              href="/politica-de-privacidade#cookies"
              className="underline underline-offset-2"
            >
              Política de Privacidade
            </Link>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => choose("rejected")}
              className="min-h-10 cursor-pointer rounded-lg border border-neutral-400 px-4 text-sm font-semibold hover:bg-neutral-100"
            >
              Recusar análise
            </button>
            <button
              type="button"
              onClick={() => choose("accepted")}
              className="min-h-10 cursor-pointer rounded-lg bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Aceitar análise
            </button>
          </div>
        </section>
      )}
    </Preferences.Provider>
  );
}
