import type { Metadata } from "next";
import { AnalyticsConsent } from "@/components/organisms/analytics-consent";
import { siteUrl } from "@/lib/site-metadata";
import "@fontsource-variable/google-sans-flex";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  icons: { icon: "/images/favicon.ico", shortcut: "/images/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>
        {gtmId ? (
          <AnalyticsConsent containerId={gtmId}>{children}</AnalyticsConsent>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
