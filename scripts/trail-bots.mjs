#!/usr/bin/env node
/**
 * EMOTA — fake wagons on the trail Socket.IO server (no browser, no Playwright).
 * Simulating players does **not** require Vercel or any cloud env — only your Node trail server.
 *
 * ### Local workload on the bigboard (no Vercel, no extra tabs)
 *   npm run build && npm run server
 *   Open http://127.0.0.1:3333/bigboard
 *   npm run trail:bots:local -- --count=30
 *
 * Bots and bigboard both talk to `127.0.0.1:3333` — same room, wagons show on the wall.
 *
 * ### Tunnel (trail server public, still no Vercel)
 *   npm run trail:bots -- --origin=https://YOUR-TUNNEL --count=40
 * Bigboard URL must use the same trail origin (`?trail=` on the page if needed).
 *
 * ### Only if you host the static site on Vercel
 * Then the built app needs `VITE_TRAIL_SERVER_URL` (or `?trail=`) so the browser finds Socket.IO.
 * Optional: `npm run trail:bots -- --site=https://YOUR-APP.vercel.app` reads deployed `/trail.json`.
 *
 * Env: TRAIL_ORIGIN, TRAIL_BOT_COUNT, EMOTA_SITE, TRAIL_BOT_INTERVAL_MS (ms between pulses)
 * Default interval ~2.4s so the wall reads like travel + losses, not a blur. `--interval-ms=600` for a hot room.
 * Ctrl+C disconnects all bots. Optional: --minutes=2 to auto-stop.
 */

import { io } from "socket.io-client";

/** Keep in sync with src/game/config.ts MULTIPLAYER_CAP */
const CAP = 100;

const LANDMARKS = [
  "Independence",
  "Kansas River",
  "Fort Kearny",
  "Chimney Rock",
  "Fort Laramie",
  "South Pass",
  "Fort Boise",
  "The Dalles",
];

/** ~2.4s between updates — readable on the bigboard; use --interval-ms=600 to stress the room. */
const DEFAULT_INTERVAL_MS = 2400;

function parseArgs() {
  let origin = (process.env.TRAIL_ORIGIN || "").trim().replace(/\/$/, "");
  let site = (process.env.EMOTA_SITE || "").trim().replace(/\/$/, "");
  let count = parseInt(process.env.TRAIL_BOT_COUNT || "20", 10);
  let minutes = 0;
  let intervalMs = parseInt(process.env.TRAIL_BOT_INTERVAL_MS || String(DEFAULT_INTERVAL_MS), 10);
  if (!Number.isFinite(intervalMs) || intervalMs < 1) intervalMs = DEFAULT_INTERVAL_MS;

  for (const a of process.argv.slice(2)) {
    if (a === "--help" || a === "-h") return { help: true };
    if (a.startsWith("--origin=")) origin = a.slice(9).trim().replace(/\/$/, "");
    else if (a.startsWith("--site=")) site = a.slice(7).trim().replace(/\/$/, "");
    else if (a.startsWith("--count=")) count = parseInt(a.slice(8), 10) || 20;
    else if (a.startsWith("--minutes=")) minutes = parseFloat(a.slice(10)) || 0;
    else if (a.startsWith("--interval-ms=")) {
      const n = parseInt(a.slice(14), 10);
      if (Number.isFinite(n) && n >= 400) intervalMs = n;
    }
  }
  intervalMs = Math.min(120_000, Math.max(400, intervalMs));
  return {
    origin,
    site,
    count: Math.min(CAP, Math.max(1, count)),
    minutes,
    intervalMs,
    help: false,
  };
}

function partyRows(alive) {
  return [
    { name: "Rider", health: 80, alive: alive >= 1 },
    { name: "Scout", health: 72, alive: alive >= 2 },
    { name: "Cook", health: 64, alive: alive >= 3 },
    { name: "Smith", health: 56, alive: alive >= 4 },
    { name: "Doc", health: 48, alive: alive >= 5 },
  ];
}

