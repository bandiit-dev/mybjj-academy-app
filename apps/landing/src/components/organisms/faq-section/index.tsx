import Link from "next/link";
import { FaqItem } from "@/components/molecules/faq-item";

const whatsappUrl = "https://wa.me/5521971340128";
const linkStyle =
  "font-medium text-black underline decoration-[#9d9d9d] underline-offset-4 hover:decoration-current";

const questions = [
  {
    question: "Como funciona o teste grátis de 7 dias?",
    answer: (
      <p>
        Crie sua conta e use o plano Starter por 7 dias com até 25 alunos
        ativos, sem cadastrar cartão. Ao fim do teste, você pode escolher um
        plano pago para continuar. O teste termina sem cobrança automática.
      </p>
    ),
  },
  {
    question: "Qual plano faz sentido para minha academia?",
    answer: (
      <p>
        O Starter atende academias com até 80 alunos ativos. O Full atende
        academias que precisam de mais vagas e permite alunos ativos ilimitados.
        Se você já assina e precisa mudar de plano,{" "}
        <a href={whatsappUrl} className={linkStyle}>
          fale com a gente
        </a>
        .
      </p>
    ),
  },
  {
    question: "Como vocês protegem os dados da minha academia?",
    answer: (
      <p>
        O portal usa autenticação e permissões para limitar o acesso aos dados
        da academia. A Stripe processa o pagamento da assinatura. Consulte a{" "}
        <Link href="/politica-de-privacidade" className={linkStyle}>
          Política de Privacidade
        </Link>{" "}
        para saber como os dados são tratados.
      </p>
    ),
  },
  {
    question: "Preciso instalar algum programa?",
    answer: (
      <p>
        Você acessa o portal pelo navegador no computador, tablet ou celular.
        Basta ter conexão com a internet e entrar na sua conta.
      </p>
    ),
  },
  {
    question: "Como funciona o suporte?",
    answer: (
      <p>
        Para tirar dúvidas sobre o cadastro ou o uso do portal, fale com a gente
        pelo{" "}
        <a href={whatsappUrl} className={linkStyle}>
          WhatsApp
        </a>{" "}
        ou pelo{" "}
        <a href="mailto:contato@mybjjacademy.com.br" className={linkStyle}>
          e-mail de atendimento
        </a>
        . O plano Full inclui suporte dedicado.
      </p>
    ),
  },
  {
    question: "Posso cancelar a assinatura quando quiser?",
    answer: (
      <p>
        Sim. O responsável pela assinatura pode solicitar o cancelamento em{" "}
        <strong className="font-medium text-black">
          Academia → Plano do portal → Gerenciar assinatura
        </strong>
        . Se o cancelamento for programado para o fim do ciclo, o acesso
        continua até o fim do período pago.
      </p>
    ),
  },
];

export function FaqSection() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      data-scroll-reveal="pending"
      className="mt-28 bg-white px-5 text-black lg:mt-[151px]"
    >
      <div className="mx-auto max-w-[756px]">
        <header className="text-center">
          <h2
            id="faq-heading"
            className="text-[clamp(2rem,4vw,3rem)] leading-[1.22] font-semibold"
          >
            Perguntas frequentes.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#515151]">
            Não encontrou sua resposta?{" "}
            <a href={whatsappUrl} className={linkStyle}>
              Fale conosco pelo WhatsApp
            </a>
            .
          </p>
        </header>

        <div className="mt-9 grid gap-2.5 sm:mt-[46px]">
          {questions.map(({ question, answer }, index) => (
            <FaqItem key={question} question={question} open={index === 0}>
              {answer}
            </FaqItem>
          ))}
        </div>
      </div>
    </section>
  );
}
