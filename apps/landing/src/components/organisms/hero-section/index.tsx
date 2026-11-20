import { ActionLink } from "@/components/atoms/action-link";
import { HeroPreview } from "@/components/molecules/hero-preview";
import { SiteHeader } from "../site-header";

export function HeroSection() {
  return (
    <section
      id="inicio"
      className="relative overflow-hidden rounded-[37px] bg-linear-to-b from-white to-[#d9d9d9] lg:min-h-[920px]"
    >
      <SiteHeader home />
      <div
        id="sobre"
        data-hero-copy
        className="mx-auto mt-16 max-w-[850px] px-5 text-center lg:mt-[96px]"
      >
        <h1 className="text-[clamp(2rem,4vw,3rem)] leading-[1.22]">
          A plataforma completa para{" "}
          <strong className="font-semibold">
            gestão
            <br className="hidden sm:block" /> da sua academia
          </strong>{" "}
          de jiu-jitsu
        </h1>
        <p className="mt-[25px] text-xl leading-[1.25]">
          Organize sua operação, gerencie alunos, professores,
          <br className="hidden sm:block" /> turmas e aulas em um só lugar.
        </p>
        <ActionLink className="mt-[34px] w-[190px]">Teste grátis por 7 dias</ActionLink>
      </div>
      <HeroPreview />
    </section>
  );
}
