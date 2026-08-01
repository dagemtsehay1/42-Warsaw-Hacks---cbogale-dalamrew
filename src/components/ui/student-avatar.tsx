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
      width={size}
      height={size}
      className={cn("shrink-0 rounded-sm object-cover", className)}
    />
  );
}
