import { NextResponse, type NextRequest } from "next/server";
import { completeLogin, parseState } from "@/lib/api/42/oauth";
import {
  encodeSession,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function failure(request: NextRequest, returnTo: string, reason: string) {
  const url = new URL(returnTo, request.nextUrl.origin);
  url.searchParams.set("error", reason);
  const response = NextResponse.redirect(url);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const { nonce, returnTo } = parseState(params.get("state"));

  // The student pressed "decline" on the 42 consent screen.
  if (params.get("error")) {
    return failure(request, returnTo, "declined");
  }

  const expected = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!expected || !nonce || expected !== nonce) {
    return failure(request, returnTo, "state");
  }

  const code = params.get("code");
  if (!code) return failure(request, returnTo, "nocode");

  try {
    const user = await completeLogin(code);
    const response = NextResponse.redirect(
      new URL(returnTo, request.nextUrl.origin),
    );

    response.cookies.set(SESSION_COOKIE, encodeSession(user), {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: SESSION_MAX_AGE_S,
    });
    response.cookies.delete(OAUTH_STATE_COOKIE);

    return response;
  } catch (error) {
    console.error("[auth] login failed:", error);
    return failure(request, returnTo, "failed");
  }
}
