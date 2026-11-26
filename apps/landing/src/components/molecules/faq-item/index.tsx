"use client";

import type { ReactNode } from "react";
import { trackLandingEvent, type LandingEvent } from "@/lib/analytics";

export type FaqTopic = Extract<
  LandingEvent,
  { event: "faq_open" }
>["faq_topic"];

export function FaqItem({
  question,
  children,
  open,
  topic,
}: {
  question: string;
  children: ReactNode;
  open: boolean;
  topic: FaqTopic;
}) {
  return (
    <details
      name="landing-faq"
      open={open}
      className="group rounded-[15px] border border-[#9d9d9d] bg-white open:border-black"
    >
      <summary
        onClick={(event) => {
          if (!(event.currentTarget.parentElement as HTMLDetailsElement).open) {
            trackLandingEvent({ event: "faq_open", faq_topic: topic });
          }
        }}
        className="flex min-h-[62px] cursor-pointer list-none items-center justify-between gap-4 rounded-[15px] px-5 py-4 text-base leading-snug font-semibold text-black hover:bg-neutral-50 focus-visible:outline-offset-[-4px] [&::-webkit-details-marker]:hidden sm:px-[22px]"
      >
        {question}
        <span
          aria-hidden="true"
          className="mr-2 size-[7px] shrink-0 -translate-y-0.5 rotate-45 border-r border-b border-[#515151] motion-safe:transition-transform group-open:translate-y-0.5 group-open:rotate-[225deg] group-open:border-black"
        />
      </summary>
      <div className="border-t border-neutral-200 px-5 pt-4 pb-5 text-sm leading-relaxed text-[#515151] sm:px-[22px] sm:text-[15px]">
        {children}
      </div>
    </details>
  );
}
