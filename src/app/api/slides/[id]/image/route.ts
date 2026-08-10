import { NextResponse } from "next/server";
import { readSlideImage } from "@/features/slides/repository";
import { hasDatabase, migrate } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

/**
 * Serves a slide's bytes. Only active slides resolve, so hiding a slide in the
 * admin page also takes its URL out of circulation.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasDatabase()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  await migrate();
  const slide = await readSlideImage(id);
  if (!slide) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(slide.bytes), {
    headers: {
      "Content-Type": slide.contentType,
      "Content-Length": String(slide.bytes.byteLength),
      // Bytes never change for a given id — a replacement gets a new row — so
      // the TV can hold onto it and the board costs one fetch per slide, ever.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
