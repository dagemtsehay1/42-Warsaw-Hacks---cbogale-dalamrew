import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/lib/api/42/oauth";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * POST only: a GET logout would let any image tag on any page sign a student
 * out, and on a shared phone that is a real annoyance.
 */
export async function POST(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/teammate";
  const response = NextResponse.redirect(
    // Same reason as the callback: behind Docker the request's own origin is
    // the container's localhost:3000.
    await publicUrl(returnTo, request.nextUrl.origin),
  );
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