async function resolveTrailOriginFromSite(siteBase) {
  const base = siteBase.replace(/\/$/, "");
  const url = `${base}/trail.json`;
  const r = await fetch(url, { redirect: "follow", cache: "no-store" });
  if (!r.ok) {
    throw new Error(`GET ${url} → HTTP ${r.status} (is the site URL correct?)`);
  }
  const j = await r.json();
  const o = String(j?.origin ?? "")
    .trim()
    .replace(/\/$/, "");
  if (!o) {
    throw new Error(
      `${url} has no usable "origin". Set Vercel env VITE_TRAIL_SERVER_URL and redeploy, ` +
        `or put your tunnel URL in public/trail.json as { "origin": "https://…" } and redeploy.`,
    );
  }
  return o;
}

function warnIfVercelAppSocket(origin) {
  try {
    const u = new URL(origin);
    if (/\.vercel\.app$/i.test(u.hostname)) {
      console.warn(
        "\n⚠️  --origin points at vercel.app. EMOTA’s Socket.IO server runs on your Node trail host `npm run server`, " +
          "not on Vercel static hosting. Use your tunnel URL, or `--site=https://your-app.vercel.app` so we read trail.json.\n",
      );
    }
  } catch {
    /* ignore */
  }
}

const { origin: originArg, site, count, minutes, intervalMs, help } = parseArgs();

if (help) {
  console.log(`trail-bots.mjs — Socket.IO bots for EMOTA trail server / bigboard

  Typical local run (no Vercel):
    npm run build && npm run server
    http://127.0.0.1:3333/bigboard
    npm run trail:bots:local -- --count=30

  --origin=URL   Trail server root (tunnel or http://127.0.0.1:3333) — same as bigboard LIVE · SOCKET
  --site=URL     Optional: static deploy root — fetches …/trail.json (only needed for some Vercel flows)
  --count=N         Wagons (1–${CAP}, default 20 or TRAIL_BOT_COUNT)
  --interval-ms=N   Ms between pulses (default ${DEFAULT_INTERVAL_MS} — gameplay-ish; 600 = hot room)
  --minutes=M       Auto-exit after M minutes (optional)

  Env: TRAIL_ORIGIN, TRAIL_BOT_COUNT, EMOTA_SITE, TRAIL_BOT_INTERVAL_MS`);
  process.exit(0);
}

const clients = [];

