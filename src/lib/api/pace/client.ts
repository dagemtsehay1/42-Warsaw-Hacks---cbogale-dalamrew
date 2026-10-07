import { z } from "zod";

const milestoneSchema = z.object({
  id: z.number().int().positive(),
  level: z.number().int().nonnegative(),
  deadline: z.string().nullable(),
  validated_at: z.string().nullable(),
  user_id: z.number().int().positive(),
}).passthrough();

const pageSchema = z.object({
  items: z.array(milestoneSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  size: z.number().int().positive(),
  pages: z.number().int().nonnegative(),
});

export type PaceMilestone = z.infer<typeof milestoneSchema>;

const credentialNames = [
  "OIDC_OP_URL", "OIDC_RP_CLIENT_ID", "OIDC_RP_CLIENT_SECRET",
  "USER_LOGIN", "USER_PASSWORD",
] as const;

export function hasPaceCredentials(): boolean {
  return credentialNames.every((name) => Boolean(process.env[name]?.trim()));
}

async function getToken(): Promise<string> {
  if (!hasPaceCredentials()) throw new Error("Pace API credentials are not configured");
  const base = process.env.OIDC_OP_URL!.trim().replace(/\/+$/, "");
  const basic = Buffer.from(
    `${process.env.OIDC_RP_CLIENT_ID}:${process.env.OIDC_RP_CLIENT_SECRET}`,
  ).toString("base64");
  const response = await fetch(`${base}/realms/staff-42/protocol/openid-connect/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "password",
      username: process.env.USER_LOGIN!,
      password: process.env.USER_PASSWORD!,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  // Never include the response body or credentials in errors or job logs.
  if (!response.ok) throw new Error(`Pace authentication failed (${response.status})`);
  const result = z.object({ access_token: z.string().min(1) }).safeParse(await response.json());
  if (!result.success) throw new Error("Pace authentication returned an invalid token response");
  return result.data.access_token;
}

/** Fetch every page before making any changes to the stored snapshot. */
export async function fetchAllMilestones(): Promise<PaceMilestone[]> {
  let token = await getToken();
  const base = (process.env.PACE_URL?.trim() || "https://pace-system.42.fr/api/v1").replace(/\/+$/, "");
  const items: PaceMilestone[] = [];
  const ids = new Set<number>();
  let expectedTotal: number | undefined;
  let expectedPages: number | undefined;

  for (let page = 1; ; page++) {
    const url = new URL(`${base}/milestones`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("size", "30");
    const request = () => fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    let response = await request();
    if (response.status === 401) {
      token = await getToken();
      response = await request();
    }
    if (!response.ok) throw new Error(`Pace milestones page ${page} failed (${response.status})`);
    const parsed = pageSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error(`Pace milestones page ${page} has an invalid response`);
    const data = parsed.data;
    expectedTotal ??= data.total;
    expectedPages ??= data.pages;
    if (data.page !== page || data.total !== expectedTotal || data.pages !== expectedPages) {
      throw new Error("Pace milestone pagination changed during sync; keeping the previous snapshot");
    }
    for (const item of data.items) {
      if (ids.has(item.id)) throw new Error("Pace milestone pagination returned duplicate records");
      ids.add(item.id);
      items.push(item);
    }
    if (page >= data.pages) break;
    if (data.items.length === 0) throw new Error("Pace milestone pagination ended early");
  }
  if (items.length !== expectedTotal) throw new Error("Pace milestone snapshot is incomplete");
  return items;
}
