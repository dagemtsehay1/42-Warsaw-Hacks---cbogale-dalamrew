import { NextResponse, type NextRequest } from "next/server";
import { completeLogin, parseState, publicUrl } from "@/lib/api/42/oauth";
import {
  encodeSession,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

async function failure(
  request: NextRequest,
  returnTo: string,
  reason: string,
) {
  const url = await publicUrl(returnTo, request.nextUrl.origin);
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
    return await failure(request, returnTo, "declined");
  }

  const expected = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!expected || !nonce || expected !== nonce) {
    return await failure(request, returnTo, "state");
  }

  const code = params.get("code");
  if (!code) return await failure(request, returnTo, "nocode");

  try {
    const user = await completeLogin(code);
    // The public origin, not the request's: 42 calls us back on the address the
    // phone used, but behind Docker that arrives as the container's own
    // localhost:3000 and would bounce the student somewhere unreachable.
    const response = NextResponse.redirect(
      await publicUrl(returnTo, request.nextUrl.origin),
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
    return await failure(request, returnTo, "failed");
  }
}
