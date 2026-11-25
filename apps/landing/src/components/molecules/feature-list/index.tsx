import { DesignImage } from "@/components/atoms/design-image";

type Feature = {
  title: string;
  description: string;
  icon: string;
};

export function FeatureList({ features }: { features: readonly Feature[] }) {
  return (
    <ul className="grid gap-3 pr-2">
      {features.map(({ title, description, icon }) => (
        <li key={title} className="group">
          <div className="flex items-start gap-4 rounded-[15px] border border-[#e2e2e2] bg-[#fafafa] p-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:group-hover:translate-x-2 sm:p-5">
            <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[#f0f0f0]">
              <DesignImage asset={icon} width={22} height={22} />
            </div>
            <div className="min-w-0 space-y-2">
              <h4 className="text-lg leading-6 font-semibold">{title}</h4>
              <p className="text-base leading-6 text-[#525252]">
                {description}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
