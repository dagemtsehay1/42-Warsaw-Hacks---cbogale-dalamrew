import { Fragment } from "react";
import Image from "next/image";

/**
 * Partner logo files live in `public/` as 0..12 with mixed extensions.
 * They are a fixed, hand-curated set, so the list is explicit rather than globbed.
 */
const PARTNER_LOGOS = [
  "0.png",
  "1.jpg",
  "2.png",
  "3.png",
  "4.png",
  "5.jpg",
  "6.png",
  "7.jpg",
  "8.jpg",
  "9.png",
  "10.jpg",
  "11.png",
  "12.png",
];

export function PartnerLogos() {
  return (
    <div
      className="shrink-0 overflow-hidden border-t border-[var(--border)] bg-[var(--panel)] py-3"
      aria-label="Campus partners"
    >
      <div className="logo-track flex w-max items-center gap-6 px-6">
        {/* Rendered twice so the marquee can loop seamlessly at -50%. */}
        {[0, 1].map((copy) => (
          <Fragment key={copy}>
            {PARTNER_LOGOS.map((file) => (
              <div
                key={`${copy}-${file}`}
                // Partner logos are drawn for light backgrounds — several are dark
                // artwork on transparency and would disappear on the dark panel — so
                // each sits on a white chip, which also unifies the mixed sources.
                // Fixed chip width keeps the strip evenly spaced regardless of how
                // wide any individual logo is.
                className="flex h-12 w-48 shrink-0 items-center justify-center rounded-md bg-white px-4"
              >
                <Image
                  src={`/${file}`}
                  alt=""
                  width={240}
                  height={80}
                  className="object-contain"
                  // Bounded on both axes so a wide lockup (12.png is 4.8:1) scales
                  // down to fit instead of stretching the strip, while square marks
                  // are limited by height. Both left `auto` to preserve the ratio.
                  style={{
                    maxHeight: "1.75rem",
                    maxWidth: "100%",
                    width: "auto",
                    height: "auto",
                  }}
                />
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
