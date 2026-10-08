import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn<typeof fetch>();
const milestone = (id: number) => ({ id, user_id: 12, level: id - 1, deadline: "2026-07-02", validated_at: null });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const page = (number: number, overrides = {}) => ({ items: [milestone(number)], total: 3, page: number, size: 1, pages: 3, ...overrides });

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("OIDC_OP_URL", "https://auth.example.test/");
  vi.stubEnv("OIDC_RP_CLIENT_ID", "client");
  vi.stubEnv("OIDC_RP_CLIENT_SECRET", "secret");
  vi.stubEnv("USER_LOGIN", "staff");
  vi.stubEnv("USER_PASSWORD", "password");
  vi.stubEnv("PACE_URL", "https://pace.example.test/api/v1/");
  fetchMock.mockResolvedValueOnce(json({ access_token: "token", expires_in: 3600 }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("Pace milestone client", () => {
  it("uses the supplied Keycloak grant and fetches all pages even when the server caps page size", async () => {
    for (let n = 1; n <= 3; n++) fetchMock.mockResolvedValueOnce(json(page(n)));
    const { fetchAllMilestones } = await import("./client");
    expect(await fetchAllMilestones()).toEqual([milestone(1), milestone(2), milestone(3)]);
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe("https://auth.example.test/realms/staff-42/protocol/openid-connect/token");
    expect(tokenInit?.headers).toMatchObject({ Authorization: `Basic ${Buffer.from("client:secret").toString("base64")}` });
    expect(Object.fromEntries(tokenInit?.body as URLSearchParams)).toEqual({ grant_type: "password", username: "staff", password: "password" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (let n = 1; n <= 3; n++) {
      const [url, init] = fetchMock.mock.calls[n];
      expect(String(url)).toBe(`https://pace.example.test/api/v1/milestones?page=${n}&size=100`);
      expect(init?.headers).toMatchObject({ Authorization: "Bearer token" });
    }
  });

  it("has no 20-page cap", async () => {
    for (let n = 1; n <= 48; n++) fetchMock.mockResolvedValueOnce(json(page(n, { total: 48, pages: 48 })));
    const { fetchAllMilestones } = await import("./client");
    expect(await fetchAllMilestones()).toHaveLength(48);
    expect(fetchMock).toHaveBeenCalledTimes(49);
  });

  it.each([0, 1])("accepts a successful empty feed with %i pages", async (pages) => {
    fetchMock.mockResolvedValueOnce(json(page(1, { total: 0, pages, items: [] })));
    const { fetchAllMilestones } = await import("./client");
    expect(await fetchAllMilestones()).toEqual([]);
  });

  it.each([
    ["failed page", () => json({}, 403)],
    ["repeated page", () => json(page(1))],
    ["changed total", () => json(page(2, { total: 4, pages: 4 }))],
    ["duplicate record", () => json(page(2, { items: [milestone(1)] }))],
    ["empty middle page", () => json(page(2, { items: [] }))],
    ["invalid record", () => json(page(2, { items: [{ ...milestone(2), level: -1 }] }))],
  ])("rejects the entire fetch on %s", async (_name, response) => {
    fetchMock.mockResolvedValueOnce(json(page(1))).mockResolvedValueOnce(response());
    const { fetchAllMilestones } = await import("./client");
    await expect(fetchAllMilestones()).rejects.toThrow();
  });

  it("rejects missing records on the final page", async () => {
    fetchMock.mockResolvedValueOnce(json(page(1))).mockResolvedValueOnce(json(page(2))).mockResolvedValueOnce(json(page(3, { items: [] })));
    const { fetchAllMilestones } = await import("./client");
    await expect(fetchAllMilestones()).rejects.toThrow("Incomplete");
  });

  it("refreshes an expired token and retries the same page", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ access_token: "new-token", expires_in: 3600 }))
      .mockResolvedValueOnce(json(page(1, { pages: 1, total: 1 })));
    const { fetchAllMilestones } = await import("./client");
    expect(await fetchAllMilestones()).toEqual([milestone(1)]);
    expect(fetchMock.mock.calls[3][1]?.headers).toMatchObject({ Authorization: "Bearer new-token" });
  });

  it.each([429, 503])("retries transient HTTP %i", async (status) => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(json({}, status)).mockResolvedValueOnce(json(page(1, { pages: 1, total: 1 })));
    const { fetchAllMilestones } = await import("./client");
    const pending = fetchAllMilestones();
    await vi.runAllTimersAsync();
    expect(await pending).toEqual([milestone(1)]);
  });

  it("does not expose credentials or token response bodies in errors", async () => {
    fetchMock.mockReset().mockResolvedValueOnce(json({ error_description: "password secret" }, 401));
    const { fetchAllMilestones } = await import("./client");
    await expect(fetchAllMilestones()).rejects.toThrow(/^Pace token request failed \(HTTP 401\)$/);
  });
});
