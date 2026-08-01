import type {
  CoalitionContributor,
  CoalitionSummary,
  PresenceStudent,
  ProjectPass,
  SessionRecord,
} from "@/types/campus";
import type {
  FortyTwoCoalition,
  FortyTwoCoalitionUser,
  FortyTwoLocation,
  FortyTwoProjectsUser,
  FortyTwoUser,
} from "./types";

/**
 * The **largest** portrait the user has, because `next/image` downscales it
 * server-side — a big source costs the optimizer one fetch, not the TV one byte.
 *
 * Measured on the CDN: `micro` 25×19, `small` 175×131, `medium` 350×263,
 * `large` 700×525, `link` (original) 640×480. The old `medium`-first choice put
 * a 350px source behind avatars that are displayed at up to 120px **and then
 * square-cropped** — and since these are 4:3, the crop throws away a third of
 * the width, so anything but `large` visibly softens on a wall-sized screen.
 */
export function imageUrlFromUser(user: {
  image?: {
    link?: string | null;
    versions?: { large?: string; medium?: string; small?: string };
  };
}): string | undefined {
  return (
    user.image?.versions?.large ||
    user.image?.link ||
    user.image?.versions?.medium ||
    user.image?.versions?.small ||
    undefined
  );
}

export function displayNameFromUser(user: {
  usual_full_name?: string;
  displayname?: string;
  first_name?: string;
  last_name?: string;
  login: string;
}): string {
  return (
    user.usual_full_name ||
    user.displayname ||
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.login
  );
}

export function toCoalitionSummary(
  coalition: FortyTwoCoalition,
  scoreDelta?: number | null,
): CoalitionSummary {
  return {
    id: coalition.id,
    name: coalition.name,
    slug: coalition.slug,
    color: coalition.color || "#00babc",
    imageUrl: coalition.image_url,
    score: coalition.score ?? 0,
    scoreDelta: scoreDelta ?? null,
  };
}

export function toProjectPass(item: FortyTwoProjectsUser): ProjectPass | null {
  if (!item.user) return null;
  return {
    id: item.id,
    login: item.user.login,
    displayName: displayNameFromUser(item.user),
    imageUrl: imageUrlFromUser(item.user),
    projectId: item.project.id,
    projectName: item.project.name,
    score: item.final_mark ?? null,
    validated: item["validated?"] === true,
    markedAt: item.marked_at ?? null,
  };
}

export function toCoalitionContributor(
  item: FortyTwoCoalitionUser,
  usersById: Map<number, FortyTwoUser>,
): CoalitionContributor | null {
  const user = usersById.get(item.user_id);
  if (!user) return null;
  return {
    login: user.login,
    displayName: displayNameFromUser(user),
    imageUrl: imageUrlFromUser(user),
    score: item.score ?? 0,
  };
}

export function toPresenceStudent(location: FortyTwoLocation): PresenceStudent {
  return {
    login: location.user.login,
    displayName: displayNameFromUser(location.user),
    imageUrl: imageUrlFromUser(location.user),
    host: location.host,
    beginAt: location.begin_at,
  };
}

/**
 * A session with its length. An open session (`end_at: null`) is measured up to
 * `now`, so its duration is only true as of the fetch — the board keeps counting
 * from `beginAt` for those.
 */
export function toSessionRecord(
  location: FortyTwoLocation,
  now = new Date(),
): SessionRecord {
  const begin = new Date(location.begin_at).getTime();
  const end = location.end_at ? new Date(location.end_at).getTime() : now.getTime();

  return {
    ...toPresenceStudent(location),
    endAt: location.end_at ?? null,
    durationMs: Math.max(0, end - begin),
  };
}
