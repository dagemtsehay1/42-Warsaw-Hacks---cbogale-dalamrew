import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAllMilestones } from "@/lib/api/pace/client";
import { hasDatabase, query } from "@/lib/db/pool";
import { emptyMilestoneDistribution, readMilestoneDistribution, runMilestoneSync } from "./milestones";

const { clientQuery } = vi.hoisted(() => ({ clientQuery: vi.fn() }));
vi.mock("@/lib/api/pace/client", () => ({ fetchAllMilestones: vi.fn() }));
vi.mock("@/lib/db/pool", () => ({
  hasDatabase: vi.fn(), query: vi.fn(),
  withClient: async (fn: (client: unknown) => Promise<unknown>) => fn({ query: clientQuery }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CAMPUS_TIMEZONE", "Europe/Warsaw");
  vi.mocked(hasDatabase).mockReturnValue(true);
  clientQuery.mockResolvedValue({ rows: [] });
});
afterEach(() => vi.unstubAllEnvs());

describe("stored milestones", () => {
  it("keeps all seven milestones, including zero counts", async () => {
    vi.mocked(query).mockResolvedValue([{ milestone: 1, student_count: 2 }, { milestone: 6, student_count: 1 }]);
    const bands = await readMilestoneDistribution();
    expect(bands.map((band) => band.studentCount)).toEqual([0, 2, 0, 0, 0, 0, 1]);
    expect(emptyMilestoneDistribution().map((band) => band.label)).toEqual(
      Array.from({ length: 7 }, (_, n) => `Milestone ${n}`),
    );
  });

  it("stores all raw records and the campus-local day in one transaction", async () => {
    const items = [0, 1, 2].map((level) => ({ id: level + 1, user_id: 1, level, deadline: null, validated_at: null }));
    vi.mocked(fetchAllMilestones).mockResolvedValue(items);
    const result = await runMilestoneSync(new Date("2026-10-07T22:01:00Z"));
    expect(result).toEqual({ syncedFor: "2026-10-08", records: 3, students: 1 });
    expect(clientQuery.mock.calls[0][0]).toBe("BEGIN");
    expect(clientQuery.mock.calls[2][1]).toEqual([JSON.stringify(items)]);
    expect(clientQuery.mock.calls[3][1]).toEqual(["2026-10-08"]);
    expect(clientQuery).toHaveBeenLastCalledWith("COMMIT");
  });

  it("does not touch the stored snapshot if fetching fails", async () => {
    vi.mocked(fetchAllMilestones).mockRejectedValue(new Error("page failed"));
    await expect(runMilestoneSync()).rejects.toThrow("page failed");
    expect(clientQuery).not.toHaveBeenCalled();
  });

  it("rolls back the replacement if writing fails", async () => {
    vi.mocked(fetchAllMilestones).mockResolvedValue([]);
    clientQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("database write failed"));
    await expect(runMilestoneSync()).rejects.toThrow("database write failed");
    expect(clientQuery).toHaveBeenLastCalledWith("ROLLBACK");
    expect(clientQuery.mock.calls.some(([sql]) => sql === "COMMIT")).toBe(false);
  });
});
