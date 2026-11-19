import { FeatureList } from "@/components/molecules/feature-list";

export function FeaturesSection() {
  return (
    <section
      data-scroll-reveal="pending"
      id="recursos"
      className="mx-auto mt-24 grid max-w-[1120px] gap-8 px-5 min-[1160px]:px-0 lg:mt-[144px] lg:grid-cols-[1fr_39.2%] lg:gap-12"
    >
      <div>
        <h2 className="text-[clamp(2rem,4vw,3rem)] leading-[1.22]">
          Tudo que você precisa
          <br className="hidden lg:block" /> em{" "}
          <strong className="font-semibold">uma única plataforma</strong>
        </h2>
        <p className="mt-8 max-w-[490px] text-xl leading-[1.25]">
          Centralize sua operação, economize tempo e entregue uma experiência
          melhor para seus alunos.
        </p>
      </div>
      <FeatureList />
    </section>
  );
}
