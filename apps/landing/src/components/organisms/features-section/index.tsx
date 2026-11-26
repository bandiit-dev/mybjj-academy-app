"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { DesignImage } from "@/components/atoms/design-image";
import { FeatureList } from "@/components/molecules/feature-list";
import { trackLandingEvent } from "@/lib/analytics";
import { audiences } from "./audiences";

export function FeaturesSection() {
  const id = useId();
  const [active, setActive] = useState(0);

  function selectAudience(next: number) {
    if (next === active) return;
    setActive(next);
    trackLandingEvent({
      event: "feature_tab_select",
      audience: audiences[next].id,
    });
  }

  function handleTabKeys(event: KeyboardEvent<HTMLDivElement>) {
    const last = audiences.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = active === last ? 0 : active + 1;
        break;
      case "ArrowUp":
        next = active === 0 ? last : active - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    selectAudience(next);
    event.currentTarget.querySelectorAll("button")[next]?.focus();
  }

  return (
    <section
      data-scroll-reveal="pending"
      id="recursos"
      aria-labelledby={`${id}-heading`}
      className="mx-auto mt-24 grid max-w-[1120px] items-start gap-8 px-5 min-[1160px]:px-0 lg:mt-[144px] lg:min-h-[704px] lg:grid-cols-2 lg:gap-12"
    >
      <div>
        <h2
          id={`${id}-heading`}
          className="text-[clamp(2rem,4vw,3rem)] leading-[1.25]"
        >
          Tudo que você precisa
          <br className="hidden lg:block" /> em{" "}
          <strong className="font-semibold">uma única plataforma</strong>
        </h2>
        <p className="mt-5 text-xl leading-7 text-[#525252]">
          Centralize sua operação, economize tempo e entregue uma experiência
          melhor para seus alunos.
        </p>

        <div
          role="tablist"
          aria-label="Recursos por perfil"
          aria-orientation="vertical"
          onKeyDown={handleTabKeys}
          className="mt-8 grid gap-3 lg:mt-10"
        >
          {audiences.map(({ id: audience, tabLabel }, index) => {
            const selected = index === active;
            return (
              <button
                key={audience}
                id={`${id}-tab-${audience}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${id}-panel-${audience}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectAudience(index)}
                className={`flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-5 py-3 text-left text-xl leading-6 font-semibold motion-safe:transition-colors sm:px-6 ${selected ? "bg-black text-white focus-visible:outline-black" : "bg-[#f5f5f5] text-[#9d9d9d] hover:text-[#525252] focus-visible:text-[#525252]"}`}
              >
                {tabLabel}
                <DesignImage
                  asset={selected ? "9d197.svg" : "968fb.svg"}
                  width={13}
                  height={11}
                  className="h-auto w-[13px] shrink-0"
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-0">
        {audiences.map(({ id: audience, heading, features }, index) => (
          <div
            key={audience}
            id={`${id}-panel-${audience}`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${audience}`}
            hidden={index !== active}
          >
            {index === active && (
              <>
                <h3
                  id={`${id}-title-${audience}`}
                  className="text-2xl leading-8 font-semibold"
                >
                  {heading}
                </h3>
                <div
                  role="region"
                  aria-labelledby={`${id}-title-${audience}`}
                  tabIndex={0}
                  className="mt-5 lg:max-h-[604px] lg:overflow-y-auto"
                >
                  <FeatureList features={features} />
                </div>
                {audience === "administradores" && (
                  <p className="mt-5 hidden text-sm text-[#525252] lg:block">
                    Role para ver todos os recursos
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
