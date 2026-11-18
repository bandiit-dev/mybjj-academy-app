"use client";

import { SignIn } from "@clerk/nextjs";
import { AuthPageLayout } from "@/components/auth-page-layout";

export function LoginPage() {
  return (
    <AuthPageLayout>
      <div className="login-card">
        <div className="login-card-heading">
          <h2>Entrar</h2>
          <p>Entre com seu e-mail. Se ainda não tem conta, você poderá criar uma e depois assinar um plano.</p>
        </div>
        <SignIn
          routing="hash"
          withSignUp
          forceRedirectUrl="/"
          signUpForceRedirectUrl="/"
          appearance={{
            elements: {
              rootBox: "clerk-login-root",
              cardBox: "clerk-login-box",
              card: "clerk-login-card",
              logoBox: "clerk-hidden",
              headerTitle: "clerk-hidden",
              headerSubtitle: "clerk-hidden",
              footer: "clerk-hidden",
              formButtonPrimary: "clerk-primary-button",
              socialButtonsBlockButton: "clerk-social-button",
            },
          }}
        />
      </div>
    </AuthPageLayout>
  );
}