function shutdown(code = 0) {
  if (clients.length === 0) process.exit(code);
  console.log("\nStopping bots…");
  for (const { socket, tick } of clients) {
    try {
      clearInterval(tick);
    } catch {
      /* ignore */
    }
    try {
      socket.disconnect();
    } catch {
      /* ignore */
    }
  }
  clients.length = 0;
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main() {
  let origin = originArg;
  if (!origin && site) {
    try {
      origin = await resolveTrailOriginFromSite(site);
      console.log(`Resolved trail server from ${site}/trail.json → ${origin}`);
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  }

  if (!origin) {
    console.error(
      "Error: set where to connect the bots (no Vercel required for local sim):\n" +
        "  npm run trail:bots:local -- --count=30\n" +
        "    → needs `npm run build && npm run server` and bigboard at http://127.0.0.1:3333/bigboard\n" +
        "  or --origin=https://YOUR-TUNNEL   (same trail host as the bigboard)\n" +
        "  or --site / EMOTA_SITE only if you use a deployed static site’s /trail.json\n",
    );
    process.exit(1);
  }

  warnIfVercelAppSocket(origin);

  console.log(`Trail bots: ${count} → ${origin}  (cap ${CAP}, pulse every ${intervalMs}ms)`);
  try {
    const u = new URL(origin);
    const local =
      u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "::1";
    if (local) {
      const base = `${u.protocol}//${u.host}`;
      console.log(`Bigboard: ${base}/bigboard  ·  Ctrl+C stops bots` + (minutes > 0 ? ` · auto-stop in ${minutes}m` : ""));
    } else {
      console.log("Bigboard: same trail origin as above (use ?trail= if the page is on another host) · Ctrl+C stops bots" + (minutes > 0 ? ` · auto-stop in ${minutes}m` : ""));
    }
  } catch {
    console.log("Ctrl+C stops bots" + (minutes > 0 ? ` · auto-stop in ${minutes}m` : ""));
  }

  for (let i = 0; i < count; i++) {
    const displayName = `Bot-${String(1000 + i).slice(-4)}`;
    const clientId = `node-bot-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`.slice(0, 36);

    const socket = io(origin, {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      timeout: 25_000,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect_error", (err) => {
      console.error(`[${displayName}] connect_error:`, err?.message || err);
    });

    socket.on("trail:error", (msg) => {
      console.error(`[${displayName}]`, msg);
    });

    socket.on("connect", () => {
      socket.emit("trail:hello", { displayName, clientId });
      let step = 0;
      let prevAlive = 5;
      let victorySent = false;
      let wipeoutSent = false;

      const pulse = () => {
        step++;
        const miles = Math.min(1990, ((step * 11 + i * 47) % 2400) * 0.85);
        const day = 1 + Math.min(70, Math.floor(step / 4) + (i % 8));
        const landmark = LANDMARKS[step % LANDMARKS.length];
        const alive = Math.max(1, 5 - Math.floor((step + i * 13) / 42) % 4);

        if (prevAlive > alive) {
          const lost = prevAlive - alive;
          socket.emit("trail:event", {
            kind: "death",
            text:
              lost > 1
                ? `${displayName}: ${lost} lost near ${landmark}. ${alive}/5 press on.`
                : `${displayName}: a party member is lost near ${landmark}. ${alive}/5 remain.`,
            miles,
            day,
          });
        }

        if ((step + i * 5) % 31 === 0 && step > 2) {
          socket.emit("trail:event", {
            kind: "river",
            text: `${displayName} faces a crossing near ${landmark}.`,
            miles,
            day,
          });
        }

        if ((step + i * 2) % 11 === 0) {
          socket.emit("trail:event", {
            kind: "milestone",
            text: `${displayName} · ${Math.round(miles)} mi · ${landmark}`,
            miles,
            day,
          });
        }

        if (!victorySent && miles >= 1820 && (step + i) % 55 === 0) {
          victorySent = true;
          socket.emit("trail:event", {
            kind: "victory",
            text: `${displayName} finished the run! (sim)`,
            miles,
            day,
          });
        }

        if (!wipeoutSent && alive === 1 && step > 45 && (step + i) % 33 === 0 && Math.random() < 0.35) {
          wipeoutSent = true;
          socket.emit("trail:event", {
            kind: "wipeout",
            text: `${displayName}'s wagon company is lost to the trail.`,
            miles,
            day,
          });
        }

        if (wipeoutSent && step % 80 === 0) {
          wipeoutSent = false;
          victorySent = false;
        }

        socket.emit("trail:update", {
          displayName,
          miles,
          day,
          landmark,
          phase: step % 22 < 11 ? "travel_menu" : "trail_event",
          partyCap: 5,
          profileTitle: "Node sim",
          party: partyRows(alive),
        });

        if (step % 18 === 0) {
          socket.emit("scores:submit", {
            name: displayName,
            score: Math.floor(900 + miles + day * 3 + i * 7),
          });
        }

        prevAlive = alive;
      };

      pulse();
      const tick = setInterval(pulse, intervalMs);
      clients.push({ socket, tick });
    });
  }

  if (minutes > 0) {
    setTimeout(() => {
      console.log(`Timer: ${minutes}m elapsed.`);
      shutdown(0);
    }, minutes * 60_000);
  }

  setTimeout(async () => {
    try {
      const r = await fetch(`${origin}/health`, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      if (typeof j?.peers === "number") {
        console.log(`Trail /health: ${j.peers} peer(s) on server (expect ~${count} after all bots connect).`);
      }
    } catch {
      /* ignore */
    }
  }, 2500);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
