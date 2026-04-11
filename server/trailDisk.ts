import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { TrailFeedEvent } from "../src/net/trailProtocol";
import {
  calendarDayKeyPST,
  todayCalendarKeyPST,
} from "../src/game/pstDate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type PersistedScore = { name: string; score: number; at: string; meta?: unknown };

const SCORES_FILE = "scores.json";
const FEED_FILE = "feed.json";
const ARCHIVE_PREFIX = "daily-";

function dataDir(): string {
  const env = process.env.EMOTA_TRAIL_DATA_DIR?.trim();
  if (env) return path.resolve(env);
  return path.join(__dirname, "../data/trail");
}

function archiveDir(): string {
  return path.join(dataDir(), "archive");
}

function ensureDirSync(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadPersistedScores(): PersistedScore[] {
  ensureDirSync(dataDir());
  const p = path.join(dataDir(), SCORES_FILE);
  if (!fs.existsSync(p)) return [];
  try {
    const raw = fs.readFileSync(p, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    const out: PersistedScore[] = [];
    for (const row of j) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const name = String(r.name ?? "").slice(0, 40);
      const score = Number(r.score);
      const at = String(r.at ?? "");
      if (!name || !Number.isFinite(score) || !at) continue;
      out.push({ name, score, at, meta: r.meta });
    }
    return out;
  } catch {
    return [];
  }
}

export function loadPersistedFeed(): TrailFeedEvent[] {
  ensureDirSync(dataDir());
  const p = path.join(dataDir(), FEED_FILE);
  if (!fs.existsSync(p)) return [];
  try {
    const raw = fs.readFileSync(p, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    const out: TrailFeedEvent[] = [];
    for (const row of j) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? "");
      const at = String(r.at ?? "");
      const kind = String(r.kind ?? "system").slice(0, 32);
      const displayName = String(r.displayName ?? "").slice(0, 40);
      const text = String(r.text ?? "").slice(0, 280);
      if (!id || !at || !text) continue;
      out.push({
        id,
        at,
        kind,
        displayName,
        text,
        miles: typeof r.miles === "number" ? r.miles : undefined,
        day: typeof r.day === "number" ? r.day : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function persistScores(scores: PersistedScore[]): void {
  ensureDirSync(dataDir());
  const p = path.join(dataDir(), SCORES_FILE);
  fs.writeFileSync(p, JSON.stringify(scores, null, 2) + "\n", "utf8");
}

export function persistFeed(feed: TrailFeedEvent[]): void {
  ensureDirSync(dataDir());
  const p = path.join(dataDir(), FEED_FILE);
  fs.writeFileSync(p, JSON.stringify(feed, null, 2) + "\n", "utf8");
}

export function isSimulationScore(row: PersistedScore): boolean {
  const n = row.name;
  if (/^Bot-/i.test(n) || /^Stress-/i.test(n)) return true;
  const m = row.meta;
  if (m && typeof m === "object" && "stress" in m && (m as { stress?: unknown }).stress === true)
    return true;
  return false;
}

export function isSimulationFeedEvent(ev: TrailFeedEvent): boolean {
  const n = ev.displayName ?? "";
  if (/^Bot-/i.test(n) || /^Stress-/i.test(n)) return true;
  return false;
}

export function purgeSimulation(
  scores: PersistedScore[],
  feed: TrailFeedEvent[],
): { scores: PersistedScore[]; feed: TrailFeedEvent[] } {
  return {
    scores: scores.filter((r) => !isSimulationScore(r)),
    feed: feed.filter((e) => !isSimulationFeedEvent(e)),
  };
}

export function writeDailyArchive(
  pstDay: string,
  scores: PersistedScore[],
  feed: TrailFeedEvent[],
): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pstDay)) return;
  ensureDirSync(archiveDir());
  const dayScores = scores.filter((s) => calendarDayKeyPST(s.at) === pstDay);
  const dayFeed = feed.filter((e) => calendarDayKeyPST(e.at) === pstDay);
  const payload = {
    pstDay,
    exportedAt: new Date().toISOString(),
    scores: dayScores,
    feed: dayFeed,
  };
  const file = path.join(archiveDir(), `${ARCHIVE_PREFIX}${pstDay}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

function retentionDays(): number {
  const n = parseInt(process.env.TRAIL_ARCHIVE_RETENTION_DAYS ?? "90", 10);
  return Number.isFinite(n) && n >= 7 ? n : 90;
}

/** Approximate PST calendar day N days before “now” (good enough for file retention). */
function pstCutoffKey(retDays: number): string {
  return calendarDayKeyPST(new Date(Date.now() - retDays * 24 * 60 * 60 * 1000));
}

export function pruneOldArchives(): void {
  const dir = archiveDir();
  if (!fs.existsSync(dir)) return;
  const cutoff = pstCutoffKey(retentionDays());
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith(ARCHIVE_PREFIX) || !name.endsWith(".json")) continue;
    const key = name.slice(ARCHIVE_PREFIX.length, -5);
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && key < cutoff) {
      try {
        fs.unlinkSync(path.join(dir, name));
      } catch {
        /* ignore */
      }
    }
  }
}

export function getTrailDataDir(): string {
  return dataDir();
}

export function listArchiveFiles(): string[] {
  const dir = archiveDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => n.startsWith(ARCHIVE_PREFIX) && n.endsWith(".json"))
    .sort();
}

/** Call every ~15s from server; invokes onRollover(previousPstDay) when PST date changes. */
export function startPstDayRolloverWatcher(onRollover: (previousPstDay: string) => void): () => void {
  let last = todayCalendarKeyPST();
  const t = setInterval(() => {
    const now = todayCalendarKeyPST();
    if (now === last) return;
    const prev = last;
    last = now;
    onRollover(prev);
  }, 15_000);
  return () => clearInterval(t);
}
