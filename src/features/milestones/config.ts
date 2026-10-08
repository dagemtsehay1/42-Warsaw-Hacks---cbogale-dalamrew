const REQUIRED = [
  "OIDC_OP_URL",
  "OIDC_RP_CLIENT_ID",
  "OIDC_RP_CLIENT_SECRET",
  "USER_LOGIN",
  "USER_PASSWORD",
] as const;

export function hasPaceCredentials(): boolean {
  return REQUIRED.every((name) => Boolean(process.env[name]?.trim()));
}

export function getPaceConfig() {
  for (const name of REQUIRED) {
    if (!process.env[name]?.trim()) throw new Error(`Missing environment variable: ${name}`);
  }
  return {
    tokenUrl: `${process.env.OIDC_OP_URL!.trim().replace(/\/+$/, "")}/realms/staff-42/protocol/openid-connect/token`,
    clientId: process.env.OIDC_RP_CLIENT_ID!,
    clientSecret: process.env.OIDC_RP_CLIENT_SECRET!,
    username: process.env.USER_LOGIN!,
    password: process.env.USER_PASSWORD!,
    baseUrl: (process.env.PACE_URL?.trim() || "https://pace-system.42.fr/api/v1").replace(/\/+$/, ""),
  };
}
