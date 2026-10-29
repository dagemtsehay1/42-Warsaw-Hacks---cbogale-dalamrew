import { NextResponse } from "next/server";
import { getAppAccessToken } from "@/lib/api/42/auth";

const IMAGE_HOSTNAME = "cdn.intra.42.fr";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const imageUrl = new URL(request.url).searchParams.get("url");
  if (!imageUrl) {
    return NextResponse.json({ error: "Missing image URL" }, { status: 400 });
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(imageUrl);
  } catch {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  if (upstreamUrl.protocol !== "https:" || upstreamUrl.hostname !== IMAGE_HOSTNAME) {
    return NextResponse.json({ error: "Unsupported image URL" }, { status: 400 });
  }

  try {
    const token = await getAppAccessToken();
    const response = await fetch(upstreamUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Image request failed: ${response.statusText}` },
        { status: response.status },
      );
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[42-image] could not load profile image:", error);
    return NextResponse.json(
      { error: "Could not load profile image" },
      { status: 502 },
    );
  }
}
