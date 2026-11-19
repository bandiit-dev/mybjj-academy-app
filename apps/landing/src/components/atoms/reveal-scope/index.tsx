"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function RevealScope({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scope.current || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-scroll-reveal", "entered");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px 48px 0px" },
    );

    scope.current
      .querySelectorAll('[data-scroll-reveal="pending"]')
      .forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
