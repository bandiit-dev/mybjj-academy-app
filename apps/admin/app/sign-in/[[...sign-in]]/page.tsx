import { SignIn } from "@clerk/nextjs";

const features = [
  ["⌂", "Gerencie sua academia", "Unidades, horários, faixas e configurações."],
  ["♙", "Professores e turmas", "Organize professores, turmas e graduações."],
  ["♙", "Alunos e matrículas", "Acompanhe alunos, pagamentos e planos."],
  ["▣", "Aulas e agenda", "Crie aulas, defina horários e capacidade."]
];

export default function SignInPage() {
  return <main className="login-page">
    <section className="login-presentation">
      <div className="login-brand">MY<span>BJJ</span> ACADEMY</div>
      <div className="login-copy"><h1><span>Bem-vindo</span> de volta!</h1><p>A plataforma completa para gestão da sua academia de jiu-jitsu.</p>
        <div className="login-features">{features.map(([icon,title,description])=><article key={title}><i>{icon}</i><div><strong>{title}</strong><span>{description}</span></div></article>)}</div>
        <blockquote>“ Tudo que você precisa para focar no que realmente importa: o crescimento dos seus alunos.</blockquote>
      </div>
    </section>
    <section className="login-form-side"><div className="login-card-heading"><h2>Entrar</h2><p>Acesse sua conta para gerenciar sua academia</p></div><SignIn routing="path" path="/sign-in" forceRedirectUrl="/" signUpUrl={undefined} appearance={{elements:{rootBox:"clerk-login-root",cardBox:"clerk-login-box",card:"clerk-login-card",headerTitle:"clerk-hidden",headerSubtitle:"clerk-hidden",footer:"clerk-hidden",formButtonPrimary:"clerk-primary-button",socialButtonsBlockButton:"clerk-social-button"}}}/><p className="login-security">♢ &nbsp; Autenticação segura com <strong>Clerk</strong></p></section>
  </main>;
}
