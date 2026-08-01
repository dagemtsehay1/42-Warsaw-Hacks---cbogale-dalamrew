import { NextResponse } from "next/server";
import { buildDashboardPayload } from "@/features/campus/dashboard-service";
import { FortyTwoApiError } from "@/lib/api/42/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await buildDashboardPayload();
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    const status =
      error instanceof FortyTwoApiError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "Failed to build dashboard";
    return NextResponse.json(
      {
        error: message,
        code: error instanceof FortyTwoApiError ? error.code : "dashboard_error",
      },
      { status: status === 429 ? 429 : status >= 400 && status < 600 ? status : 500 },
    );
  }
}
