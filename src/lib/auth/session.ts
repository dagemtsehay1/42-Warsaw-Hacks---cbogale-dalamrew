import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Signed-cookie sessions for the two pages a human logs into: the teammate
 * board and the bocal admin page. The wall display itself never has a session.
 *
 * There is no session table on purpose. Everything we need — who you are and
 * whether you are staff — comes back from `/v2/me` at login and fits in a
 * cookie, so a login costs one 42 API call and every request after it costs
 * none. The cookie is signed, not encrypted: none of it is secret (your login
 * and avatar are on the wall already), it only must not be forgeable.
 */

export type SessionUser = {
  id: number;
  login: string;
  displayName: string;
  imageUrl?: string;
  /** From `staff?` on `/v2/me`. Gates the admin page. */
  isStaff: boolean;
};

export const SESSION_COOKIE = "ft_session";
export const OAUTH_STATE_COOKIE = "ft_oauth_state";

/** A login lasts a day — long enough to add and remove in one sitting. */
export const SESSION_MAX_AGE_S = 24 * 60 * 60;

type SessionPayload = SessionUser & { exp: number };

/**
 * The signing key. Falls back to the 42 client secret so there is one less
 * required env var: it is already a high-entropy server-only secret, and if it
 * rotates every session simply expires early.
 */
function signingKey(): string {
  const explicit = process.env.SESSION_SECRET?.trim();
  if (explicit) return explicit;

  const fallback = process.env.FORTYTWO_CLIENT_SECRET?.trim();
  if (fallback) return fallback;

  throw new Error("SESSION_SECRET (or FORTYTWO_CLIENT_SECRET) must be set");
}

function sign(value: string): string {
  return createHmac("sha256", signingKey()).update(value).digest("base64url");
}

/** Constant-time compare that also tolerates length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function encodeSession(user: SessionUser, now = Date.now()): string {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(now / 1000) + SESSION_MAX_AGE_S,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/**
 * Returns the user, or null for anything that is not a currently-valid cookie:
 * wrong shape, bad signature, expired. Callers treat null as logged out.
 */
export function decodeSession(
  cookie: string | undefined,
  now = Date.now(),
): SessionUser | null {
  if (!cookie) return null;

  const separator = cookie.lastIndexOf(".");
  if (separator <= 0) return null;

  const body = cookie.slice(0, separator);
  const signature = cookie.slice(separator + 1);
  if (!safeEqual(signature, sign(body))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (typeof payload.exp !== "number" || payload.exp * 1000 <= now) {
      return null;
    }
    if (typeof payload.id !== "number" || typeof payload.login !== "string") {
      return null;
    }

    return {
      id: payload.id,
      login: payload.login,
      displayName: payload.displayName || payload.login,
      imageUrl: payload.imageUrl,
      isStaff: payload.isStaff === true,
    };
  } catch {
    return null;
  }
}

/** Random value tying an OAuth callback to the browser that started it. */
export function newOAuthState(): string {
  return randomBytes(24).toString("base64url");
}
