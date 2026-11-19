import { DesignImage } from "../design-image";

export function BrandLogo({ footer = false }: { footer?: boolean }) {
  return (
    <a href="#inicio" aria-label="MyBJJ Academy — início">
      <DesignImage
        asset="d98b8.png"
        alt="MyBJJ Academy"
        width={footer ? 271 : 200}
        height={footer ? 45 : 34}
        className="h-auto"
      />
    </a>
  );
}
