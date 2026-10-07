import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAllMilestones } from "./client";

const fetchMock = vi.fn<typeof fetch>();
const record = (id: number, level = 0) => ({
  id, user_id: 263881, level, deadline: "2026-08-18", validated_at: null,
});
const page = (number: number, items = [record(number)]) => Response.json({
  items, total: 3, page: number, size: 1, pages: 3,
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.stubEnv("OIDC_OP_URL", "https://auth.example.test/");
  vi.stubEnv("OIDC_RP_CLIENT_ID", "client");
  vi.stubEnv("OIDC_RP_CLIENT_SECRET", "secret");
  vi.stubEnv("USER_LOGIN", "staff");
  vi.stubEnv("USER_PASSWORD", "password");
  vi.stubEnv("PACE_URL", "https://pace.example.test/api/v1/");
  fetchMock.mockResolvedValueOnce(Response.json({ access_token: "token" }));
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Pace milestone fetch", () => {
  it("uses the supplied Keycloak flow and fetches all pages, preserving every milestone", async () => {
    fetchMock.mockResolvedValueOnce(page(1, [record(1, 0)]))
      .mockResolvedValueOnce(page(2, [record(2, 1)]))
      .mockResolvedValueOnce(page(3, [record(3, 2)]));
    expect((await fetchAllMilestones()).map((item) => item.level)).toEqual([0, 1, 2]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://auth.example.test/realms/staff-42/protocol/openid-connect/token");
    expect(options?.headers).toMatchObject({ Authorization: `Basic ${Buffer.from("client:secret").toString("base64")}` });
    expect(options?.body?.toString()).toBe("grant_type=password&username=staff&password=password");
    expect(fetchMock.mock.calls.slice(1).map(([url]) => new URL(String(url)).searchParams.get("page"))).toEqual(["1", "2", "3"]);
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual({ Authorization: "Bearer token" });
  });

  it("accepts a complete empty snapshot", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ items: [], total: 0, page: 1, size: 30, pages: 0 }));
    expect(await fetchAllMilestones()).toEqual([]);
  });

  it("rejects a failed later page", async () => {
    fetchMock.mockResolvedValueOnce(page(1)).mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(fetchAllMilestones()).rejects.toThrow("page 2 failed (503)");
  });

  it("rejects duplicate records across pages", async () => {
    fetchMock.mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(2, [record(1)]));
    await expect(fetchAllMilestones()).rejects.toThrow("duplicate records");
  });

  it("rejects a server that repeats page 1", async () => {
    fetchMock.mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(1));
    await expect(fetchAllMilestones()).rejects.toThrow("pagination changed");
  });

  it("rejects totals that do not match the fetched records", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ items: [record(1)], total: 2, page: 1, size: 30, pages: 1 }));
    await expect(fetchAllMilestones()).rejects.toThrow("incomplete");
  });

  it("refreshes an expired token and retries the same page", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ access_token: "renewed" }))
      .mockResolvedValueOnce(Response.json({ items: [record(1)], total: 1, page: 1, size: 30, pages: 1 }));
    expect(await fetchAllMilestones()).toHaveLength(1);
    expect(fetchMock.mock.calls[3][1]?.headers).toEqual({ Authorization: "Bearer renewed" });
    expect(String(fetchMock.mock.calls[3][0])).toBe(String(fetchMock.mock.calls[1][0]));
  });

  it("does not expose authentication response bodies in errors", async () => {
    fetchMock.mockReset().mockResolvedValueOnce(new Response("sensitive server response", { status: 400 }));
    await expect(fetchAllMilestones()).rejects.toThrow(/^Pace authentication failed \(400\)$/);
  });
});
