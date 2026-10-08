import { z } from "zod";
import { getPaceConfig } from "./config";

const milestoneSchema = z.object({
  id: z.number().int().positive(),
  level: z.number().int().nonnegative(),
  deadline: z.iso.date().nullable(),
  validated_at: z.iso.date().nullable(),
  user_id: z.number().int().positive(),
}).passthrough();

export type PaceMilestone = z.infer<typeof milestoneSchema>;

const pageSchema = z.object({
  items: z.array(milestoneSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  size: z.number().int().positive(),
  pages: z.number().int().nonnegative(),
});

let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenPromise: Promise<string> | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async () => {
    const config = getPaceConfig();
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "password",
        username: config.username,
        password: config.password,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    // Never include response bodies or credentials in job logs.
    if (!response.ok) throw new Error(`Pace token request failed (HTTP ${response.status})`);
    const token = z.object({
      access_token: z.string().min(1),
      expires_in: z.number().positive().optional(),
    }).safeParse(await response.json());
    if (!token.success) throw new Error("Invalid Pace token response");
    cachedToken = {
      value: token.data.access_token,
      expiresAt: Date.now() + (token.data.expires_in ?? 60) * 1000,
    };
    return cachedToken.value;
  })();
  try {
    return await tokenPromise;
  } finally {
    tokenPromise = null;
  }
}

async function fetchPage(page: number) {
  const url = new URL(`${getPaceConfig().baseUrl}/milestones`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", "100");
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${await accessToken()}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (response.ok) {
      const result = pageSchema.safeParse(await response.json());
      if (!result.success) throw new Error(`Invalid Pace milestones page ${page}`);
      return result.data;
    }
    if (attempt < 2) {
      if (response.status === 401) {
        cachedToken = null;
        continue;
      }
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delay = retryAfter > 0 ? Math.min(retryAfter * 1000, 60_000) : 1000 * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
    throw new Error(`Pace milestones page ${page} failed (HTTP ${response.status})`);
  }
}

/** Follow the API's pagination metadata, with no arbitrary page limit. */
export async function fetchAllMilestones(): Promise<PaceMilestone[]> {
  const items: PaceMilestone[] = [];
  const ids = new Set<number>();
  let first: Awaited<ReturnType<typeof fetchPage>> | undefined;
  for (let page = 1; ; page++) {
    const batch = await fetchPage(page);
    first ??= batch;
    if (batch.page !== page || batch.total !== first.total || batch.pages !== first.pages || batch.size !== first.size) {
      throw new Error("Pace pagination changed during sync; retrying on the next tick");
    }
    if (batch.pages !== Math.ceil(batch.total / batch.size) && !(batch.total === 0 && batch.pages === 1)) {
      throw new Error("Inconsistent Pace pagination metadata");
    }
    for (const item of batch.items) {
      if (ids.has(item.id)) throw new Error("Duplicate Pace milestone across pages");
      ids.add(item.id);
      items.push(item);
    }
    if (page >= batch.pages) break;
    if (batch.items.length === 0) throw new Error("Empty Pace page before the last page");
  }
  if (items.length !== first!.total) throw new Error("Incomplete Pace milestone response");
  return items;
}
