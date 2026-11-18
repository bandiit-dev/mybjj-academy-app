"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

export function PortalImage({
  src,
  className,
  fallback,
  alt = "",
  contain = false,
}: {
  src?: string;
  className: string;
  fallback: ReactNode;
  alt?: string;
  contain?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <span
      className={`${className} portal-image${contain ? " portal-image-contain" : ""}`}
    >
      {src && !failed ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="128px"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        fallback
      )}
    </span>
  );
}
