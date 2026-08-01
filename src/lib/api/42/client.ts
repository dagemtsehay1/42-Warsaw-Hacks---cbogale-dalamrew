import { clearAppTokenCache, getAppAccessToken } from "./auth";
import { FortyTwoApiError, getApiBaseUrl } from "./config";

export type FetchOptions = {
  accessToken?: string;
  searchParams?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  retries?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(
  path: string,
  searchParams?: FetchOptions["searchParams"],
): string {
  const base = getApiBaseUrl();
  const url = new URL(path.startsWith("http") ? path : `${base}${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseError(response: Response): Promise<FortyTwoApiError> {
  const retryAfter = response.headers.get("Retry-After");
  const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : undefined;
  let message = response.statusText;
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    message = body.message || body.error || message;
  } catch {
    // ignore
  }
  return new FortyTwoApiError(message || "42 API error", response.status, {
    code: response.status === 429 ? "rate_limited" : undefined,
    retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
  });
}

export async function fortyTwoFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  let token = options.accessToken ?? (await getAppAccessToken());
  let attempt = 0;

  while (true) {
    const response = await fetch(buildUrl(path, options.searchParams), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: options.signal,
      cache: "no-store",
    });

    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    }

    const error = await parseError(response);

    if (error.isUnauthorized && !options.accessToken && attempt < retries) {
      clearAppTokenCache();
      token = await getAppAccessToken();
      attempt += 1;
      continue;
    }

    if (error.isRateLimited && attempt < retries) {
      await sleep(error.retryAfterMs ?? 1000 * (attempt + 1));
      attempt += 1;
      continue;
    }

    if (response.status >= 500 && attempt < retries) {
      await sleep(500 * (attempt + 1));
      attempt += 1;
      continue;
    }

    throw error;
  }
}

export type PaginatedOptions<T = unknown> = FetchOptions & {
  pageSize?: number;
  maxPages?: number;
  delayMs?: number;
  /**
   * Called after each page with everything fetched so far. Return true to stop
   * early — useful when the caller only needs to reach a point in the results
   * and paging the rest would waste the rate budget.
   */
  stopWhen?: (accumulated: T[]) => boolean;
};

export async function fortyTwoFetchAllPages<T>(
  path: string,
  options: PaginatedOptions<T> = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 20;
  const delayMs = options.delayMs ?? 550;
  const results: T[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await fortyTwoFetch<T[]>(path, {
      ...options,
      searchParams: {
        ...options.searchParams,
        "page[number]": page,
        "page[size]": pageSize,
      },
    });

    results.push(...batch);
    if (batch.length < pageSize) break;
    if (options.stopWhen?.(results)) break;
    if (page < maxPages) await sleep(delayMs);
  }

  return results;
}
