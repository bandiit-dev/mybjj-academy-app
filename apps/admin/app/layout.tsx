import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import { ConvexClientProvider } from "@/providers/convex-client-provider";

export const metadata: Metadata = {
  title: "MyBJJAcademy Admin",
  description: "Admin portal base scaffold"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
