import express from "express";
import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import type { TrailFeedEvent, TrailPeer } from "../src/net/trailProtocol";
import { MAX_PARTY, MULTIPLAYER_CAP, TOTAL_TRAIL_MILES } from "../src/game/config";
import type { TrailPeerPartyRow } from "../src/net/trailProtocol";
import {
  getTrailDataDir,
  listArchiveFiles,
  loadPersistedFeed,
  loadPersistedScores,
  persistFeed,
  persistScores,
  purgeSimulation,
  startPstDayRolloverWatcher,
  pruneOldArchives,
  writeDailyArchive,
  type PersistedScore,
} from "./trailDisk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? process.env.TRAIL_SERVER_PORT) || 3333;

/** Spectators (bigboards) + wagons; soft ceiling against connect floods. */
const MAX_SOCKETS = MULTIPLAYER_CAP + 40;
const ROOM_BROADCAST_MS = 250;
const PERSIST_DEBOUNCE_MS = 2000;
const RATE_UPDATE_MS = 250;
const RATE_EVENT_MS = 1000;
const RATE_SCORE_MS = 10_000;
const RATE_ROOM_REQ_MS = 2000;
const MAX_META_JSON = 256;

const FEED_KINDS = new Set([
  "death",
  "milestone",
  "victory",
  "wipeout",
  "river",
  "system",
]);

const app = express();
app.use(express.json({ limit: "512kb" }));
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: true, credentials: false, methods: ["GET", "POST"] },
  path: "/socket.io",
  maxHttpBufferSize: 32 * 1024,
});

type Peer = {
  displayName: string;
  miles: number;
  day: number;
  alive?: number;
  landmark?: string;
  phase?: string;
  partyCap?: number;
  profileTitle?: string;
  party?: TrailPeerPartyRow[];
  clientId: string;
};

function asObject(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

function clampMiles(n: unknown, fallback = 0): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(TOTAL_TRAIL_MILES, x));
}

function clampDay(n: unknown, fallback = 1): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(1, Math.min(999, Math.floor(x)));
}

function sanitizePartyRows(raw: unknown): TrailPeerPartyRow[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: TrailPeerPartyRow[] = [];
  for (const row of raw.slice(0, MAX_PARTY)) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    out.push({
      name: String(r.name ?? "").slice(0, 48),
      health: Math.max(0, Math.min(100, Math.floor(Number(r.health) || 0))),
      alive: Boolean(r.alive),
    });
  }
  return out;
}

function sanitizeMeta(meta: unknown): Record<string, unknown> | undefined {
  if (meta == null) return undefined;
  if (typeof meta !== "object" || Array.isArray(meta)) return undefined;
  try {
    const s = JSON.stringify(meta);
    if (s.length > MAX_META_JSON) return undefined;
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

const peers = new Map<string, Peer>();
const lastEmitAt = new Map<string, Map<string, number>>();

type ScoreRow = PersistedScore;
let scores: ScoreRow[] = loadPersistedScores();

const FEED_CAP = 200;
let feed: TrailFeedEvent[] = loadPersistedFeed();
if (feed.length > FEED_CAP) feed = feed.slice(-FEED_CAP);

let roomDirty = false;
let roomBroadcastTimer: ReturnType<typeof setTimeout> | null = null;
let scoresDirty = false;
let feedDirty = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function allowRate(socket: Socket, key: string, minMs: number): boolean {
  let bucket = lastEmitAt.get(socket.id);
  if (!bucket) {
    bucket = new Map();
    lastEmitAt.set(socket.id, bucket);
  }
  const now = Date.now();
  const prev = bucket.get(key) ?? 0;
  if (now - prev < minMs) return false;
  bucket.set(key, now);
  return true;
}

function clearRate(socketId: string): void {
  lastEmitAt.delete(socketId);
}

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      if (scoresDirty) {
        scoresDirty = false;
        persistScores(scores);
      }
      if (feedDirty) {
        feedDirty = false;
        persistFeed(feed);
      }
    } catch (e) {
      console.error("[trail] Persist failed:", e);
    }
  }, PERSIST_DEBOUNCE_MS);
}

function flushPersistNow(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  try {
    if (scoresDirty) {
      scoresDirty = false;
      persistScores(scores);
    }
    if (feedDirty) {
      feedDirty = false;
      persistFeed(feed);
    }
  } catch (e) {
    console.error("[trail] Persist failed:", e);
  }
}

function broadcastScores(): void {
  io.emit("scores:list", scores);
}

function roomSnapshotList(): TrailPeer[] {
  return [...peers.entries()].map(([id, v]) => ({
    id,
    displayName: v.displayName,
    miles: v.miles,
    day: v.day,
    alive: v.alive,
    landmark: v.landmark,
    phase: v.phase,
    partyCap: v.partyCap,
    profileTitle: v.profileTitle,
    party: v.party,
  }));
}

