import { NextResponse, type NextRequest } from "next/server";
import {
  buildAuthorizeUrl,
  CALLBACK_PATH,
  getRedirectUri,
} from "@/lib/api/42/oauth";
import { newOAuthState, OAUTH_STATE_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Starts the 42 login. The nonce goes out in `state` and into a short-lived
 * cookie; the callback only proceeds if the two match, which is what stops
 * someone else's authorization code being replayed into this browser.
 */
export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/teammate";
  const nonce = newOAuthState();

  let authorizeUrl: string;
  let redirectUri: string;
  try {
    redirectUri = await getRedirectUri();
    authorizeUrl = await buildAuthorizeUrl(nonce, returnTo);
  } catch (error) {
    // Almost always APP_PUBLIC_URL missing — say so rather than 500.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login unavailable" },
      { status: 503 },
    );
  }

  // 42 answers a mismatch with "The redirect uri included is not valid" and
  // nothing else — not what it received, not what it expected. Logging the exact
  // string turns that into a copy-paste into the intra application settings.
  console.log(`[auth] redirect_uri sent to 42: ${redirectUri}`);
  if (!redirectUri.endsWith(CALLBACK_PATH)) {
    console.warn(
      `[auth] that path is not ${CALLBACK_PATH}, which is the only callback route this app serves — 42 will redirect somewhere that 404s.`,
    );
  }

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 600,
  });

  return response;
}
