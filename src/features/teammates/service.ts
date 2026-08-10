import { fetchUserInProgressProjects } from "@/lib/api/42/resources";
import type { SessionUser } from "@/lib/auth/session";
import { listRequestsForUser } from "./repository";
import type { TeammateProjectOption } from "@/types/campus";

/**
 * What the signed-in student sees after scanning: every project they currently
 * have in progress, each marked with whether it is already on the board.
 *
 * That single list is both the "add" and the "remove" view — a second scan
 * shows the same page with their existing entries ticked, so there is nothing
 * to explain and no second screen to find.
 *
 * Anything they have listed but is no longer in progress is appended, so a
 * finished project can still be taken down rather than being stuck until it
 * expires.
 */
export async function projectOptionsFor(
  user: SessionUser,
): Promise<TeammateProjectOption[]> {
  const [inProgress, listed] = await Promise.all([
    fetchUserInProgressProjects(user.id),
    listRequestsForUser(user.id),
  ]);

  const listedByProject = new Map(listed.map((r) => [r.projectId, r]));
  const options: TeammateProjectOption[] = [];
  const seen = new Set<number>();

  for (const item of inProgress) {
    if (!item.project?.id || seen.has(item.project.id)) continue;
    seen.add(item.project.id);
    options.push({
      projectId: item.project.id,
      projectName: item.project.name,
      projectSlug: item.project.slug,
      listed: listedByProject.has(item.project.id),
    });
  }

  for (const request of listed) {
    if (seen.has(request.projectId)) continue;
    seen.add(request.projectId);
    options.push({
      projectId: request.projectId,
      projectName: request.projectName,
      projectSlug: request.projectSlug,
      listed: true,
    });
  }

  // Listed first so a returning student sees what to remove without scrolling.
  return options.sort((a, b) => {
    if (a.listed !== b.listed) return a.listed ? -1 : 1;
    return a.projectName.localeCompare(b.projectName);
  });
}
