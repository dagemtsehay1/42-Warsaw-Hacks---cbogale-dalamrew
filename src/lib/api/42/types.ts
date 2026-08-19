/** Raw 42 API response shapes (subset of fields we use). */

/** Measured sizes: large 700×525, medium 350×263, small 175×131, micro 25×19. */
export type FortyTwoImageVersions = {
  large?: string;
  medium?: string;
  small?: string;
  micro?: string;
};

export type FortyTwoUserImage = {
  link?: string | null;
  versions?: FortyTwoImageVersions;
};

export type FortyTwoCampus = {
  id: number;
  name: string;
  time_zone: string;
  users_count: number;
  country: string;
  city: string;
  website?: string;
  active: boolean;
};

export type FortyTwoUser = {
  id: number;
  login: string;
  first_name: string;
  last_name: string;
  usual_full_name?: string;
  displayname?: string;
  image: FortyTwoUserImage;
  /** Question mark included, as with `validated?` on projects_users. */
  "staff?"?: boolean;
  /**
   * Only present on `/v2/users/:id` (not on the nested `user` inside other
   * resources) — every project this student has ever registered for, past
   * and present, across every cursus and piscine they've been in.
   */
  projects_users?: FortyTwoProjectsUser[];
};

/** A student's enrolment in one cursus — the level/grade record. */
export type FortyTwoCursusUser = {
  id: number;
  cursus_id: number;
  level: number;
  /** "Cadet", "Transcender", "Alumni"; null for staff enrolments. */
  grade?: string | null;
  begin_at: string;
  /** Set once the student has finished (or left) the cursus. */
  end_at?: string | null;
  /** Deadline the student has to validate a project by; past = blackholed. */
  blackholed_at?: string | null;
  user: FortyTwoUser;
};

export type FortyTwoProjectsUser = {
  id: number;
  final_mark?: number | null;
  status: string;
  /**
   * The API really does name this key `validated?`, question mark included — it is
   * not an optional `validated`. Reading `item.validated` silently yields undefined.
   */
  "validated?"?: boolean | null;
  project: {
    id: number;
    name: string;
    slug: string;
  };
  /** Every cursus this registration counts under — a project shared between
   *  42cursus and a piscine carries both ids here. */
  cursus_ids?: number[];
  marked_at?: string | null;
  marked: boolean;
  created_at: string;
  updated_at: string;
  user?: FortyTwoUser;
};

export type FortyTwoCoalition = {
  id: number;
  name: string;
  slug: string;
  image_url?: string;
  cover_url?: string;
  color: string;
  score: number;
};

export type FortyTwoBloc = {
  id: number;
  campus_id: number;
  cursus_id: number;
  coalition_ids: number[];
};

export type FortyTwoCoalitionUser = {
  id: number;
  coalition_id: number;
  user_id: number;
  score: number;
  rank: number;
};

/** One entry of a coalition's append-only score ledger. */
export type FortyTwoScore = {
  id: number;
  coalition_id: number;
  value: number;
  reason?: string | null;
  created_at: string;
};

export type FortyTwoLocation = {
  id: number;
  begin_at: string;
  end_at: string | null;
  primary: boolean;
  host: string;
  campus_id: number;
  user: FortyTwoUser;
};

/**
 * A campus event. Only `id`, `name` and `begin_at` are relied on — every other
 * field is treated as optional, because this endpoint's shape could not be
 * verified against the live API and a missing `location` must not blank the
 * screen.
 */
export type FortyTwoEvent = {
  id: number;
  name: string;
  description?: string | null;
  /** "conference", "meet_up", "workshop", "association"… Free-form in practice. */
  kind?: string | null;
  location?: string | null;
  begin_at: string;
  end_at?: string | null;
  max_people?: number | null;
  nbr_subscribers?: number | null;
};

export type FortyTwoTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  created_at: number;
};

export type FortyTwoApiErrorBody = {
  error?: string;
  message?: string;
};
