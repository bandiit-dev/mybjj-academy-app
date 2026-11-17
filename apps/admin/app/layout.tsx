import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations/pt-BR";

import { ConvexClientProvider } from "@/providers/convex-client-provider";
import "./styles.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "MyBJJAcademy Admin",
  description: "Admin portal base scaffold"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={ptBR} signInUrl="/" signUpUrl="/" signInFallbackRedirectUrl="/" signInForceRedirectUrl="/" signUpFallbackRedirectUrl="/" signUpForceRedirectUrl="/">
      <html lang="pt-BR">
        <body className={geist.variable}>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
