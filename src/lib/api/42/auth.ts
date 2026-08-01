import type { FortyTwoTokenResponse } from "./types";
import { FortyTwoApiError, getApiBaseUrl, getAppCredentials } from "./config";

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

let appTokenCache: CachedToken | null = null;
let appTokenPromise: Promise<string> | null = null;

async function requestToken(
  body: Record<string, string>,
): Promise<FortyTwoTokenResponse> {
  const { apiBaseUrl } = getAppCredentials();
  const response = await fetch(`${apiBaseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new FortyTwoApiError(
      `Token request failed: ${text || response.statusText}`,
      response.status,
    );
  }

  return (await response.json()) as FortyTwoTokenResponse;
}

export async function getAppAccessToken(): Promise<string> {
  const now = Date.now();
  if (appTokenCache && appTokenCache.expiresAt > now + 60_000) {
    return appTokenCache.accessToken;
  }

  if (appTokenPromise) return appTokenPromise;

  appTokenPromise = (async () => {
    const { clientId, clientSecret } = getAppCredentials();
    const token = await requestToken({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    });

    appTokenCache = {
      accessToken: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    };
    return token.access_token;
  })();

  try {
    return await appTokenPromise;
  } finally {
    appTokenPromise = null;
  }
}

export function clearAppTokenCache() {
  appTokenCache = null;
}

export { getApiBaseUrl };
