// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createPath } from "@/features/milestones/config";
import { updateMilestones } from "./milestone-actions";
import { MilestoneSettings } from "./milestone-settings";

vi.mock("./milestone-actions", () => ({ updateMilestones: vi.fn() }));
const projects = ["libft", "ft_printf", "get_next_line", "Born2beroot", "Agentsmith", "tree_nity"].map((name, index) => ({
  id: index + 1, name, slug: name.toLowerCase(), available: true,
}));

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

function editor() {
  return render(createElement(MilestoneSettings, {
    initial: { paths: [createPath("old", "Old common core")], version: 1 }, projects,
    syncedAt: "2026-10-07T10:00:00.000Z",
  }));
}

function choose(label: string, project: string) {
  const milestone = screen.getByRole("button", { name: label.match(/^Milestone \d+/)![0] });
  if (milestone.getAttribute("aria-expanded") === "false") fireEvent.click(milestone);
  const input = screen.getByRole("combobox", { name: label });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: project } });
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.blur(input);
}

describe("milestone editor", () => {
  it("collapses milestone editors without losing selections and previews the selected projects", () => {
    editor();
    choose("Milestone 0 required projects", "libft");
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryByRole("combobox", { name: "Milestone 0 required projects" })).toBeNull();
    expect(screen.getByRole("button", { name: "Milestone 0" }).textContent).toContain("libft");
    fireEvent.click(screen.getByRole("button", { name: "Milestone 0" }));
    expect(screen.getByRole("button", { name: "Remove libft from Milestone 0 required projects" })).toBeTruthy();
  });
  it("hides assigned tags across milestones and restores removed projects", () => {
    editor();
    expect(screen.getByRole("button", { name: "Delete Old common core path" }).hasAttribute("disabled")).toBe(true);
    choose("Milestone 0 required projects", "libft");
    fireEvent.click(screen.getByRole("button", { name: "Milestone 1" }));
    const next = screen.getByRole("combobox", { name: "Milestone 1 required projects" });
    fireEvent.focus(next);
    fireEvent.change(next, { target: { value: "libft" } });
    expect(screen.queryByRole("option", { name: /libft/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove libft from Milestone 0 required projects" }));
    expect(screen.getByRole("option", { name: /libft/ })).toBeTruthy();
  });

  it("saves required projects, alternatives, and independent paths", async () => {
    editor();
    choose("Milestone 0 required projects", "libft");
    for (const name of ["ft_printf", "get_next_line", "Born2beroot"]) choose("Milestone 1 required projects", name);
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Add choose-one group" })[5]);
    choose("Milestone 5 group 1 alternatives", "Agentsmith");
    fireEvent.click(screen.getByRole("button", { name: "Save milestone settings" }));
    expect(screen.getByRole("alert").textContent).toContain("at least two");
    expect(updateMilestones).not.toHaveBeenCalled();
    choose("Milestone 5 group 1 alternatives", "tree_nity");
    fireEvent.click(screen.getByRole("button", { name: "Add path" }));
    fireEvent.change(screen.getByLabelText("Path name"), { target: { value: "New common core" } });
    choose("Milestone 0 required projects", "libft");
    vi.mocked(updateMilestones).mockResolvedValue({ version: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Save milestone settings" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Milestone settings saved."));
    const [paths, version] = vi.mocked(updateMilestones).mock.calls[0];
    expect(version).toBe(1);
    expect(paths).toMatchObject([
      { name: "Old common core", milestones: [
        { required: [1] }, { required: [2, 3, 4] }, {}, {}, {}, { alternatives: [[5, 6]] }, {},
      ] },
      { name: "New common core", milestones: [{ required: [1] }, {}, {}, {}, {}, {}, {}] },
    ]);
    fireEvent.change(screen.getByLabelText("Path name"), { target: { value: "Newer common core" } });
    fireEvent.click(screen.getByRole("button", { name: "Save milestone settings" }));
    await waitFor(() => expect(updateMilestones).toHaveBeenLastCalledWith(expect.any(Array), 2));
  });

  it("deletes a path while retaining at least one", () => {
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Add path" }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete Common core 2 path" }));
    expect(screen.getByRole("button", { name: "Delete Old common core path" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });
});
