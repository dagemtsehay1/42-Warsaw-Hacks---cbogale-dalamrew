import { cookies } from "next/headers";
import { decodeSession, SESSION_COOKIE, type SessionUser } from "./session";

/** The signed-in user for the current request, or null. */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

/** The signed-in user, but only if they are bocal. */
export async function currentStaff(): Promise<SessionUser | null> {
  const user = await currentUser();
  return user?.isStaff ? user : null;
}
