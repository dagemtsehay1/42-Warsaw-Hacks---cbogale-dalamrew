import { beforeEach, describe, expect, it } from "vitest";
import {
  decodeSession,
  encodeSession,
  newOAuthState,
  SESSION_MAX_AGE_S,
  type SessionUser,
} from "@/lib/auth/session";

const USER: SessionUser = {
  id: 4242,
  login: "cbogale",
  displayName: "C Bogale",
  imageUrl: "https://cdn.intra.42.fr/users/x.jpg",
  isStaff: false,
};

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret-not-a-real-one";
});

describe("session cookies", () => {
  it("round-trips a user", () => {
    expect(decodeSession(encodeSession(USER))).toEqual(USER);
  });

  it("rejects a tampered payload", () => {
    const cookie = encodeSession(USER);
    const [body, signature] = cookie.split(".");

    // Flip the staff flag and keep the original signature.
    const forged = Buffer.from(
      JSON.stringify({ ...USER, isStaff: true, exp: 2 ** 40 }),
    ).toString("base64url");

    expect(decodeSession(`${forged}.${signature}`)).toBeNull();
    // Sanity: the untampered pair still works.
    expect(decodeSession(`${body}.${signature}`)).not.toBeNull();
  });

  it("rejects a cookie signed with a different secret", () => {
    const cookie = encodeSession(USER);
    process.env.SESSION_SECRET = "a-different-secret";
    expect(decodeSession(cookie)).toBeNull();
  });

  it("rejects an expired cookie", () => {
    const issued = Date.now();
    const cookie = encodeSession(USER, issued);
    const afterExpiry = issued + (SESSION_MAX_AGE_S + 1) * 1000;
    expect(decodeSession(cookie, afterExpiry)).toBeNull();
  });

  it("treats junk as logged out rather than throwing", () => {
    for (const junk of [undefined, "", "nodot", "a.b", "....", "%%%.%%%"]) {
      expect(decodeSession(junk)).toBeNull();
    }
  });

  it("preserves the staff flag for a real staff session", () => {
    const staff = { ...USER, isStaff: true };
    expect(decodeSession(encodeSession(staff))?.isStaff).toBe(true);
  });

  it("issues distinct OAuth state values", () => {
    const values = new Set(Array.from({ length: 50 }, newOAuthState));
    expect(values.size).toBe(50);
  });
});
