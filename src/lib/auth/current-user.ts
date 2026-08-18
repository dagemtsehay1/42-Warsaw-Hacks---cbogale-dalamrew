import { cookies } from "next/headers";
import { decodeSession, SESSION_COOKIE, type SessionUser } from "./session";

/** The signed-in user for the current request, or null. */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

/**
 * True when `APP_MODE=development`. Relaxes the admin page to any signed-in
 * 42 user instead of requiring `staff?`, for testing off-campus without a
 * bocal account. Anything else — unset, `production`, a typo — fails secure
 * and keeps the staff-only gate; the Docker image ships `APP_MODE=production`.
 */
export function isDevMode(): boolean {
  return process.env.APP_MODE?.trim().toLowerCase() === "development";
}

/** The signed-in user, but only if they are bocal (or anyone, in dev mode). */
export async function currentStaff(): Promise<SessionUser | null> {
  const user = await currentUser();
  if (!user) return null;
  return user.isStaff || isDevMode() ? user : null;
}
