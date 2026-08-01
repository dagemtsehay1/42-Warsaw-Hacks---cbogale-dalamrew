import { fortyTwoFetch, fortyTwoFetchAllPages } from "./client";
import { getDefaultCursusId, getOptionalCampusId } from "./config";
import type {
  FortyTwoBloc,
  FortyTwoCampus,
  FortyTwoCoalition,
  FortyTwoCoalitionUser,
  FortyTwoCursusUser,
  FortyTwoLocation,
  FortyTwoProjectsUser,
  FortyTwoScore,
  FortyTwoUser,
} from "./types";

export async function resolveWarsawCampusId(): Promise<FortyTwoCampus> {
  const override = getOptionalCampusId();
  if (override) {
    return fortyTwoFetch<FortyTwoCampus>(`/v2/campus/${override}`);
  }

  const campuses = await fortyTwoFetchAllPages<FortyTwoCampus>("/v2/campus", {
    pageSize: 100,
    maxPages: 5,
  });

  const warsaw =
    campuses.find((c) => c.name.toLowerCase() === "warsaw") ||
    campuses.find((c) => c.city?.toLowerCase() === "warsaw") ||
    campuses.find((c) => c.name.toLowerCase().includes("warsaw"));

  if (!warsaw) {
    throw new Error("Could not resolve 42 Warsaw campus id from the API");
  }

  return warsaw;
}

export async function fetchActiveLocations(campusId: number) {
  return fortyTwoFetchAllPages<FortyTwoLocation>(
    `/v2/campus/${campusId}/locations`,
    {
      pageSize: 100,
      maxPages: 5,
      searchParams: {
        "filter[active]": "true",
        sort: "-begin_at",
      },
    },
  );
}

export async function fetchEarliestLocationToday(
  campusId: number,
  sinceIso: string,
) {
  return fortyTwoFetchAllPages<FortyTwoLocation>(
    `/v2/campus/${campusId}/locations`,
    {
      pageSize: 100,
      maxPages: 1,
      searchParams: {
        "range[begin_at]": `${sinceIso},${new Date().toISOString()}`,
        sort: "begin_at",
      },
    },
  );
}

/**
 * Every session that *started* since `sinceIso` — the Hall of Fame's week.
 *
 * Warsaw runs ~840 sessions a week (9 pages), so this is the second-heaviest call
 * on the dashboard after the coalition ledgers; `maxPages` bounds it at a quiet
 * fortnight's worth. A session that began before the window and ended inside it
 * is not returned: the board is "longest session started this week", not "longest
 * session overlapping this week".
 */
export async function fetchLocationsSince(
  campusId: number,
  sinceIso: string,
  maxPages = 12,
) {
  return fortyTwoFetchAllPages<FortyTwoLocation>(
    `/v2/campus/${campusId}/locations`,
    {
      pageSize: 100,
      maxPages,
      searchParams: {
        "range[begin_at]": `${sinceIso},${new Date().toISOString()}`,
        sort: "-begin_at",
      },
    },
  );
}

/**
 * `/v2/projects_users` **ignores `sort` entirely** — `-marked_at`, `-updated_at` and
 * `-id` all return the same page, oldest records first, so asking for "the newest N"
 * by sorting silently returns Warsaw's 2021 opening week instead.
 *
 * `range[...]` is honoured, so recency is expressed as a time window and the caller
 * sorts what comes back. Order within the window is not guaranteed either — always
 * sort client-side before slicing.
 */
export async function fetchProjectsUsers(params: {
  campusId?: number;
  cursusId?: number;
  status?: string;
  marked?: boolean;
  maxPages?: number;
  /** Field the window applies to, e.g. `marked_at` for passes, `updated_at` for WIP. */
  rangeField?: "marked_at" | "updated_at";
  /** Start of the window; the end is always now. */
  since?: Date;
}) {
  const range =
    params.rangeField && params.since
      ? {
          [`range[${params.rangeField}]`]: `${params.since.toISOString()},${new Date().toISOString()}`,
        }
      : {};

  return fortyTwoFetchAllPages<FortyTwoProjectsUser>("/v2/projects_users", {
    pageSize: 100,
    maxPages: params.maxPages ?? 5,
    searchParams: {
      "filter[campus]": params.campusId,
      "filter[cursus]": params.cursusId ?? getDefaultCursusId(),
      "filter[status]": params.status,
      "filter[marked]": params.marked === undefined ? undefined : String(params.marked),
      ...range,
    },
  });
}

/**
 * Every 42cursus enrolment at the campus — Warsaw returns ~575 rows (6 pages),
 * which is years of students: finished, blackholed and staff records included.
 * The caller narrows it to current learners (`currentLearners`).
 *
 * `filter[active]` is accepted by the endpoint but tracks the *user account*
 * being active, not the enrolment, so it drops learners who simply haven't
 * logged in lately — the filtering is done on the returned rows instead.
 */
export async function fetchCampusCursusUsers(campusId: number, cursusId: number) {
  return fortyTwoFetchAllPages<FortyTwoCursusUser>(
    `/v2/cursus/${cursusId}/cursus_users`,
    {
      pageSize: 100,
      maxPages: 10,
      searchParams: { "filter[campus_id]": campusId },
    },
  );
}

export async function fetchCampusBlocs(campusId: number, cursusId: number) {
  return fortyTwoFetchAllPages<FortyTwoBloc>("/v2/blocs", {
    pageSize: 30,
    maxPages: 1,
    searchParams: {
      "filter[campus_id]": campusId,
      "filter[cursus_id]": cursusId,
    },
  });
}

export async function fetchCoalitionsByBloc(blocId: number) {
  return fortyTwoFetchAllPages<FortyTwoCoalition>(
    `/v2/blocs/${blocId}/coalitions`,
    { pageSize: 30, maxPages: 1 },
  );
}

export async function fetchCoalitionContributors(coalitionId: number) {
  return fortyTwoFetchAllPages<FortyTwoCoalitionUser>(
    `/v2/coalitions/${coalitionId}/coalitions_users`,
    { pageSize: 100, maxPages: 2 },
  );
}

/**
 * A coalition's score ledger, newest first, back to the start of the current
 * season.
 *
 * The ledger runs for the life of the coalition (years), but coalition scores are
 * reset between seasons and those resets are *not* written to the ledger — summing
 * everything gives an order of magnitude more than the current score. So we page
 * backwards only until the events collected exceed the current total, which is the
 * point where the running reconstruction would cross zero: the last reset.
 *
 * `range[created_at]` is ignored by this endpoint, so paging is the only control.
 */
export async function fetchCoalitionScoreEvents(
  coalitionId: number,
  currentScore: number,
) {
  let accumulated = 0;
  return fortyTwoFetchAllPages<FortyTwoScore>(
    `/v2/coalitions/${coalitionId}/scores`,
    {
      pageSize: 100,
      maxPages: 15,
      // A season is ~10 pages per coalition, so this is the heaviest call on the
      // dashboard; pace it further under the 2 req/s ceiling than the default.
      delayMs: 750,
      searchParams: { sort: "-created_at" },
      stopWhen: (events) => {
        accumulated = events.reduce((sum, e) => sum + (e.value ?? 0), 0);
        return accumulated >= currentScore;
      },
    },
  );
}

export async function fetchUsersByIds(userIds: number[]) {
  if (userIds.length === 0) return [];
  return fortyTwoFetchAllPages<FortyTwoUser>("/v2/users", {
    pageSize: 100,
    maxPages: 1,
    searchParams: { "filter[id]": userIds.join(",") },
  });
}
