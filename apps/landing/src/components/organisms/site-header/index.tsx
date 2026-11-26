import Link from "next/link";
import { ActionLink } from "@/components/atoms/action-link";
import { BrandLogo } from "@/components/atoms/brand-logo";

export function SiteHeader({ home = false }: { home?: boolean }) {
  const homePath = home ? "" : "/";
  const radius = home ? "xl" : "lg";
  return (
    <header
      className={`relative z-10 mx-auto flex max-w-[1262px] flex-wrap items-center justify-center gap-x-6 gap-y-4 px-4 pt-4 sm:justify-between ${home ? "text-white min-[1200px]:pt-[26px]" : ""} lg:pl-[71px] min-[1300px]:pr-0`}
    >
      <BrandLogo href={`${homePath}#inicio`} />
      <nav
        aria-label="Navegação principal"
        className="order-last flex w-full justify-center gap-8 text-base lg:absolute lg:left-1/2 lg:order-none lg:w-auto lg:-translate-x-1/2"
      >
        <Link href={`${homePath}#recursos`}>Recursos</Link>
        <Link href={`${homePath}#planos`}>Planos</Link>
        <Link href={`${homePath}#faq`}>FAQ</Link>
      </nav>
      <div className="flex gap-3.5">
        <ActionLink
          subtle
          radius={radius}
          className="min-w-[100px]"
          tracking={{ event: "login_click", cta_location: "header" }}
        >
          Entrar
        </ActionLink>
        <ActionLink
          radius={radius}
          className="min-w-[156px]"
          tracking={{ event: "signup_click", cta_location: "header" }}
        >
          Começar agora
        </ActionLink>
      </div>
    </header>
  );
}
