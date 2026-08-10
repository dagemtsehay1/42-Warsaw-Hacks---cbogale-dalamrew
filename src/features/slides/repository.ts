import { query } from "@/lib/db/pool";
import type { Slide } from "@/types/campus";

const SELECT = `
  SELECT id::int AS id, title, active, sort_order AS "sortOrder",
         uploaded_by AS "uploadedBy", byte_size AS "byteSize",
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
    FROM slides`;

/** Active slides in rotation order — what the board shows. */
export async function listActiveSlides(): Promise<Slide[]> {
  return query<Slide>(
    `${SELECT} WHERE active ORDER BY sort_order, created_at`,
  );
}

/** Everything, including hidden slides — the admin table. */
export async function listAllSlides(): Promise<Slide[]> {
  return query<Slide>(`${SELECT} ORDER BY sort_order, created_at`);
}

export async function readSlideImage(
  id: number,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const rows = await query<{ bytes: Buffer; content_type: string }>(
    "SELECT bytes, content_type FROM slides WHERE id = $1 AND active",
    [id],
  );
  const row = rows[0];
  return row ? { bytes: row.bytes, contentType: row.content_type } : null;
}

export async function createSlide(input: {
  title: string;
  contentType: string;
  bytes: Buffer;
  uploadedBy: string;
}): Promise<void> {
  await query(
    `INSERT INTO slides (title, content_type, bytes, byte_size, uploaded_by, sort_order)
     VALUES ($1, $2, $3, $4, $5,
             COALESCE((SELECT max(sort_order) + 1 FROM slides), 0))`,
    [
      input.title,
      input.contentType,
      input.bytes,
      input.bytes.byteLength,
      input.uploadedBy,
    ],
  );
}

export async function setSlideActive(id: number, active: boolean) {
  await query("UPDATE slides SET active = $2 WHERE id = $1", [id, active]);
}

export async function deleteSlide(id: number) {
  await query("DELETE FROM slides WHERE id = $1", [id]);
}
