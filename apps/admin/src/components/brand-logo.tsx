import Image from "next/image";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      className={`brand-logo ${className}`}
      src="/brand/mybjj-academy-logo.png"
      alt="MyBJJ Academy"
      width={2172}
      height={724}
      priority
    />
  );
}
