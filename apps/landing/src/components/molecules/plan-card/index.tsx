import { ActionLink } from "@/components/atoms/action-link";
import { DesignImage } from "@/components/atoms/design-image";

export type Plan = {
  id: "trial" | "starter" | "full";
  name: string;
  monthlyPrice?: string;
  benefits: readonly string[];
  actionLabel: string;
  href?: string;
  featured?: boolean;
};

export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <article
      aria-label={plan.name}
      className={`relative flex min-h-[394px] w-full max-w-[326px] min-w-0 flex-col rounded-[15px] border bg-white px-7 py-7 ${plan.featured ? "border-black" : "border-[#9d9d9d]"}`}
    >
      {plan.featured && (
        <span className="absolute -top-4 left-1/2 flex h-[30px] w-[150px] -translate-x-1/2 items-center justify-center rounded-lg bg-black text-xs font-semibold text-white uppercase">
          Mais indicado!
        </span>
      )}
      <h3 className="text-[10px] font-semibold text-[#515151] uppercase">
        {plan.name}
      </h3>
      <p className="mt-3 whitespace-nowrap text-[clamp(2.25rem,4vw,3rem)] leading-tight font-semibold">
        {plan.monthlyPrice ? (
          <>
            <span className="text-[clamp(1.25rem,2.5vw,1.875rem)] font-normal">
              R$
            </span>{" "}
            {plan.monthlyPrice}{" "}
            <span className="text-[clamp(1rem,2vw,1.75rem)] text-[#515151]">
              / mês
            </span>
          </>
        ) : (
          "Grátis"
        )}
      </p>
      <ul className="mt-8 mb-6 space-y-5 text-sm leading-[1.3]">
        {plan.benefits.map((benefit) => (
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
      <ActionLink
        href={plan.href}
        tracking={{ event: "plan_select", plan: plan.id }}
        subtle={!plan.featured}
        className="mt-auto w-full font-semibold"
      >
        {plan.actionLabel}
      </ActionLink>
    </article>
  );
}
