"use client";

import { useState } from "react";
import { DesignImage } from "@/components/atoms/design-image";

const features = [
  {
    title: "Aulas e Professores",
    description:
      "Cadastre e organize sua equipe por unidade, tipo de aula e função. Defina modalidade, horário, capacidade e objetivos da aula.",
    icon: "3f141.svg",
    iconHeight: 20,
  },
  {
    title: "Alunos e Matrículas",
    description: "Acompanhe informações, planos, pagamentos e presença.",
    icon: "415ed.svg",
    iconHeight: 24,
  },
  {
    title: "Unidades",
    description: "Gerencie unidades, horários e configurações de cada local.",
    icon: "0d07f.svg",
    iconHeight: 24,
  },
] as const;

export function FeatureList() {
  const [active, setActive] = useState(0);

  return (
    <div className="w-full max-w-[414px]">
      {features.map((feature, index) => (
        <div key={feature.title}>
          <h3>
            <button
              type="button"
              className={`flex w-full cursor-pointer items-center gap-[11px] text-left transition-colors motion-reduce:transition-none text-[22px] leading-tight font-bold ${active === index ? "text-black" : "text-neutral-600 hover:text-black"}`}
              aria-expanded={active === index}
              aria-controls={`feature-${index}`}
              onClick={() => setActive(index)}
            >
              <DesignImage
                asset={feature.icon}
                width={24}
                height={feature.iconHeight}
                className="h-auto w-6 shrink-0"
              />
              {feature.title}
            </button>
          </h3>
          <p
            id={`feature-${index}`}
            hidden={active !== index}
            className="mt-2 max-w-[370px] text-base leading-[1.27] text-[#515151]"
          >
            {feature.description}
          </p>
          {index < features.length - 1 && (
            <DesignImage
              asset="a8d61.svg"
              width={411}
              height={1}
              className="my-[13px] max-w-full"
            />
          )}
        </div>
      ))}
    </div>
  );
}
