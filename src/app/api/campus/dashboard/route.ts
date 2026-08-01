import { NextResponse } from "next/server";
import { readDashboardView } from "@/features/campus/dashboard-repository";

export const dynamic = "force-dynamic";

/**
 * The board itself is server-rendered, so this route exists for everything
 * *else* that wants the campus data (a kiosk script, monitoring, a second
 * screen). It reads the stored snapshot — never the 42 API — so it answers in
 * milliseconds and keeps answering while the 42 API is down.
 */
export async function GET() {
  try {
    const view = await readDashboardView();
    return NextResponse.json(view, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read dashboard";
    return NextResponse.json(
      { error: message, code: "dashboard_error" },
      { status: 500 },
    );
  }
}
