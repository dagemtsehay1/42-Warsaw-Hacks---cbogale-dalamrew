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

export type CampusPulse = {
  studentsOnCampus: number;
  projectsPassedToday: number;
  projectsPassedMonth: number;
  activeProjects: number;
};

export type DisplayScreenId = "presence" | "achievements" | "coalitions";

export type DashboardPayload = {
  campusId: number;
  campusName: string;
  cursusId: number;
  fetchedAt: string;
  pulse: CampusPulse;
  recentPasses: ProjectPass[];
  activeProjects: ActiveProjectStat[];
  presence: PresenceStudent[];
  earliestLogin: PresenceStudent | null;
  coalitions: CoalitionSummary[];
  coalitionScoreHistory: CoalitionScorePoint[];
  coalitionContributors: CoalitionContributors[];
  didYouKnow: string;
  errors: string[];
};
