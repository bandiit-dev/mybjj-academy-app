import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyBJJAcademy",
  description: "A plataforma completa para gestão da sua academia de jiu-jitsu."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
