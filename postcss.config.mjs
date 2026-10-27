const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Chromium 85 (the QM65B's browser) has no cascade layers. This package
    // unwraps them and keeps the layer order via specificity.
    "@csstools/postcss-cascade-layers": {},
    // Logical properties (`padding-inline`, `inset-inline`, ...) -> physical.
    "postcss-logical": {},
    // `:is()` -> a plain selector list.
    "@csstools/postcss-is-pseudo-class": {},
    // Tailwind v4 registers its custom properties with `@property`. Chromium 85
    // crashes in `PropertyRegistry::DeclareProperty` when a page with those
    // rules reloads, so drop them. globals.css sets the same `--tw-*` defaults
    // for browsers where Tailwind's own fallback does not apply.
    "postcss-remove-at-rules": { property: "*" },
  },
};

export default config;
