import { headers } from "next/headers";
import { FortyTwoApiError, getApiBaseUrl, getAppCredentials } from "./config";
import { displayNameFromUser, imageUrlFromUser } from "./transforms";
import type { FortyTwoTokenResponse, FortyTwoUser } from "./types";
import type { SessionUser } from "@/lib/auth/session";

/**
 * The *user* OAuth flow — the one thing the dashboard deliberately avoided
 * until the teammate board needed to know who is standing in front of it.
 *
 * It stays strictly separate from the app's `client_credentials` token in
 * `auth.ts`: that one reads campus-wide data for the wall and is cached for the
 * life of the process, this one exists for the length of a single login and is
 * thrown away as soon as we have read `/v2/me`. Nothing on the board is ever
 * fetched with a student's token.
 */

/** Only `public` is needed — we read the profile and the student's own projects. */
const SCOPE = "public";

/** The origin of a URL string, or null if it isn't one. */
function originOf(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * This app's public address — what the QR code encodes, where 42 sends students
 * back, and where every redirect after a login points.
 *
 * The request's own origin is deliberately **not** the first choice. In Docker
 * the server listens on 3000 behind a published 27942, and nothing rewrites the
 * Host header, so `request.nextUrl.origin` is `http://localhost:3000` — an
 * address that exists only inside the container. Bouncing a phone there is the
 * whole "redirected me to :3000" symptom.
 *
 * Order: `APP_PUBLIC_URL`, then the origin of `FORTYTWO_REDIRECT_URI` (if that
 * is set the deployment has already declared its public address), then the
 * incoming request as a last resort for a plain `npm run dev`.
 */
export async function resolveBaseUrl(): Promise<string | null> {
  // Only the origin is meaningful. Pasting a whole page address here is an easy
  // mistake, and appending to it produces `…/teammate/api/auth/callback`, which
  // 42 rejects with a message that says nothing about the cause.
  const configured =
    originOf(process.env.APP_PUBLIC_URL) ??
    originOf(process.env.FORTYTWO_REDIRECT_URI);
  if (configured) return configured;

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  if (!host) return null;

  // A loopback host is only reachable by the machine that asked, so a QR code
  // pointing at it would be a dead end for every phone in the room.
  if (/^(localhost|127\.|\[::1\]|::1)/i.test(host)) return null;

  const proto = headerList.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

/**
 * An absolute URL on the public origin, for redirecting a browser to one of our
 * own pages. Falls back to `fallbackOrigin` (the request's) only when nothing is
 * configured, which is the dev-server case.
 */
export async function publicUrl(
  path: string,
  fallbackOrigin: string,
): Promise<URL> {
  const base = (await resolveBaseUrl()) ?? fallbackOrigin;
  return new URL(path, base);
}

/** True when a login can be attempted at all. */
export async function canSignIn(): Promise<boolean> {
  return (await resolveBaseUrl()) != null;
}

/** The path this app actually serves the OAuth callback on. */
export const CALLBACK_PATH = "/api/auth/callback";

/**
 * The redirect URI sent to 42. It must match one registered on the intra
 * application **character for character** — 42's rejection message ("The
 * redirect uri included is not valid") names no detail, so every difference
 * costs a round of guessing.
 *
 * `FORTYTWO_REDIRECT_URI` overrides everything and is used verbatim, for when
 * the registered value is already fixed and re-registering is the slower path.
 * It still has to point at `CALLBACK_PATH`, since that is the only callback
 * route that exists.
 *
 * Otherwise it is the resolved origin plus that path, with any doubled slashes
 * collapsed — `host:27942//api/...` and `host:27942/api/...` are different URIs
 * to 42 and identical to a human reading them.
 */
export async function getRedirectUri(): Promise<string> {
  const explicit = process.env.FORTYTWO_REDIRECT_URI?.trim();
  if (explicit) return normalizeUri(explicit);

  const base = await resolveBaseUrl();
  if (!base) {
    throw new Error(
      "Cannot work out this app's public address. Set APP_PUBLIC_URL, e.g. http://10.11.12.13:27942",
    );
  }
  return `${base}${CALLBACK_PATH}`;
}

/** Collapses `//` inside the path without touching the `https://` separator. */
function normalizeUri(raw: string): string {
  try {
    const url = new URL(raw);
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

/** The 42 consent screen to send the browser to. */
export async function buildAuthorizeUrl(
  state: string,
  returnTo: string,
): Promise<string> {
  const { clientId } = getAppCredentials();
  const url = new URL(`${getApiBaseUrl()}/oauth/authorize`);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", await getRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  // `state` carries the CSRF nonce and the page to land on, so one callback
  // route serves both the teammate board and the admin page.
  url.searchParams.set("state", `${state}:${encodeURIComponent(returnTo)}`);

  return url.toString();
}

/** Splits the `state` parameter back into its nonce and its destination. */
export function parseState(raw: string | null): {
  nonce: string;
  returnTo: string;
} {
  if (!raw) return { nonce: "", returnTo: "/teammate" };
  const separator = raw.indexOf(":");
  if (separator < 0) return { nonce: raw, returnTo: "/teammate" };

  const returnTo = decodeURIComponent(raw.slice(separator + 1));
  return {
    nonce: raw.slice(0, separator),
    // Only same-site paths, so a crafted link can't bounce someone off-site.
    returnTo: returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/teammate",
  };
}

async function exchangeCode(code: string): Promise<string> {
  const { clientId, clientSecret, apiBaseUrl } = getAppCredentials();

  const response = await fetch(`${apiBaseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: await getRedirectUri(),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new FortyTwoApiError(
      `Code exchange failed: ${text || response.statusText}`,
      response.status,
    );
  }

  const token = (await response.json()) as FortyTwoTokenResponse;
  return token.access_token;
}

/** `/v2/me` for the signed-in student. */
async function fetchMe(accessToken: string): Promise<FortyTwoUser> {
  const response = await fetch(`${getApiBaseUrl()}/v2/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new FortyTwoApiError(
      `Could not read the 42 profile: ${response.statusText}`,
      response.status,
    );
  }

  return (await response.json()) as FortyTwoUser;
}

/**
 * Code → session user. The access token is used twice here and then dropped;
 * it is never stored, never put in a cookie and never used for board data.
 */
export async function completeLogin(code: string): Promise<SessionUser> {
  const accessToken = await exchangeCode(code);
  const me = await fetchMe(accessToken);

  return {
    id: me.id,
    login: me.login,
    displayName: displayNameFromUser(me),
    imageUrl: imageUrlFromUser(me),
    isStaff: me["staff?"] === true,
  };
}
