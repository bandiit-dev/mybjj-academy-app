import Image from "next/image";

type DesignImageProps = {
  asset: string;
  width: number;
  height: number;
  alt?: string;
  className?: string;
};

export function DesignImage({
  asset,
  width,
  height,
  alt = "",
  className,
}: DesignImageProps) {
  return (
    <Image
      src={`/landing/${asset}`}
      width={width}
      height={height}
      alt={alt}
      className={className}
      loading="eager"
      unoptimized
    />
  );
}
