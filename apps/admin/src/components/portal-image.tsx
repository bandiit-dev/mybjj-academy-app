"use client";

import { useEffect, useState, type ReactNode } from "react";

export function PortalImage({src, className, fallback, alt = "", contain = false}: {
  src?: string; className: string; fallback: ReactNode; alt?: string; contain?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <span className={`${className} portal-image${contain ? " portal-image-contain" : ""}`}>
    {src && !failed ? <img src={src} alt={alt} onError={()=>setFailed(true)}/> : fallback}
  </span>;
}
