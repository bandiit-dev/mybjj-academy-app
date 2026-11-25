import type { NextConfig } from "next";

const enforcedPolicy = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'none'",
];
const isDevelopment = process.env.NODE_ENV === "development";
const previewToolbar = process.env.VERCEL_ENV === "preview";
const toolbarOrigin = previewToolbar ? "https://vercel.live" : "";
const cloudflareChallenge = "https://challenges.cloudflare.com";
const clerkProtection = "https://*.protect.clerk.com";

function originOf(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.origin
      : "";
  } catch {
    return "";
  }
}

function clerkOrigin() {
  // Clerk encodes the Frontend API hostname with a trailing $ in its publishable key.
  const encoded = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.match(
    /^pk_(?:test|live)_(.+)$/,
  )?.[1];
  if (!encoded) return "";
  const host = Buffer.from(encoded, "base64").toString("utf8");
  return /^[a-z0-9.-]+\$$/i.test(host)
    ? originOf(`https://${host.slice(0, -1)}`)
    : "";
}

const clerkApi = clerkOrigin();
const convexHttp = originOf(process.env.NEXT_PUBLIC_CONVEX_URL);
const convexWebSocket = convexHttp.replace(/^http/, "ws");

function directive(name: string, ...sources: string[]) {
  return [name, ...sources.filter(Boolean)].join(" ");
}

// Report resource violations while checking the full Clerk, Convex, and checkout flows on Vercel.
const reportOnlyPolicy = [
  ...enforcedPolicy,
  "default-src 'self'",
  directive(
    "script-src",
    "'self'",
    "'unsafe-inline'",
    isDevelopment ? "'unsafe-eval'" : "",
    clerkApi,
    originOf(process.env.NEXT_PUBLIC_CLERK_JS_URL),
    cloudflareChallenge,
    clerkProtection,
    toolbarOrigin,
  ),
  "script-src-attr 'none'",
  directive("style-src", "'self'", "'unsafe-inline'", toolbarOrigin),
  directive(
    "connect-src",
    "'self'",
    convexHttp,
    convexWebSocket,
    clerkApi,
    "https://clerk-telemetry.com",
    "https://*.clerk-telemetry.com",
    "https://img.clerk.com",
    cloudflareChallenge,
    `${clerkProtection}:*`,
    isDevelopment ? "ws: wss:" : "",
    toolbarOrigin,
    previewToolbar ? "wss://ws-us3.pusher.com" : "",
  ),
  "img-src 'self' data: blob: https:",
  directive(
    "font-src",
    "'self'",
    toolbarOrigin,
    previewToolbar ? "https://assets.vercel.com" : "",
  ),
  directive(
    "frame-src",
    "'self'",
    clerkApi,
    cloudflareChallenge,
    clerkProtection,
    toolbarOrigin,
  ),
  "worker-src 'self' blob:",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex" },
          { key: "Content-Security-Policy", value: enforcedPolicy.join("; ") },
          {
            key: "Content-Security-Policy-Report-Only",
            value: reportOnlyPolicy,
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