function removePeersWithClientId(clientId: string): void {
  for (const [sid, peer] of [...peers.entries()]) {
    if (peer.clientId === clientId) peers.delete(sid);
  }
}

function emitRoomNow(): void {
  roomDirty = false;
  if (roomBroadcastTimer) {
    clearTimeout(roomBroadcastTimer);
    roomBroadcastTimer = null;
  }
  io.emit("trail:room", roomSnapshotList());
}

/** Coalesce full-room emits — hostile update spam cannot O(N²) every tick. */
function scheduleBroadcastRoom(): void {
  roomDirty = true;
  if (roomBroadcastTimer) return;
  roomBroadcastTimer = setTimeout(() => {
    roomBroadcastTimer = null;
    if (!roomDirty) return;
    emitRoomNow();
  }, ROOM_BROADCAST_MS);
}

function pushFeed(ev: TrailFeedEvent): void {
  feed.push(ev);
  if (feed.length > FEED_CAP) feed.splice(0, feed.length - FEED_CAP);
  feedDirty = true;
  schedulePersist();
  io.emit("trail:feed:append", ev);
}

const ADMIN_TOKEN = process.env.EMOTA_TRAIL_ADMIN_TOKEN?.trim();

function adminAuth(req: express.Request, res: express.Response): boolean {
  if (!ADMIN_TOKEN) {
    res.status(503).json({ ok: false, error: "Admin API disabled (set EMOTA_TRAIL_ADMIN_TOKEN)." });
    return false;
  }
  const header = req.headers["x-emota-admin"];
  const token =
    (typeof header === "string" ? header : Array.isArray(header) ? header[0] : "") ||
    String(req.query.token ?? "");
  if (token !== ADMIN_TOKEN) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }
  return true;
}

app.post("/trail/admin/purge-simulation", (req, res) => {
  if (!adminAuth(req, res)) return;
  const before = scores.length;
  const beforeF = feed.length;
  const purged = purgeSimulation(scores, feed);
  scores = purged.scores;
  feed = purged.feed;
  scoresDirty = true;
  feedDirty = true;
  flushPersistNow();
  broadcastScores();
  io.emit("trail:feed:sync", feed.slice(-120));
  res.json({
    ok: true,
    removedScores: before - scores.length,
    removedFeed: beforeF - feed.length,
  });
});

app.post("/trail/admin/reset-trail-board", (req, res) => {
  if (!adminAuth(req, res)) return;
  scores = [];
  feed = [];
  scoresDirty = true;
  feedDirty = true;
  flushPersistNow();
  broadcastScores();
  io.emit("trail:feed:sync", []);
  res.json({ ok: true, message: "Scores and feed cleared (peers unchanged until disconnect)." });
});

app.get("/trail/admin/status", (req, res) => {
  if (!adminAuth(req, res)) return;
  res.json({
    ok: true,
    dataDir: getTrailDataDir(),
    scores: scores.length,
    feed: feed.length,
    peers: peers.size,
    sockets: io.engine.clientsCount,
    archiveFiles: listArchiveFiles().length,
    adminEnabled: true,
  });
});

const distDir = path.join(__dirname, "../dist");
app.use(express.static(distDir));

app.get("/bigboard", (_req, res) => {
  res.sendFile(path.join(distDir, "bigboard.html"));
});

app.get("/join", (_req, res) => {
  res.sendFile(path.join(distDir, "join.html"));
});

app.get("/event", (_req, res) => {
  res.sendFile(path.join(distDir, "join.html"));
});

