"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

function scrollToSection(
  section: HTMLElement,
  behavior: ScrollBehavior = "auto",
) {
  const { top, height } = section.getBoundingClientRect();
  const viewport = document.documentElement.clientHeight;
  const offset =
    height < viewport
      ? (viewport - height) / 2
      : parseFloat(
          getComputedStyle(document.documentElement).scrollPaddingTop,
        ) || 0;

  window.scrollTo({ top: window.scrollY + top - offset, behavior });
}

export function RevealScope({
  children,
  className,
  centerAnchors = false,
}: {
  children: ReactNode;
  className?: string;
  centerAnchors?: boolean;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!centerAnchors || !window.location.hash) return;
    const frame = window.requestAnimationFrame(() => {
      const section = document.getElementById(window.location.hash.slice(1));
      if (section && scope.current?.contains(section)) {
        scrollToSection(section, "instant");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [centerAnchors]);

  function handleAnchor(event: MouseEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !(event.target instanceof Element)
    )
      return;

    const link = event.target.closest<HTMLAnchorElement>("a[href]");
    if (
      !link ||
      link.hasAttribute("download") ||
      (link.target && link.target !== "_self")
    )
      return;
    const url = new URL(link.href);
    const current = window.location;
    if (
      !url.hash ||
      url.origin !== current.origin ||
      url.pathname !== current.pathname ||
      url.search !== current.search
    )
      return;

    const section = document.getElementById(url.hash.slice(1));
    if (!section || !event.currentTarget.contains(section)) return;

    event.preventDefault();
    if (current.hash) {
      window.history.replaceState(null, "", current.pathname + current.search);
    }
    if (!section.hasAttribute("tabindex")) section.tabIndex = -1;
    section.focus({ preventScroll: true });
    scrollToSection(section);
  }

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
    <div
      ref={scope}
      className={className}
      onClickCapture={centerAnchors ? handleAnchor : undefined}
    >
      {children}
    </div>
  );
}
