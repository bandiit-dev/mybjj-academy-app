import { DesignImage } from "@/components/atoms/design-image";

export function HeroPreview() {
  return (
    <div
      data-hero-preview
      className="relative mx-auto mt-10 aspect-[1086/444.5] w-[calc(100%-2rem)] max-w-[1086px] lg:absolute lg:bottom-0 lg:left-1/2 lg:mt-0 lg:w-[calc(100%-84px)] lg:-translate-x-[calc(50%-26px)]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-[7.92%] top-0 h-[74.47%] rounded-t-2xl bg-white/40"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-[5.2%] top-[4.16%] h-[79.64%] rounded-t-2xl bg-white/60"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-[2.67%] top-[7.31%] h-[83.69%] rounded-t-2xl bg-white/80"
      />
      <div className="absolute inset-x-0 top-[11.36%] bottom-0 overflow-hidden rounded-t-2xl">
        <DesignImage
          asset="hero-dashboard.png"
          width={1920}
          height={962}
          alt="Painel do My BJJ Academy com visão geral de alunos, aulas e presença"
          className="block h-auto w-full"
          sizes="(min-width: 1190px) 1086px, (min-width: 1024px) calc(100vw - 104px), calc(100vw - 52px)"
          priority
        />
      </div>
    </div>
  );
}
