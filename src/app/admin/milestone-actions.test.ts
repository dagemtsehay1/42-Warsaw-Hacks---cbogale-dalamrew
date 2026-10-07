import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentStaff } from "@/lib/auth/current-user";
import { saveMilestoneSettings, MilestoneValidationError } from "@/features/milestones/repository";
import { createPath } from "@/features/milestones/config";
import { updateMilestones } from "./milestone-actions";

vi.mock("@/lib/auth/current-user", () => ({ currentStaff: vi.fn() }));
vi.mock("@/features/milestones/repository", () => ({ saveMilestoneSettings: vi.fn(), MilestoneValidationError: class extends Error {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

describe("milestone admin action", () => {
  it("rejects unauthorized writes", async () => {
    vi.mocked(currentStaff).mockResolvedValue(null);
    expect(await updateMilestones([], 1)).toEqual({ error: "Not authorised." });
    expect(saveMilestoneSettings).not.toHaveBeenCalled();
  });

  it("saves for staff and exposes actionable validation errors", async () => {
    vi.mocked(currentStaff).mockResolvedValue({ id: 1, login: "staff", displayName: "Staff", isStaff: true });
    const paths = [createPath("old", "Old")];
    vi.mocked(saveMilestoneSettings).mockResolvedValueOnce(2);
    expect(await updateMilestones(paths, 1)).toEqual({ version: 2 });
    expect(saveMilestoneSettings).toHaveBeenCalledWith(paths, 1);
    vi.mocked(saveMilestoneSettings).mockRejectedValueOnce(new MilestoneValidationError("Keep at least one path."));
    expect(await updateMilestones([], 2)).toEqual({ error: "Keep at least one path." });
  });
});
