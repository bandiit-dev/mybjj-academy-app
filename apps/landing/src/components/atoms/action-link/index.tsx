import type { ReactNode } from "react";

export const adminUrl = "https://admin.mybjjacademy.com.br";

export function ActionLink({
  children,
  href = adminUrl,
  subtle = false,
  className = "",
}: {
  children: ReactNode;
  href?: string;
  subtle?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-center text-base transition-colors ${subtle ? "bg-[#f0f0f0] text-black hover:bg-neutral-200" : "bg-black text-white hover:bg-neutral-800"} ${className}`}
    >
      {children}
    </a>
  );
}
