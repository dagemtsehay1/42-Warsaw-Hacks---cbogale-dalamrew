import { NextResponse } from "next/server";
import { hasDatabase, migrate } from "@/lib/db/pool";
import { listTeammateRequests } from "@/features/teammates/repository";

export const dynamic = "force-dynamic";

/**
 * Polled by `TeammateLiveUpdates` so a listing added or removed on `/teammate`
 * reaches every board that's already open, not just the phone that made the
 * change — a server action's `revalidatePath` only ever affects the request
 * that called it, never a different browser sitting on the wall.
 *
 * Returns exactly what the board itself renders (same query, same TTL and row
 * cap), so a toast never announces something the list disagrees with a moment
 * later.
 */
export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json(
      { requests: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  await migrate();
  const requests = await listTeammateRequests();

  return NextResponse.json(
    { requests },
    { headers: { "Cache-Control": "no-store" } },
  );
}
