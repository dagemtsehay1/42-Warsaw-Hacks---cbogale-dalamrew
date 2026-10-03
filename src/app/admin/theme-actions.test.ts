import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentStaff } from "@/lib/auth/current-user";
import { saveTheme } from "@/features/themes/repository";
import { revalidatePath } from "next/cache";
import { updateTheme } from "./actions";

vi.mock("@/lib/auth/current-user", () => ({ currentStaff: vi.fn() }));
vi.mock("@/features/themes/repository", () => ({ saveTheme: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

function form(theme: string) {
  const data = new FormData();
  data.set("theme", theme);
  return data;
}

describe("admin theme action", () => {
  it("does not let an unauthorized user save a theme", async () => {
    vi.mocked(currentStaff).mockResolvedValue(null);
    expect(await updateTheme({}, form("sunset"))).toEqual({ error: "Not authorised." });
    expect(saveTheme).not.toHaveBeenCalled();
  });

  it("rejects unknown themes and persists valid selections for all pages", async () => {
    vi.mocked(currentStaff).mockResolvedValue({ id: 1, login: "staff", displayName: "Staff", isStaff: true });
    expect(await updateTheme({}, form("invalid"))).toEqual({ error: "Choose a valid theme." });
    expect(saveTheme).not.toHaveBeenCalled();
    expect(await updateTheme({}, form("sunset"))).toEqual({ ok: true });
    expect(saveTheme).toHaveBeenCalledWith("sunset");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});
