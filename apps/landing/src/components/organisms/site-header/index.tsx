import Link from "next/link";
import { ActionLink } from "@/components/atoms/action-link";
import { BrandLogo } from "@/components/atoms/brand-logo";

export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-[1262px] flex-wrap items-center justify-center gap-x-6 gap-y-4 px-4 pt-8 sm:justify-between lg:relative lg:pl-[71px] lg:pr-0">
      <BrandLogo href="/#inicio" />
      <nav
        aria-label="Navegação principal"
        className="order-last flex w-full justify-center gap-8 text-base lg:absolute lg:left-1/2 lg:order-none lg:w-auto lg:-translate-x-1/2"
      >
        <Link href="/#recursos">Recursos</Link>
        <Link href="/#planos">Preço</Link>
        <a href="#contato">Contato</a>
      </nav>
      <div className="flex gap-3.5">
        <ActionLink subtle className="min-w-[100px]">
          Entrar
        </ActionLink>
        <ActionLink className="min-w-[156px]">Começar agora</ActionLink>
      </div>
    </header>
  );
}
