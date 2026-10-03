import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasDatabase, migrate, query } from "@/lib/db/pool";
import { readTheme, saveTheme } from "./repository";

vi.mock("@/lib/db/pool", () => ({
  hasDatabase: vi.fn(), migrate: vi.fn(), query: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(hasDatabase).mockReturnValue(true);
  vi.mocked(query).mockResolvedValue([]);
});

describe("saved dashboard theme", () => {
  it("uses Default without a database or a saved row", async () => {
    vi.mocked(hasDatabase).mockReturnValue(false);
    expect(await readTheme()).toBe("default");
    expect(query).not.toHaveBeenCalled();
    vi.mocked(hasDatabase).mockReturnValue(true);
    expect(await readTheme()).toBe("default");
  });

  it("reads the persisted choice on each load", async () => {
    vi.mocked(query).mockResolvedValueOnce([{ theme: "sunset" }]);
    expect(await readTheme()).toBe("sunset");
    vi.mocked(query).mockResolvedValueOnce([{ theme: "emerald" }]);
    expect(await readTheme()).toBe("emerald");
  });

  it("falls back to Default for an unknown saved theme", async () => {
    vi.mocked(query).mockResolvedValue([{ theme: "unknown" }]);
    expect(await readTheme()).toBe("default");
  });

  it("saves a shared choice, including switching back to Default", async () => {
    await saveTheme("ocean-violet");
    expect(migrate).toHaveBeenCalled();
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("ON CONFLICT (id) DO UPDATE"), ["ocean-violet"]);
    await saveTheme("default");
    expect(query).toHaveBeenLastCalledWith(expect.any(String), ["default"]);
  });
});
