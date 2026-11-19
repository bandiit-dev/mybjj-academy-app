import { PlanCard } from "@/components/molecules/plan-card";

export function PricingSection() {
  return (
    <section
      data-scroll-reveal="pending"
      id="planos"
      className="mx-auto mt-28 max-w-[1120px] px-3 lg:mt-[169px]"
    >
      <h2 className="mx-auto text-center text-[clamp(2rem,4vw,3rem)] leading-[1.22]">
        Gestão simples para você focar no que realmente
        <br className="hidden xl:block" /> importa:{" "}
        <strong className="font-semibold">o crescimento dos seus alunos</strong>
      </h2>
      <div className="mx-auto mt-[46px] flex max-w-[974px] items-stretch justify-center gap-5">
        <div
          aria-hidden="true"
          className="hidden w-[300px] rounded-[15px] border border-[#9d9d9d] [mask-image:linear-gradient(to_right,transparent_40%,black)] md:block"
        />
        <PlanCard />
        <div
          aria-hidden="true"
          className="hidden w-[300px] rounded-[15px] border border-[#9d9d9d] [mask-image:linear-gradient(to_left,transparent_40%,black)] md:block"
        />
      </div>
    </section>
  );
}
