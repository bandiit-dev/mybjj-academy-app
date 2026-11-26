export type LandingEvent =
  | { event: "signup_click"; cta_location: "header" | "hero" }
  | { event: "login_click"; cta_location: "header" }
  | { event: "plan_select"; plan: "trial" | "starter" | "full" }
  | {
      event: "contact_click";
      contact_method: "whatsapp" | "email" | "instagram";
      cta_location: "faq" | "footer";
    }
  | {
      event: "feature_tab_select";
      audience: "administradores" | "professores" | "alunos";
    }
  | {
      event: "faq_open";
      faq_topic:
        | "trial"
        | "plans"
        | "privacy"
        | "installation"
        | "support"
        | "cancellation";
    };

export type AnalyticsChoice = "accepted" | "rejected";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

const storageKey = "mybjj.analytics-consent.v1";
const campaignKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_id",
  "utm_content",
  "utm_term",
];
const landingPaths = ["/", "/politica-de-privacidade", "/termos-de-uso"];
let started = false;
let previousLocation: string | undefined;
let previousReferrer = "";

export function readAnalyticsChoice(): AnalyticsChoice | null {
  try {
    const choice = localStorage.getItem(storageKey);
    return choice === "accepted" || choice === "rejected" ? choice : null;
  } catch {
    return null;
  }
}

export function saveAnalyticsChoice(choice: AnalyticsChoice) {
  try {
    localStorage.setItem(storageKey, choice);
  } catch {
    // The current document still honours the choice when browser storage is unavailable.
  }
}

export function isAnalyticsChoiceChange(event: StorageEvent) {
  return event.key === storageKey || event.key === null;
}

function pageLocation(pathname: string) {
  const url = new URL(pathname, window.location.origin);
  const query = new URLSearchParams(window.location.search);
  for (const key of campaignKeys) {
    const value = query.get(key);
    if (value && /^[a-z0-9_.-]{1,80}$/i.test(value))
      url.searchParams.set(key, value);
  }
  return url.href;
}

function initialReferrer() {
  if (!document.referrer) return "";
  const url = new URL(document.referrer);
  return url.origin === window.location.origin &&
    landingPaths.includes(url.pathname)
    ? `${url.origin}${url.pathname}`
    : url.origin;
}

export function startAnalytics(containerId: string, pathname: string) {
  if (started) return;
  started = true;
  const dataLayer = (window.dataLayer ??= []);
  const consent = {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  };
  const gtag: (
    command: "consent",
    mode: "default" | "update",
    settings: Record<string, string>,
  ) => void = function () {
    // eslint-disable-next-line prefer-rest-params -- Google expects the arguments object for consent commands.
    dataLayer.push(arguments);
  };
  gtag("consent", "default", { ...consent, analytics_storage: "denied" });
  gtag("consent", "update", { ...consent, analytics_storage: "granted" });
  dataLayer.push({
    page_location: pageLocation(pathname),
    page_referrer: initialReferrer(),
  });
  dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
  document.head.appendChild(script);
}

export function stopAnalytics() {
  if (!started) return;
  started = false;
  const domain = window.location.hostname.replace(/^www\./, "");
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim();
    if (!/^_ga(?:_[a-z0-9]+)?$/i.test(name)) continue;
    document.cookie = `${name}=; Path=/; Max-Age=0`;
    document.cookie = `${name}=; Path=/; Max-Age=0; Domain=${domain}`;
  }
  window.location.reload();
}

export function trackPageView(pathname: string) {
  if (!started || !landingPaths.includes(pathname)) return;
  const location = pageLocation(pathname);
  if (previousLocation === location) return;
  if (previousLocation) {
    const previous = new URL(previousLocation);
    previousReferrer = `${previous.origin}${previous.pathname}`;
  } else {
    previousReferrer = initialReferrer();
  }
  previousLocation = location;
  window.dataLayer?.push({
    event: "landing_page_view",
    page_location: location,
    page_referrer: previousReferrer,
  });
}

export function trackLandingEvent(event: LandingEvent) {
  if (!started || !previousLocation) return;
  window.dataLayer?.push({
    ...event,
    page_location: previousLocation,
    page_referrer: previousReferrer,
  });
}
