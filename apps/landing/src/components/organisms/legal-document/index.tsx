import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/atoms/brand-logo";

export type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

export function LegalDocument({
  title,
  introduction,
  sections,
}: {
  title: string;
  introduction: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto max-w-4xl px-5 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 py-6">
        <BrandLogo href="/#inicio" />
        <Link href="/" className="text-sm underline underline-offset-4">
          Voltar ao início
        </Link>
      </header>

      <main className="py-12 sm:py-16">
        <h1 className="text-4xl leading-tight font-semibold sm:text-5xl">
          {title}
        </h1>
        <div className="mt-6 space-y-4 leading-relaxed text-neutral-700">
          {introduction}
        </div>

        <nav
          aria-label="Nesta página"
          className="my-10 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6"
        >
          <h2 className="font-semibold">Nesta página</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed sm:grid sm:grid-flow-col sm:grid-rows-5 sm:gap-x-8 sm:space-y-0 sm:gap-y-2">
            {sections.map(({ id, title }) => (
              <li key={id}>
                <a href={`#${id}`}>{title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-8">
          {sections.map(({ id, title, content }, index) => (
            <section
              key={id}
              id={id}
              aria-labelledby={`${id}-titulo`}
              className="scroll-mt-6 border-t border-neutral-200 pt-7"
            >
              <h2 id={`${id}-titulo`} className="text-2xl font-semibold">
                {index + 1}. {title}
              </h2>
              <div className="mt-3 space-y-3 leading-relaxed text-neutral-700 [&_a]:underline [&_a]:underline-offset-4 [&_li]:my-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                {content}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
