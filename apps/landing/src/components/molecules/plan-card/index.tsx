import { ActionLink } from "@/components/atoms/action-link";
import { DesignImage } from "@/components/atoms/design-image";

const benefits = [
  "Controle de alunos e presença",
  "Gestão de aulas e professores",
  "Controle de unidades",
  "Suporte dedicado",
];

export function PlanCard() {
  return (
    <article
      aria-label="Plano mensal"
      className="relative z-10 flex min-h-[394px] w-full max-w-[326px] flex-col rounded-[15px] border border-[#9d9d9d] bg-white px-7 py-7"
    >
      <p className="text-xs text-[#515151]">Comece agora por apenas:</p>
      <p className="mt-2 whitespace-nowrap font-semibold">
        <span className="text-[clamp(2rem,10vw,3rem)] leading-tight">
          R$49,90
        </span>{" "}
        <span className="text-[28px] text-[#515151]">/ mês</span>
      </p>
      <ul className="mt-8 space-y-4 text-base leading-[1.35] sm:-mr-4 sm:text-lg sm:leading-[1.2]">
        {benefits.map((benefit) => (
          <li key={benefit} className="flex items-center gap-2.5">
            <DesignImage
              asset="9a136.svg"
              width={15}
              height={15}
              className="shrink-0"
            />
            {benefit}
          </li>
        ))}
      </ul>
      <ActionLink className="mt-auto w-full">Começar agora</ActionLink>
    </article>
  );
}
