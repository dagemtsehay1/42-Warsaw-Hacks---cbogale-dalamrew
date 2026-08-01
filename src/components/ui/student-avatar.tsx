import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export function StudentAvatar({
  src,
  alt,
  size = 40,
  className,
}: {
  src?: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-sm bg-[var(--panel-elevated)] font-mono text-[var(--muted)]",
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {alt.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      // Rastered at twice the box it is drawn in, then constrained by CSS. Two
      // reasons, both of which showed as blur: 42 portraits are 4:3, so a raster
      // requested at `size` wide is only 0.75 × `size` tall and `object-cover`
      // has to stretch it back up; and a hallway TV (or a browser zoom) scales
      // the whole page past 1:1, which a raster sized exactly to the box cannot
      // survive.
      width={size * 2}
      height={size * 2}
      style={{ width: size, height: size }}
      className={cn("shrink-0 rounded-sm object-cover", className)}
    />
  );
}
