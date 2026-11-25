import Link from "next/link";
import { siteName } from "@/lib/site-metadata";
import { DesignImage } from "../design-image";

export function BrandLogo({
  footer = false,
  href = "#inicio",
}: {
  footer?: boolean;
  href?: string;
}) {
  return (
    <Link href={href} aria-label={`${siteName} — início`}>
      <DesignImage
        asset="d98b8.png"
        alt={siteName}
        width={footer ? 271 : 200}
        height={footer ? 45 : 34}
        loading={footer ? "lazy" : "eager"}
        className="h-auto"
      />
    </Link>
  );
}
