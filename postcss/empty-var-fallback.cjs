/**
 * `var(--x,)` -> `var(--x, )`.
 *
 * Tailwind v4 writes empty fallbacks (`--tw-ring-inset`, the filter and
 * font-variant-numeric chains). Chromium 85 (the QM65B's browser) rejects the
 * whole declaration on `,)`, so `ring-*` draws nothing there. A single space is
 * the same empty fallback to every browser and parses in Chromium 85.
 */
module.exports = () => ({
  postcssPlugin: "empty-var-fallback",
  Declaration(decl) {
    if (decl.value.includes(",)")) {
      decl.value = decl.value.replace(/var\((--[\w-]+),\)/g, "var($1, )");
    }
  },
});
module.exports.postcss = true;
