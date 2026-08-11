import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `resolveBaseUrl` reads request headers, so these tests cover the branch that
 * does not: an explicit `FORTYTWO_REDIRECT_URI`. That is the branch worth
 * pinning anyway — it is what a deployment sets once the registered URI is
 * fixed, and 42 rejects any mismatch with a message that names no detail.
 */
vi.mock("next/headers", () => ({
  headers: async () => new Map(),
}));

const ORIGINAL = process.env.FORTYTWO_REDIRECT_URI;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.FORTYTWO_REDIRECT_URI;
  else process.env.FORTYTWO_REDIRECT_URI = ORIGINAL;
});

async function redirectUriFor(value: string): Promise<string> {
  process.env.FORTYTWO_REDIRECT_URI = value;
  const { getRedirectUri } = await import("@/lib/api/42/oauth");
  return getRedirectUri();
}

describe("getRedirectUri", () => {
  it("uses an explicit redirect URI as-is", async () => {
    await expect(
      redirectUriFor("http://10.18.200.117:27942/api/auth/callback"),
    ).resolves.toBe("http://10.18.200.117:27942/api/auth/callback");
  });

  it("collapses a doubled slash in the path", async () => {
    // `host:27942//api/...` and `host:27942/api/...` are different URIs to 42
    // and indistinguishable to someone reading them.
    await expect(
      redirectUriFor("http://10.18.200.117:27942//api/auth/callback"),
    ).resolves.toBe("http://10.18.200.117:27942/api/auth/callback");
  });

  it("keeps the scheme's own double slash intact", async () => {
    const uri = await redirectUriFor("https://board.42.pl//api/auth/callback");
    expect(uri.startsWith("https://")).toBe(true);
    expect(uri).toBe("https://board.42.pl/api/auth/callback");
  });

  it("preserves the port, which 42 matches on", async () => {
    await expect(
      redirectUriFor("http://10.0.0.5:27942/api/auth/callback"),
    ).resolves.toContain(":27942");
  });

  it("leaves an unparseable value alone rather than mangling it", async () => {
    await expect(redirectUriFor("not a url")).resolves.toBe("not a url");
  });
});

describe("resolveBaseUrl", () => {
  const ORIGINAL_PUBLIC = process.env.APP_PUBLIC_URL;

  afterEach(() => {
    if (ORIGINAL_PUBLIC === undefined) delete process.env.APP_PUBLIC_URL;
    else process.env.APP_PUBLIC_URL = ORIGINAL_PUBLIC;
  });

  async function baseFor(value: string) {
    process.env.APP_PUBLIC_URL = value;
    const { resolveBaseUrl } = await import("@/lib/api/42/oauth");
    return resolveBaseUrl();
  }

  it("reduces a full page address to its origin", async () => {
    // Pasting the page you want students to land on is an easy mistake, and
    // appending to it produced `…/teammate/api/auth/callback`.
    await expect(baseFor("http://10.18.200.117:27942/teammate")).resolves.toBe(
      "http://10.18.200.117:27942",
    );
  });

  it("accepts a bare origin unchanged", async () => {
    await expect(baseFor("http://10.18.200.117:27942")).resolves.toBe(
      "http://10.18.200.117:27942",
    );
  });

  it("drops a trailing slash", async () => {
    await expect(baseFor("http://10.18.200.117:27942/")).resolves.toBe(
      "http://10.18.200.117:27942",
    );
  });

  it("falls back to the redirect URI's origin when APP_PUBLIC_URL is unset", async () => {
    // One env var is enough to configure a deployment.
    delete process.env.APP_PUBLIC_URL;
    process.env.FORTYTWO_REDIRECT_URI =
      "http://10.18.200.117:27942/api/auth/callback";

    const { resolveBaseUrl } = await import("@/lib/api/42/oauth");
    await expect(resolveBaseUrl()).resolves.toBe("http://10.18.200.117:27942");
  });

  it("prefers APP_PUBLIC_URL over the redirect URI's origin", async () => {
    process.env.APP_PUBLIC_URL = "http://board.42.pl:27942";
    process.env.FORTYTWO_REDIRECT_URI =
      "http://10.18.200.117:27942/api/auth/callback";

    const { resolveBaseUrl } = await import("@/lib/api/42/oauth");
    await expect(resolveBaseUrl()).resolves.toBe("http://board.42.pl:27942");
  });

  it("never returns the container's own port when configured", async () => {
    // The ":3000 instead of :27942" bug: behind Docker the request origin is
    // the container's internal address, so configuration has to win.
    process.env.APP_PUBLIC_URL = "http://10.18.200.117:27942";
    const { resolveBaseUrl, publicUrl } = await import("@/lib/api/42/oauth");

    await expect(resolveBaseUrl()).resolves.not.toContain(":3000");
    const url = await publicUrl("/teammate", "http://localhost:3000");
    expect(url.toString()).toBe("http://10.18.200.117:27942/teammate");
  });
});
