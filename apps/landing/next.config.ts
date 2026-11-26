import type { NextConfig } from "next";
const isDevelopment = process.env.NODE_ENV === "development";
const previewToolbar = process.env.VERCEL_ENV === "preview";
const toolbarOrigin = previewToolbar ? " https://vercel.live" : "";
const configuredId = process.env.NEXT_PUBLIC_GTM_ID?.trim();
const defaultId = process.env.VERCEL_ENV === "production" ? "GTM-MWPSJKFS" : "";
const containerId = configuredId ?? defaultId;
const gtmId = /^GTM-[A-Z0-9]+$/.test(containerId) ? containerId : "";
const googleTag = gtmId ? " https://www.googletagmanager.com" : "";
const analytics = gtmId ? " https://*.google-analytics.com" : "";
const tagPreview = gtmId && (previewToolbar || isDevelopment);
const tagPreviewOrigin = tagPreview ? " https://tagmanager.google.com" : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js emits inline hydration scripts on statically generated pages.
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}${toolbarOrigin}${googleTag}${tagPreviewOrigin}`,
  "script-src-attr 'none'",
  `style-src 'self' 'unsafe-inline'${toolbarOrigin}${tagPreview ? `${googleTag}${tagPreviewOrigin} https://fonts.googleapis.com` : ""}`,
  `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}${toolbarOrigin}${previewToolbar ? " wss://ws-us3.pusher.com" : ""}${googleTag}${analytics}${gtmId ? " https://*.google.com" : ""}${tagPreviewOrigin}`,
  `img-src 'self' data:${previewToolbar ? `${toolbarOrigin} https://vercel.com blob:` : ""}${googleTag}${analytics}${tagPreview ? " https://ssl.gstatic.com https://www.gstatic.com" : ""}`,
  `font-src 'self'${previewToolbar ? `${toolbarOrigin} https://assets.vercel.com` : ""}${tagPreview ? " https://fonts.gstatic.com data:" : ""}`,
  `frame-src ${previewToolbar ? "https://vercel.live" : "'none'"}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_GTM_ID: gtmId },
  // Keep page metadata in the initial head for crawlers and HTML validators.
  htmlLimitedBots: /.*/,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "mybjjacademy.com.br" }],
        destination: "https://www.mybjjacademy.com.br/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
