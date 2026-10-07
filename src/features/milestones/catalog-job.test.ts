import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fortyTwoFetchAllPages } from "@/lib/api/42/client";
import { withClient } from "@/lib/db/pool";
import { runProjectCatalogJob } from "./catalog-job";

vi.mock("@/lib/api/42/client", () => ({ fortyTwoFetchAllPages: vi.fn() }));
vi.mock("@/lib/db/pool", () => ({ withClient: vi.fn() }));
const dbQuery = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  dbQuery.mockResolvedValue({ rows: [] });
  vi.mocked(withClient).mockImplementation(async (fn) => fn({ query: dbQuery } as unknown as PoolClient));
});

describe("project catalog sync", () => {
  it("fetches the entire catalog and commits an atomic refresh", async () => {
    const project = { id: 1, name: "libft", slug: "libft", difficulty: 70, cursus: [{ id: 21 }], future_field: { nested: true } };
    vi.mocked(fortyTwoFetchAllPages).mockResolvedValue([project]);
    expect(await runProjectCatalogJob()).toEqual({ projects: 1 });
    expect(fortyTwoFetchAllPages).toHaveBeenCalledWith("/v2/projects", expect.objectContaining({ maxPages: Infinity }));
    expect(dbQuery).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(dbQuery).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO project_catalog"), [JSON.stringify([project])]);
    expect(dbQuery).toHaveBeenLastCalledWith("COMMIT");
  });

  it("preserves the old catalog on API failures or empty/invalid responses", async () => {
    vi.mocked(fortyTwoFetchAllPages).mockRejectedValueOnce(new Error("42 unavailable"));
    await expect(runProjectCatalogJob()).rejects.toThrow("42 unavailable");
    vi.mocked(fortyTwoFetchAllPages).mockResolvedValueOnce([]);
    await expect(runProjectCatalogJob()).rejects.toThrow();
    vi.mocked(fortyTwoFetchAllPages).mockResolvedValueOnce([{ id: "bad" }]);
    await expect(runProjectCatalogJob()).rejects.toThrow();
    expect(withClient).not.toHaveBeenCalled();
  });

  it("rolls back if database persistence fails", async () => {
    vi.mocked(fortyTwoFetchAllPages).mockResolvedValue([{ id: 1, name: "libft", slug: "libft" }]);
    dbQuery.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error("DB failure"));
    await expect(runProjectCatalogJob()).rejects.toThrow("DB failure");
    expect(dbQuery).toHaveBeenLastCalledWith("ROLLBACK");
    expect(dbQuery).not.toHaveBeenCalledWith("COMMIT");
  });
});
