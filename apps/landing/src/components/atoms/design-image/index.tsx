import Image from "next/image";

type DesignImageProps = {
  asset: string;
  width: number;
  height: number;
  alt?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
};

export function DesignImage({
  asset,
  width,
  height,
  alt = "",
  className,
  sizes,
  priority,
  loading,
}: DesignImageProps) {
  return (
    <Image
      src={`/landing/${asset}`}
      width={width}
      height={height}
      alt={alt}
      className={className}
      sizes={sizes}
      priority={priority}
      loading={loading}
    />
  );
}
