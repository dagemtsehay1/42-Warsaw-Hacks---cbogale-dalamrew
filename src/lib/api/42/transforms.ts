import type {
  CoalitionContributor,
  CoalitionSummary,
  PresenceStudent,
  ProjectPass,
} from "@/types/campus";
import type {
  FortyTwoCoalition,
  FortyTwoCoalitionUser,
  FortyTwoLocation,
  FortyTwoProjectsUser,
  FortyTwoUser,
} from "./types";

export function imageUrlFromUser(user: {
  image?: { link?: string | null; versions?: { medium?: string; small?: string } };
}): string | undefined {
  return (
    user.image?.versions?.medium ||
    user.image?.versions?.small ||
    user.image?.link ||
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
