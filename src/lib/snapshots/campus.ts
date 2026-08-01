import { promises as fs } from "fs";
import path from "path";

export type CoalitionSnapshotEntry = {
  id: number;
  name: string;
  score: number;
};

export type CampusSnapshot = {
  capturedAt: string;
  campusId: number;
  coalitions: CoalitionSnapshotEntry[];
  metrics?: {
    studentsOnCampus?: number;
    projectsPassedToday?: number;
  };
};

const SNAPSHOT_DIR = path.join(process.cwd(), "data", "snapshots");
const LATEST_FILE = path.join(SNAPSHOT_DIR, "campus-latest.json");
const PREVIOUS_FILE = path.join(SNAPSHOT_DIR, "campus-previous.json");
const MIN_INTERVAL_MS = 30 * 60_000;

async function ensureDir() {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
}

export async function readLatestSnapshot(): Promise<CampusSnapshot | null> {
  try {
    const raw = await fs.readFile(LATEST_FILE, "utf8");
    return JSON.parse(raw) as CampusSnapshot;
  } catch {
    return null;
  }
}

export async function readPreviousSnapshot(): Promise<CampusSnapshot | null> {
  try {
    const raw = await fs.readFile(PREVIOUS_FILE, "utf8");
    return JSON.parse(raw) as CampusSnapshot;
  } catch {
    return null;
  }
}

export function coalitionDeltas(
  current: CoalitionSnapshotEntry[],
  previous: CampusSnapshot | null,
): Map<number, number | null> {
  const map = new Map<number, number | null>();
  for (const entry of current) {
    const prev = previous?.coalitions.find((c) => c.id === entry.id);
    map.set(entry.id, prev ? entry.score - prev.score : null);
  }
  return map;
}

export async function writeSnapshotIfDue(
  snapshot: CampusSnapshot,
): Promise<{ wrote: boolean; previous: CampusSnapshot | null }> {
  await ensureDir();
  const latest = await readLatestSnapshot();
  const previous = (await readPreviousSnapshot()) ?? latest;

  if (latest) {
    const age = Date.now() - new Date(latest.capturedAt).getTime();
    if (age < MIN_INTERVAL_MS) {
      return { wrote: false, previous: previous ?? latest };
    }
  }

  if (latest) {
    await fs.writeFile(PREVIOUS_FILE, JSON.stringify(latest, null, 2), "utf8");
  }

  await fs.writeFile(LATEST_FILE, JSON.stringify(snapshot, null, 2), "utf8");
  return { wrote: true, previous: latest };
}

export function diffCoalitionScores(
  currentScores: { id: number; score: number }[],
  previous: CampusSnapshot | null,
): Record<number, number | null> {
  const result: Record<number, number | null> = {};
  for (const item of currentScores) {
    const prev = previous?.coalitions.find((c) => c.id === item.id);
    result[item.id] = prev ? item.score - prev.score : null;
  }
  return result;
}
