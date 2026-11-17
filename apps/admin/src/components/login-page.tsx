"use client";

import { SignIn } from "@clerk/nextjs";
import { BrandLogo } from "@/components/brand-logo";

const features = [
  ["⌂", "Gerencie sua academia", "Unidades, horários, faixas e configurações."],
  ["♙", "Professores e turmas", "Organize professores, turmas e graduações."],
  // ["♙", "Alunos e matrículas", "Acompanhe alunos, pagamentos e planos."],
  ["▣", "Aulas e agenda", "Crie aulas, defina horários e capacidade."],
];

export function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-presentation">
        <BrandLogo className="login-brand-logo" />
        <div className="login-copy">
          <h1>
            <span>Bem-vindo</span> ao
            <br />
            MyBJJ Academy!
          </h1>
          <p>A plataforma completa para gestão da sua academia de jiu-jitsu.</p>
          <div className="login-features">
            {features.map(([icon, title, description]) => (
              <article key={title}>
                <i>{icon}</i>
                <div>
                  <strong>{title}</strong>
                  <span>{description}</span>
                </div>
              </article>
            ))}
          </div>
          <blockquote>
            Tudo que você precisa para focar no que realmente importa:
            <br />
            <strong>o crescimento dos seus alunos.</strong>
          </blockquote>
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-card-heading">
          <h2>Entrar</h2>
          <p>Acesse sua conta para gerenciar sua academia</p>
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
      </section>
    </main>
  );
}
