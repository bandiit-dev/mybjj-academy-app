import { RevealScope } from "@/components/atoms/reveal-scope";
import { FaqSection } from "@/components/organisms/faq-section";
import { FeaturesSection } from "@/components/organisms/features-section";
import { HeroSection } from "@/components/organisms/hero-section";
import { PricingSection } from "@/components/organisms/pricing-section";
import { SiteFooter } from "@/components/organisms/site-footer";

export function HomePage() {
  return (
    <RevealScope className="mx-[10px] my-[12px]" centerAnchors>
      <main>
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
        <FaqSection />
      </main>
      <SiteFooter home />
    </RevealScope>
  );
}
