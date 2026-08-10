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

/**
 * Where 42 sends the student back, and what the QR code encodes.
 *
 * `APP_PUBLIC_URL` wins when it is set. When it isn't, the address is taken
 * from the request the board itself arrived on — whatever the TV typed into its
 * browser is, by definition, an address that resolves on the campus network, so
 * it is the right thing to put in a QR code.
 *
 * The one case that needs the env var is a TV browsing to `localhost` (the
 * display device is also the host). A phone resolves `localhost` to itself, so
 * that is rejected below rather than encoded into a code that goes nowhere.
 */
export async function resolveBaseUrl(): Promise<string | null> {
  const configured = process.env.APP_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  if (!host) return null;

  // A loopback host is only reachable by the machine that asked, so a QR code
  // pointing at it would be a dead end for every phone in the room.
  if (/^(localhost|127\.|\[::1\]|::1)/i.test(host)) return null;

  const proto = headerList.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

/** True when a login can be attempted at all. */
export async function canSignIn(): Promise<boolean> {
  return (await resolveBaseUrl()) != null;
}

export async function getRedirectUri(): Promise<string> {
  const base = await resolveBaseUrl();
  if (!base) {
    throw new Error(
      "Cannot work out this app's public address. Set APP_PUBLIC_URL, e.g. http://10.11.12.13:27942",
    );
  }
  return `${base}/api/auth/callback`;
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
