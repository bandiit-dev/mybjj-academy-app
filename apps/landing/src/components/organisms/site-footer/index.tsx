import Link from "next/link";
import { BrandLogo } from "@/components/atoms/brand-logo";
import { DesignImage } from "@/components/atoms/design-image";

const contactUrl = "mailto:contato@mybjjacademy.com.br";

export function SiteFooter({ home = false }: { home?: boolean }) {
  const homePath = home ? "" : "/";
  return (
    <footer
      data-scroll-reveal="pending"
      id="contato"
      className="mt-28 rounded-[26px] bg-black px-6 pt-[55px] pb-7 text-white sm:px-[58px] lg:mt-[151px] lg:min-h-[470px]"
    >
      <div className="mx-auto max-w-[1304px]">
        <div className="grid gap-8 md:grid-cols-[1fr_24%]">
          <h2 className="text-[clamp(2rem,4vw,3rem)] leading-[1.22]">
            Pronto para modernizar a<br className="hidden sm:block" /> gestão da
            sua academia?
          </h2>
          <nav
            aria-label="Navegação do rodapé"
            className="flex flex-wrap gap-x-6 gap-y-[18px] text-lg leading-tight md:mt-8 md:flex-col md:items-start"
          >
            <Link href={`${homePath}#recursos`}>Recursos</Link>
            <Link href={`${homePath}#planos`}>Planos</Link>
            <Link href={`${homePath}#sobre`}>Sobre</Link>
            <a href={contactUrl}>Contato</a>
          </nav>
        </div>
        <div className="mt-10 flex lg:mt-[47px]">
          <BrandLogo footer href={`${homePath}#inicio`} />
        </div>
        <DesignImage
          asset="2d02d.svg"
          width={1312}
          height={1}
          className="mt-10 max-w-full lg:mt-[53px]"
        />
        <div className="mt-[35px] grid items-center gap-5 text-[#f0f0f0] sm:grid-cols-[1fr_auto_1fr]">
          <a
            href="https://www.instagram.com/mybjjacademyapp/"
            className="justify-self-start"
          >
            <DesignImage
              asset="09216.svg"
              width={30}
              height={30}
              alt="Instagram"
            />
          </a>
          <div className="flex flex-wrap gap-x-7 gap-y-2 text-sm">
            <Link href="/politica-de-privacidade">Política de Privacidade</Link>
            <Link href="/termos-de-uso">Termos de Uso</Link>
          </div>
          <p className="text-xs sm:text-right">
            © 2026 MYBJJ ACADEMY. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
