import { RevealScope } from "@/components/atoms/reveal-scope";
import { FaqSection } from "@/components/organisms/faq-section";
import { FeaturesSection } from "@/components/organisms/features-section";
import { HeroSection } from "@/components/organisms/hero-section";
import { PricingSection } from "@/components/organisms/pricing-section";
import { SiteFooter } from "@/components/organisms/site-footer";

export function HomePage() {
  return (
    <RevealScope centerAnchors>
      <main>
        <HeroSection />
        <div className="mx-[10px]">
          <FeaturesSection />
          <PricingSection />
          <FaqSection />
        </div>
      </main>
      <div className="mx-[10px] mb-3">
        <SiteFooter home />
      </div>
    </RevealScope>
  );
}
