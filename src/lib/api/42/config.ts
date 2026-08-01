export class FortyTwoApiError extends Error {
  status: number;
  code?: string;
  retryAfterMs?: number;

  constructor(
    message: string,
    status: number,
    options?: { code?: string; retryAfterMs?: number },
  ) {
    super(message);
    this.name = "FortyTwoApiError";
    this.status = status;
    this.code = options?.code;
    this.retryAfterMs = options?.retryAfterMs;
  }

  get isRateLimited() {
    return this.status === 429;
  }

  get isUnauthorized() {
    return this.status === 401;
  }
}

function getEnv(name: string, fallback?: string): string {
  const raw = process.env[name] ?? fallback;
  const value = raw?.trim().replace(/^["']|["']$/g, "");
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getApiBaseUrl(): string {
  return (
    process.env.FORTYTWO_API_BASE_URL?.replace(/\/$/, "") ??
    "https://api.intra.42.fr"
  );
}

export function getAppCredentials() {
  return {
    clientId: getEnv("FORTYTWO_CLIENT_ID"),
    clientSecret: getEnv("FORTYTWO_CLIENT_SECRET"),
    apiBaseUrl: getApiBaseUrl(),
  };
}

export function getOptionalCampusId(): number | null {
  const raw = process.env.FORTYTWO_CAMPUS_ID;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

export function getDefaultCursusId(): number {
  const raw = process.env.FORTYTWO_CURSUS_ID;
  if (!raw) return 21;
  const id = Number(raw);
  return Number.isFinite(id) ? id : 21;
}

export function hasFortyTwoCredentials(): boolean {
  const id = process.env.FORTYTWO_CLIENT_ID?.trim().replace(/^["']|["']$/g, "");
  const secret = process.env.FORTYTWO_CLIENT_SECRET?.trim().replace(
    /^["']|["']$/g,
    "",
  );
  return Boolean(id && secret);
}
