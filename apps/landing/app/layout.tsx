import type { Metadata } from "next";
import "@fontsource-variable/google-sans-flex";
import "./globals.css";

export const metadata: Metadata = {
  icons: { icon: "/images/favicon.ico", shortcut: "/images/favicon.ico" },
  title: "MyBJJAcademy",
  description:
    "A plataforma completa para gestão da sua academia de jiu-jitsu.",
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
