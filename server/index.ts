import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import type { TrailFeedEvent, TrailPeer } from "../src/net/trailProtocol";
import { MULTIPLAYER_CAP } from "../src/game/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? process.env.TRAIL_SERVER_PORT) || 3333;

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  // Allow Vercel + tunnel origins; credentials off matches default Socket.IO client (no cookies).
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
};
const peers = new Map<string, Peer>();

type ScoreRow = { name: string; score: number; at: string; meta?: unknown };
let scores: ScoreRow[] = [];

const FEED_CAP = 200;
const feed: TrailFeedEvent[] = [];

function roomSnapshotList(): TrailPeer[] {
  return [...peers.entries()].map(([id, v]) => ({
    id,
    displayName: v.displayName,
    miles: v.miles,
    day: v.day,
    alive: v.alive,
    landmark: v.landmark,
    phase: v.phase,
  }));
}

function broadcastRoom(): void {
  io.emit("trail:room", roomSnapshotList());
}

function pushFeed(ev: TrailFeedEvent): void {
  feed.push(ev);
  if (feed.length > FEED_CAP) feed.splice(0, feed.length - FEED_CAP);
  io.emit("trail:feed:append", ev);
}

const distDir = path.join(__dirname, "../dist");
app.use(express.static(distDir));

app.get("/bigboard", (_req, res) => {
  res.sendFile(path.join(distDir, "bigboard.html"));
});

io.on("connection", (socket) => {
  socket.emit("scores:list", scores);
  socket.emit("trail:feed:sync", feed.slice(-120));
  /** So bigboard / late clients see wagons already on the trail */
  socket.emit("trail:room", roomSnapshotList());

  socket.on("trail:hello", (payload: { displayName?: string }) => {
    if (peers.size >= MULTIPLAYER_CAP) {
      socket.emit("trail:error", { message: `Room full (${MULTIPLAYER_CAP} travelers max).` });
      socket.disconnect(true);
      return;
    }
    const displayName = String(payload?.displayName ?? "Traveler").slice(0, 24);
    peers.set(socket.id, { displayName, miles: 0, day: 1 });
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

httpServer.listen(PORT, () => {
  console.log(
    `EMOTA trail server http://127.0.0.1:${PORT} (Socket.IO /socket.io, max ${MULTIPLAYER_CAP} players)`,
  );
  console.log(`  Bigboard (projector): http://127.0.0.1:${PORT}/bigboard`);
});
