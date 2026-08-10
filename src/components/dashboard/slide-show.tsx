"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { Slide } from "@/types/campus";

/** How long each uploaded slide holds the screen. */
const SLIDE_MS = 10_000;

/**
 * Bocal's uploaded posters, as one screen in the board rotation.
 *
 * It cycles internally rather than claiming one rotation slot per image: an
 * upload should not push the campus data off the wall proportionally to how
 * many posters bocal happens to have that week.
 *
 * `unoptimized` because these are already-sized uploads served from our own
 * database — running them through the image optimiser would cost a round trip
 * to re-encode bytes we control.
 */
export function SlideShow({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      SLIDE_MS,
    );
    return () => window.clearInterval(id);
  }, [slides.length]);

  // An upload or deletion can shrink the list under a stale index.
  const slide = slides[Math.min(index, slides.length - 1)];
  if (!slide) return null;

  return (
    <section className="relative flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
      <div className="relative min-h-0 flex-1">
        <Image
          src={`/api/slides/${slide.id}/image`}
          alt={slide.title}
          fill
          unoptimized
          priority
          className="object-contain"
        />
      </div>

      {slides.length > 1 && (
        <div
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5"
          aria-hidden
        >
          {slides.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 w-1.5 rounded-full ${
                i === index ? "bg-[var(--accent)]" : "bg-[var(--border)]"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
