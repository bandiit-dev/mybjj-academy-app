import type { ReactNode } from "react";
import { AnalyticsLink } from "@/components/atoms/analytics-link";
import type { LandingEvent } from "@/lib/analytics";

export const adminUrl = "https://admin.mybjjacademy.com.br";

const tones = {
  primary: "bg-black text-white hover:bg-neutral-800",
  subtle: "bg-[#f0f0f0] text-black hover:bg-neutral-200",
  white: "bg-white text-black hover:bg-neutral-200",
};

export function ActionLink({
  children,
  href = adminUrl,
  subtle = false,
  tone = subtle ? "subtle" : "primary",
  radius = "lg",
  className = "",
  tracking,
}: {
  children: ReactNode;
  href?: string;
  subtle?: boolean;
  tone?: keyof typeof tones;
  radius?: "lg" | "xl";
  className?: string;
  tracking: LandingEvent;
}) {
  return (
    <AnalyticsLink
      href={href}
      tracking={tracking}
      className={`inline-flex min-h-10 items-center justify-center px-4 text-center text-sm font-semibold transition-colors ${radius === "xl" ? "rounded-xl" : "rounded-lg"} ${tones[tone]} ${className}`}
    >
      {children}
    </AnalyticsLink>
  );
}
