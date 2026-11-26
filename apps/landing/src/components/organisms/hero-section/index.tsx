import Image from "next/image";
import { ActionLink } from "@/components/atoms/action-link";
import { SiteHeader } from "../site-header";

export function HeroSection() {
  return (
    <section
      id="inicio"
      className="relative isolate overflow-hidden bg-[#0a0a0a] text-white min-[1200px]:min-h-[750px]"
    >
      <SiteHeader home />
      <div
        id="sobre"
        data-hero-copy
        className="relative z-10 mx-auto mt-14 max-w-[1120px] px-6 min-[1160px]:px-0 min-[1200px]:mt-[141px]"
      >
        <h1 className="max-w-[536px] text-[clamp(2rem,4vw,3rem)] leading-[1.22]">
          A plataforma completa
          <br className="hidden sm:block" /> para a{" "}
          <strong className="font-semibold">
            gestão da sua
            <br className="hidden sm:block" /> academia
          </strong>{" "}
          de jiu-jitsu.
        </h1>
        <p className="mt-7 max-w-[510px] text-lg leading-[1.25] sm:mt-8 sm:text-xl">
          Organize sua operação, gerencie alunos, professores,
          <br className="hidden sm:block" /> turmas, aulas e mensalidades em um
          só lugar.
        </p>
        <ActionLink
          tone="white"
          className="mt-[36px] w-[190px]"
          tracking={{ event: "signup_click", cta_location: "hero" }}
        >
          Começar agora
        </ActionLink>
      </div>
      <div className="relative mt-4 h-[clamp(13rem,68vw,23rem)] min-[1200px]:absolute min-[1200px]:inset-0 min-[1200px]:mt-0 min-[1200px]:h-auto">
        <Image
          src="/landing/lp-slide.png"
          alt=""
          fill
          priority
          unoptimized
          className="object-cover object-[73%_center] min-[1200px]:object-[47%_center]"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-linear-to-b from-[#0a0a0a] to-transparent min-[1200px]:hidden" />
      </div>
    </section>
  );
}
