import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import type { TrailFeedEvent, TrailPeer } from "../src/net/trailProtocol";
import { MAX_PARTY, MULTIPLAYER_CAP } from "../src/game/config";
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

const app = express();
app.use(express.json({ limit: "512kb" }));
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: true, credentials: false, methods: ["GET", "POST"] },
  path: "/socket.io",
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
const peers = new Map<string, Peer>();

type ScoreRow = PersistedScore;
let scores: ScoreRow[] = loadPersistedScores();

const FEED_CAP = 200;
let feed: TrailFeedEvent[] = loadPersistedFeed();
if (feed.length > FEED_CAP) feed = feed.slice(-FEED_CAP);

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

function broadcastRoom(): void {
  io.emit("trail:room", roomSnapshotList());
}

function pushFeed(ev: TrailFeedEvent): void {
  feed.push(ev);
  if (feed.length > FEED_CAP) feed.splice(0, feed.length - FEED_CAP);
  persistFeed(feed);
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
  persistScores(scores);
  persistFeed(feed);
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
  persistScores(scores);
  persistFeed(feed);
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
    archiveFiles: listArchiveFiles().length,
    adminEnabled: true,
  });
});

const distDir = path.join(__dirname, "../dist");
app.use(express.static(distDir));

app.get("/bigboard", (_req, res) => {
  res.sendFile(path.join(distDir, "bigboard.html"));
});

io.on("connection", (socket) => {
  socket.emit("scores:list", scores);
  socket.emit("trail:feed:sync", feed.slice(-120));
  socket.emit("trail:room", roomSnapshotList());

  socket.on("trail:hello", (payload: { displayName?: string; clientId?: string }) => {
    const displayName = String(payload?.displayName ?? "Traveler").slice(0, 24);
    const clientId = String(payload?.clientId ?? socket.id).slice(0, 36) || socket.id;
    removePeersWithClientId(clientId);
    if (peers.size >= MULTIPLAYER_CAP) {
      socket.emit("trail:error", {
        message: "The trail is full right now. Try again in a few minutes.",
      });
      socket.disconnect(true);
      return;
    }
    peers.set(socket.id, { displayName, miles: 0, day: 1, clientId });
    broadcastRoom();
  });

  socket.on(
    "trail:update",
    (payload: {
      displayName?: string;
      miles?: number;
      day?: number;
      alive?: number;
      landmark?: string;
      phase?: string;
      partyCap?: number;
      profileTitle?: string;
      party?: unknown;
    }) => {
      const p = peers.get(socket.id);
      if (!p) return;
      if (payload.displayName) p.displayName = String(payload.displayName).slice(0, 24);
      if (typeof payload.miles === "number") p.miles = payload.miles;
      if (typeof payload.day === "number") p.day = payload.day;
      if (typeof payload.alive === "number" && Number.isFinite(payload.alive)) {
        p.alive = Math.max(0, Math.min(10, Math.floor(payload.alive)));
      }
      if (payload.landmark !== undefined)
        p.landmark = String(payload.landmark ?? "").slice(0, 80);
      if (payload.phase !== undefined) p.phase = String(payload.phase ?? "").slice(0, 40);
      if (typeof payload.partyCap === "number" && Number.isFinite(payload.partyCap)) {
        p.partyCap = Math.max(1, Math.min(10, Math.floor(payload.partyCap)));
      }
      if (payload.profileTitle !== undefined)
        p.profileTitle = String(payload.profileTitle ?? "").slice(0, 48);
      if (payload.party !== undefined) {
        const rows = sanitizePartyRows(payload.party);
        p.party = rows && rows.length > 0 ? rows : [];
      }
      broadcastRoom();
    },
  );

  socket.on("trail:event", (payload: unknown) => {
    const p = peers.get(socket.id);
    if (!p) return;
    const raw = payload as Record<string, unknown>;
    const kind = String(raw?.kind ?? "system").slice(0, 32);
    const text = String(raw?.text ?? "").slice(0, 280);
    if (!text.trim()) return;
    const ev: TrailFeedEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      at: new Date().toISOString(),
      kind,
      displayName: p.displayName,
      text,
      miles: typeof raw?.miles === "number" ? raw.miles : p.miles,
      day: typeof raw?.day === "number" ? raw.day : p.day,
    };
    pushFeed(ev);
  });

  socket.on(
    "scores:submit",
    (payload: { name?: string; score?: number; meta?: unknown }) => {
      const name = String(payload?.name ?? "Anonymous").slice(0, 40);
      const score = Number(payload?.score);
      if (!Number.isFinite(score)) return;
      scores.push({ name, score, at: new Date().toISOString(), meta: payload?.meta });
      scores.sort((a, b) => b.score - a.score);
      scores = scores.slice(0, 100);
      persistScores(scores);
      io.emit("scores:list", scores);
    },
  );

  socket.on("disconnect", () => {
    peers.delete(socket.id);
    broadcastRoom();
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, peers: peers.size, cap: MULTIPLAYER_CAP });
});

startPstDayRolloverWatcher((previousPstDay) => {
  try {
    writeDailyArchive(previousPstDay, scores, feed);
    pruneOldArchives();
    console.log(`[trail] Daily archive written for ${previousPstDay} (PST)`);
  } catch (e) {
    console.error("[trail] Archive failed:", e);
  }
});

httpServer.listen(PORT, () => {
  console.log(
    `EMOTA trail server http://127.0.0.1:${PORT} (Socket.IO /socket.io, max ${MULTIPLAYER_CAP} players)`,
  );
  console.log(`  Bigboard (projector): http://127.0.0.1:${PORT}/bigboard`);
  console.log(`  Trail data dir: ${getTrailDataDir()}`);
  if (ADMIN_TOKEN) {
    console.log(`  Admin: set header X-Emota-Admin or ?token= on /trail/admin/*`);
  } else {
    console.log(`  Admin: disabled — set EMOTA_TRAIL_ADMIN_TOKEN to purge/archive tools`);
  }
});
