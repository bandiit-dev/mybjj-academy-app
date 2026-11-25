import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const previewToolbar = process.env.VERCEL_ENV === "preview";
const toolbarOrigin = previewToolbar ? " https://vercel.live" : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js emits inline hydration scripts on statically generated pages.
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}${toolbarOrigin}`,
  "script-src-attr 'none'",
  `style-src 'self' 'unsafe-inline'${toolbarOrigin}`,
  `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}${toolbarOrigin}${previewToolbar ? " wss://ws-us3.pusher.com" : ""}`,
  `img-src 'self' data:${previewToolbar ? `${toolbarOrigin} https://vercel.com blob:` : ""}`,
  `font-src 'self'${previewToolbar ? `${toolbarOrigin} https://assets.vercel.com` : ""}`,
  `frame-src ${previewToolbar ? "https://vercel.live" : "'none'"}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