app.get("/play", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

io.on("connection", (socket) => {
  if (io.engine.clientsCount > MAX_SOCKETS) {
    socket.emit("trail:error", { message: "Trail server busy — try again shortly." });
    socket.disconnect(true);
    return;
  }

  socket.emit("scores:list", scores);
  socket.emit("trail:feed:sync", feed.slice(-120));
  socket.emit("trail:room", roomSnapshotList());

  socket.on("trail:room:request", () => {
    if (!allowRate(socket, "roomReq", RATE_ROOM_REQ_MS)) return;
    socket.emit("trail:room", roomSnapshotList());
  });

  socket.on("trail:hello", (payload: unknown) => {
    const raw = asObject(payload) ?? {};
    const displayName = String(raw.displayName ?? "Traveler").slice(0, 24);
    const clientId = String(raw.clientId ?? socket.id).slice(0, 36) || socket.id;
    removePeersWithClientId(clientId);
    if (peers.size >= MULTIPLAYER_CAP) {
      socket.emit("trail:error", {
        message: "The trail is full right now. Try again in a few minutes.",
      });
      socket.disconnect(true);
      return;
    }
    peers.set(socket.id, { displayName, miles: 0, day: 1, clientId });
    scheduleBroadcastRoom();
  });

  socket.on("trail:update", (payload: unknown) => {
    const p = peers.get(socket.id);
    if (!p) return;
    if (!allowRate(socket, "update", RATE_UPDATE_MS)) return;
    const raw = asObject(payload);
    if (!raw) return;

    if (raw.displayName !== undefined) p.displayName = String(raw.displayName ?? "").slice(0, 24) || p.displayName;
    if (raw.miles !== undefined) p.miles = clampMiles(raw.miles, p.miles);
    if (raw.day !== undefined) p.day = clampDay(raw.day, p.day);
    if (typeof raw.alive === "number" && Number.isFinite(raw.alive)) {
      p.alive = Math.max(0, Math.min(10, Math.floor(raw.alive)));
    }
    if (raw.landmark !== undefined) p.landmark = String(raw.landmark ?? "").slice(0, 80);
    if (raw.phase !== undefined) p.phase = String(raw.phase ?? "").slice(0, 40);
    if (typeof raw.partyCap === "number" && Number.isFinite(raw.partyCap)) {
      p.partyCap = Math.max(1, Math.min(10, Math.floor(raw.partyCap)));
    }
    if (raw.profileTitle !== undefined) p.profileTitle = String(raw.profileTitle ?? "").slice(0, 48);
    if (raw.party !== undefined) {
      const rows = sanitizePartyRows(raw.party);
      p.party = rows && rows.length > 0 ? rows : [];
    }
    scheduleBroadcastRoom();
  });

  socket.on("trail:event", (payload: unknown) => {
    const p = peers.get(socket.id);
    if (!p) return;
    if (!allowRate(socket, "event", RATE_EVENT_MS)) return;
    const raw = asObject(payload);
    if (!raw) return;
    let kind = String(raw.kind ?? "system").slice(0, 32);
    if (!FEED_KINDS.has(kind)) kind = "system";
    const text = String(raw.text ?? "").slice(0, 280);
    if (!text.trim()) return;
    const ev: TrailFeedEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      at: new Date().toISOString(),
      kind,
      displayName: p.displayName,
      text,
      miles: raw.miles !== undefined ? clampMiles(raw.miles, p.miles) : p.miles,
      day: raw.day !== undefined ? clampDay(raw.day, p.day) : p.day,
    };
    pushFeed(ev);
  });

  socket.on("scores:submit", (payload: unknown) => {
    if (!peers.has(socket.id)) return;
    if (!allowRate(socket, "score", RATE_SCORE_MS)) return;
    const raw = asObject(payload);
    if (!raw) return;
    const name = String(raw.name ?? "Anonymous").slice(0, 40);
    const score = Number(raw.score);
    if (!Number.isFinite(score)) return;
    const bounded = Math.max(-1e9, Math.min(1e9, score));
    scores.push({
      name,
      score: bounded,
      at: new Date().toISOString(),
      meta: sanitizeMeta(raw.meta),
    });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 100);
    scoresDirty = true;
    schedulePersist();
    broadcastScores();
  });

  socket.on("disconnect", () => {
    clearRate(socket.id);
    const had = peers.delete(socket.id);
    if (had) scheduleBroadcastRoom();
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    peers: peers.size,
    sockets: io.engine.clientsCount,
    cap: MULTIPLAYER_CAP,
  });
});

startPstDayRolloverWatcher((previousPstDay) => {
  try {
    flushPersistNow();
    writeDailyArchive(previousPstDay, scores, feed);
    pruneOldArchives();
    console.log(`[trail] Daily archive written for ${previousPstDay} (PST)`);
  } catch (e) {
    console.error("[trail] Archive failed:", e);
  }
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(
    `EMOTA trail server http://127.0.0.1:${PORT} (Socket.IO /socket.io, max ${MULTIPLAYER_CAP} players)`,
  );
  console.log(`  Bigboard (projector): http://127.0.0.1:${PORT}/bigboard`);
  console.log(`  Event sign (QR):      http://127.0.0.1:${PORT}/join`);
  console.log(`  Short play link:      http://127.0.0.1:${PORT}/play`);
  console.log(`  Trail data dir: ${getTrailDataDir()}`);
  console.log(
    `  Harden: room coalesce ${ROOM_BROADCAST_MS}ms, persist debounce ${PERSIST_DEBOUNCE_MS}ms, max sockets ${MAX_SOCKETS}`,
  );
  if (ADMIN_TOKEN) {
    console.log(`  Admin: set header X-Emota-Admin or ?token= on /trail/admin/*`);
  } else {
    console.log(`  Admin: disabled — set EMOTA_TRAIL_ADMIN_TOKEN to purge/archive tools`);
  }
});
