import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "outline" | "accent";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-50",
        variant === "default" &&
          "bg-[var(--panel-elevated)] text-[var(--foreground)] hover:bg-[var(--panel-hover)] border border-[var(--border)]",
        variant === "ghost" && "hover:bg-[var(--panel-hover)] text-[var(--foreground)]",
        variant === "outline" &&
          "border border-[var(--border)] bg-transparent hover:bg-[var(--panel-hover)]",
        variant === "accent" &&
          "bg-[var(--accent)] text-[var(--accent-foreground)] hover:brightness-110",
        size === "default" && "h-10 px-4 text-sm",
        size === "sm" && "h-8 px-3 text-xs",
        size === "lg" && "h-12 px-6 text-base",
        size === "icon" && "h-10 w-10",
        className,
      )}
      {...props}
    />
  );
}
