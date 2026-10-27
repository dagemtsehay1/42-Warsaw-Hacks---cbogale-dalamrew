import Script from "next/script";

/**
 * JavaScript polyfills for the Samsung QM65B's Chromium 85 browser.
 *
 * Next 16 and React 19 use a handful of APIs that landed after M85. Next already
 * ships `Object.hasOwn`, `Array.prototype.at` and `URL.canParse` polyfills when
 * the build is targeted at Chrome 85, but `structuredClone` is not covered — and
 * the RSC client runtime calls it when it clones an Error.
 *
 * `beforeInteractive` makes Next inject this into the initial HTML before its
 * own async chunks, so the globals exist before any framework module evaluates.
 */
const LEGACY_POLYFILLS = String.raw`
(function () {
  "use strict";

  if (typeof Object.hasOwn !== "function") {
    Object.defineProperty(Object, "hasOwn", {
      configurable: true,
      writable: true,
      value: function hasOwn(object, property) {
        if (object === null || object === undefined) {
          throw new TypeError("Cannot convert undefined or null to object");
        }
        return Object.prototype.hasOwnProperty.call(Object(object), property);
      },
    });
  }

  if (typeof Array.prototype.at !== "function") {
    Object.defineProperty(Array.prototype, "at", {
      configurable: true,
      writable: true,
      value: function at(index) {
        var length = this.length;
        var k = Math.trunc(index) || 0;
        if (k < 0) k += length;
        if (k < 0 || k >= length) return undefined;
        return this[k];
      },
    });
  }

  if (typeof String.prototype.at !== "function") {
    Object.defineProperty(String.prototype, "at", {
      configurable: true,
      writable: true,
      value: function at(index) {
        var string = String(this);
        var k = Math.trunc(index) || 0;
        if (k < 0) k += string.length;
        if (k < 0 || k >= string.length) return undefined;
        return string.charAt(k);
      },
    });
  }

  if (typeof URL !== "undefined" && typeof URL.canParse !== "function") {
    URL.canParse = function canParse(url, base) {
      try {
        new URL(url, base);
        return true;
      } catch (error) {
        return false;
      }
    };
  }

  if (typeof window.structuredClone !== "function") {
    var cloneValue = function (value, seen) {
      if (value === null || typeof value !== "object") return value;
      if (seen.has(value)) return seen.get(value);

      var copy;
      if (value instanceof Date) {
        copy = new Date(value.getTime());
      } else if (value instanceof RegExp) {
        copy = new RegExp(value.source, value.flags);
        copy.lastIndex = value.lastIndex;
      } else if (value instanceof Error) {
        copy = new Error(value.message);
        copy.name = value.name;
        copy.stack = value.stack;
        if ("cause" in value) copy.cause = cloneValue(value.cause, seen);
      } else if (typeof Map !== "undefined" && value instanceof Map) {
        copy = new Map();
        seen.set(value, copy);
        value.forEach(function (item, key) {
          copy.set(cloneValue(key, seen), cloneValue(item, seen));
        });
        return copy;
      } else if (typeof Set !== "undefined" && value instanceof Set) {
        copy = new Set();
        seen.set(value, copy);
        value.forEach(function (item) {
          copy.add(cloneValue(item, seen));
        });
        return copy;
      } else if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
        copy = value.slice(0);
      } else if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value)) {
        copy = new value.constructor(
          value.buffer.slice(0),
          value.byteOffset,
          value.length
        );
      } else if (typeof Blob !== "undefined" && value instanceof Blob) {
        copy = value.slice(0, value.size, value.type);
      } else if (value instanceof Boolean) {
        copy = new Boolean(value.valueOf());
      } else if (value instanceof Number) {
        copy = new Number(value.valueOf());
      } else if (value instanceof String) {
        copy = new String(value.valueOf());
      } else if (Array.isArray(value)) {
        copy = [];
      } else {
        copy = Object.create(Object.getPrototypeOf(value));
      }

      seen.set(value, copy);
      if (Array.isArray(value)) {
        for (var i = 0; i < value.length; i += 1) {
          copy[i] = cloneValue(value[i], seen);
        }
        return copy;
      }
      Object.keys(value).forEach(function (key) {
        copy[key] = cloneValue(value[key], seen);
      });
      return copy;
    };

    window.structuredClone = function structuredClone(value) {
      return cloneValue(value, new Map());
    };
  }
})();
`;

export function LegacyPolyfills() {
  return (
    // App Router allows `beforeInteractive` in the root layout; the lint rule
    // still points at the legacy `pages/_document.js`.
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script
      id="legacy-browser-polyfills"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: LEGACY_POLYFILLS }}
    />
  );
}
