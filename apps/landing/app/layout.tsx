import type { Metadata } from "next";
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
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
