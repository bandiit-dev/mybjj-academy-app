import { PlanCard, type Plan } from "@/components/molecules/plan-card";

const plans: Plan[] = [
  {
    name: "Teste por 7 dias",
    benefits: [
      "7 dias no plano Starter",
      "Sem cartão no cadastro",
      "Até 25 alunos ativos",
    ],
    actionLabel: "Começar agora",
    href: "mailto:contato@mybjjacademy.com.br?subject=Teste%20por%207%20dias",
  },
  {
    name: "Plano Starter",
    monthlyPrice: "39,90",
    benefits: [
      "Até 80 alunos ativos",
      "Controle de alunos e presença",
      "Gestão de aulas e professores",
      "Controle de unidades",
    ],
    actionLabel: "Escolher o Plano Starter!",
    featured: true,
  },
  {
    name: "Plano Full",
    monthlyPrice: "99,90",
    benefits: [
      "A partir de 80 alunos ativos",
      "Todas as funcionalidades do Starter",
      "Suporte Dedicado 24h",
    ],
    actionLabel: "Escolher o Plano Full!",
    href: "mailto:contato@mybjjacademy.com.br?subject=Plano%20Full",
  },
];

export function PricingSection() {
  return (
    <section
      data-scroll-reveal="pending"
      id="planos"
      className="mt-28 overflow-x-clip px-3 lg:mt-[169px]"
    >
      <h2 className="mx-auto max-w-[1120px] text-center text-[clamp(2rem,4vw,3rem)] leading-[1.22]">
        Gestão simples para você focar no que realmente
        <br className="hidden xl:block" /> importa:{" "}
        <strong className="font-semibold">o crescimento dos seus alunos</strong>
      </h2>
      <div className="relative mx-auto mt-[46px] grid max-w-[1018px] justify-items-center gap-x-5 gap-y-10 md:grid-cols-3">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-full mr-5 hidden w-[300px] rounded-[15px] border border-[#9d9d9d] [mask-image:linear-gradient(to_right,transparent_40%,black)] lg:block"
        />
        {plans.map((plan) => (
          <PlanCard key={plan.name} plan={plan} />
        ))}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-full ml-5 hidden w-[300px] rounded-[15px] border border-[#9d9d9d] [mask-image:linear-gradient(to_left,transparent_40%,black)] lg:block"
        />
      </div>
      <p className="mt-5 text-center text-sm text-[#515151]">
        Teste de 7 dias e plano Full sob consulta.
      </p>
    </section>
  );
}
