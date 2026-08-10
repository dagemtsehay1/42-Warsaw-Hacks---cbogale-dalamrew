export type CoalitionSummary = {
  id: number;
  name: string;
  slug: string;
  color: string;
  imageUrl?: string;
  score: number;
  scoreDelta?: number | null;
};

export type CoalitionScorePoint = {
  capturedAt: string;
  scoresByCoalitionId: Record<number, number>;
};

export type CoalitionContributor = {
  login: string;
  displayName: string;
  imageUrl?: string;
  score: number;
};

export type CoalitionContributors = {
  coalitionId: number;
  contributors: CoalitionContributor[];
};

export type ProjectPass = {
  id: number;
  login: string;
  displayName: string;
  imageUrl?: string;
  projectId: number;
  projectName: string;
  score: number | null;
  validated: boolean;
  markedAt: string | null;
  /** An exam rank rather than an ordinary project — the board celebrates these. */
  isExam: boolean;
};

export type ActiveProjectStat = {
  projectId: number;
  projectName: string;
  slug: string;
  studentCount: number;
};

export type PresenceStudent = {
  login: string;
  displayName: string;
  imageUrl?: string;
  host: string;
  beginAt: string;
};

/**
 * One host session. `endAt: null` means it is still running, so the UI keeps
 * counting past `durationMs` (which is only accurate as of `fetchedAt`).
 */
export type SessionRecord = PresenceStudent & {
  endAt: string | null;
  durationMs: number;
};

export type CampusPulse = {
  studentsOnCampus: number;
  projectsPassedToday: number;
  projectsPassedMonth: number;
  activeProjects: number;
};

/** One whole level of the cursus, e.g. everyone between level 3.00 and 3.99. */
export type LevelBandStat = {
  id: string;
  label: string;
  /** Lower bound of the band; the top band is open-ended. */
  level: number;
  studentCount: number;
};

/** Campus-wide numbers that aren't tied to today's activity. */
export type CampusStats = {
  /** Students currently enrolled in the cursus (not finished, not blackholed). */
  studentsInCursus: number;
  /** Everyone the campus has ever registered, piscines and alumni included. */
  campusMembers: number;
  averageLevel: number;
  topLevel: number;
  /** Grade "Transcender" or "Alumni" — the common core is behind them. */
  pastCommonCore: number;
  blackholeWithin7Days: number;
  /** Distinct students with at least one project in progress. */
  studentsBuilding: number;
  /** Distinct projects with at least one student on them. */
  projectsInProgress: number;
};

/** One day of the stored attendance outlook. */
export type DayForecast = {
  /** Campus-local `YYYY-MM-DD`. */
  targetDate: string;
  expected: number;
  low: number;
  high: number;
  /** Campus-local hour (0–23) the day is fullest, or null when unknown. */
  peakHour: number | null;
  peakStudents: number | null;
  sampleDays: number;
};

/**
 * What the server hands the board: the stored payload plus the freshness and
 * forecast metadata the UI needs. The browser never sees the 42 API.
 */
export type DashboardView = {
  payload: DashboardPayload | null;
  /** When the ingest that produced `payload` ran. */
  capturedAt: string;
  /** When the board should reload — just after the next ingest is due. */
  nextRefreshAt: string;
  stale: boolean;
  source: "database" | "warming-up" | "live";
  forecast: DayForecast[];
  /** Events between this Monday 05:00 and next. Empty without a database. */
  events: CampusEvent[];
  /** Students currently looking for a teammate. Empty without a database. */
  teammates: TeammateRequest[];
  /** Bocal's uploaded slides, active ones only, in rotation order. */
  slides: Slide[];
  /** Absolute URL the QR code points at, or null when APP_PUBLIC_URL is unset. */
  teammateUrl: string | null;
};

export type DisplayScreenId =
  | "stats"
  | "presence"
  | "achievements"
  | "coalitions"
  | "events"
  | "slides";

/** One campus event from `/v2/campus/:id/events`. */
export type CampusEvent = {
  id: number;
  name: string;
  description: string | null;
  kind: string | null;
  location: string | null;
  beginAt: string;
  endAt: string | null;
  maxPeople: number | null;
  subscribers: number | null;
};

/** A student advertising that they want a teammate on a project. */
export type TeammateRequest = {
  id: number;
  login: string;
  displayName: string;
  imageUrl?: string;
  projectId: number;
  projectName: string;
  projectSlug: string;
  createdAt: string;
};

/** One in-progress project a signed-in student can advertise. */
export type TeammateProjectOption = {
  projectId: number;
  projectName: string;
  projectSlug: string;
  /** Whether they are already on the board for it. */
  listed: boolean;
};

/** An image bocal uploaded to the rotation. */
export type Slide = {
  id: number;
  title: string;
  active: boolean;
  sortOrder: number;
  uploadedBy: string;
  createdAt: string;
  byteSize: number;
};

export type DashboardPayload = {
  campusId: number;
  campusName: string;
  cursusId: number;
  fetchedAt: string;
  pulse: CampusPulse;
  stats: CampusStats;
  levelDistribution: LevelBandStat[];
  recentPasses: ProjectPass[];
  activeProjects: ActiveProjectStat[];
  presence: PresenceStudent[];
  earliestLogin: PresenceStudent | null;
  /** Start of the current week (Monday 05:00, campus-local) the Hall of Fame covers. */
  weekStart: string;
  /** Longest single host session that started since `weekStart`. */
  topSessionThisWeek: SessionRecord | null;
  coalitions: CoalitionSummary[];
  coalitionScoreHistory: CoalitionScorePoint[];
  coalitionContributors: CoalitionContributors[];
  didYouKnow: string;
  errors: string[];
};
