import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

const features = [
  ["⌂", "Gerencie sua academia", "Unidades, horários, faixas e configurações."],
  ["♙", "Professores e turmas", "Organize professores, turmas e graduações."],
  // ["♙", "Alunos e matrículas", "Acompanhe alunos, pagamentos e planos."],
  ["▣", "Aulas e agenda", "Crie aulas, defina horários e capacidade."],
];

export function AuthPageLayout({
  children,
  formSideClassName = "",
}: {
  children: ReactNode;
  formSideClassName?: string;
}) {
  return (
    <main className="login-page">
      <section className="login-presentation">
        <BrandLogo className="login-brand-logo" />
        <div className="login-copy">
          <h1>
            <span>Bem-vindo</span> ao
            <br />
            My BJJ Academy!
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
      <section
        className={`login-form-side bjj-pattern-background ${formSideClassName}`}
      >
        {children}
      </section>
    </main>
  );
}
