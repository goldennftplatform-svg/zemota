import { io, type Socket } from "socket.io-client";
import { getTravelerNumber } from "../game/playerNumber";
import type { TrailFeedEvent, TrailPeer, TrailPeerPartyRow } from "./trailProtocol";
import { EMOTA_SOCKET_BASE } from "./socketClientOpts";
import { clearStoredTrailOrigin, resolveTrailOrigin } from "./socketUrl";
import { sanitizeScoreRows, sanitizeTrailPeers } from "./trailSanitize";

export type { TrailPeer, TrailFeedEvent, TrailPeerPartyRow };

export type TrailConnectionState = "connecting" | "live" | "solo" | "dropped";

const LS_NAME = "emota_display_name";
const LS_CLIENT = "emota_trail_client_id";

/** Client emit floors (server enforces tighter floors too). */
const CLIENT_UPDATE_MS = 2000;
const CLIENT_EVENT_MS = 1000;

/** Stable id across refreshes so the trail server can drop duplicate ghost peers. */
export function getTrailClientId(): string {
  try {
    let id = localStorage.getItem(LS_CLIENT);
    if (!id || id.length < 8) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(LS_CLIENT, id);
    }
    return id.slice(0, 36);
  } catch {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function getDisplayName(): string {
  try {
    const raw = localStorage.getItem(LS_NAME);
    const saved = raw?.trim() ?? "";
    if (saved) {
      if (/^Traveler-\d{4}$/i.test(saved)) {
        const migrated = `Party ${getTravelerNumber()}`.slice(0, 24);
        localStorage.setItem(LS_NAME, migrated);
        return migrated;
      }
      return saved.slice(0, 24);
    }
    const d = `Party ${getTravelerNumber()}`.slice(0, 24);
    localStorage.setItem(LS_NAME, d);
    return d;
  } catch {
    return `Party ${getTravelerNumber()}`.slice(0, 24);
  }
}

export function setDisplayName(n: string): void {
  localStorage.setItem(LS_NAME, n.slice(0, 24));
}

export interface TrailUpdateExtras {
  alive?: number;
  landmark?: string;
  phase?: string;
  partyCap?: number;
  profileTitle?: string;
  party?: TrailPeerPartyRow[];
}

export class TrailMultiplayer {
  private socket: Socket | null = null;
  private onPeers: (peers: TrailPeer[]) => void;
  private onScores: (rows: { name: string; score: number; at: string }[]) => void;
  private onConnection: (state: TrailConnectionState, detail: string) => void;
  private live = false;
  private trailFull = false;
  private lastUpdateAt = 0;
  private lastEventAt = 0;
  private pendingUpdate: {
    miles: number;
    day: number;
    extras?: TrailUpdateExtras;
  } | null = null;
  private updateFlushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    onPeers: (peers: TrailPeer[]) => void,
    onScores: (rows: { name: string; score: number; at: string }[]) => void,
    onConnection: (state: TrailConnectionState, detail: string) => void,
  ) {
    this.onPeers = onPeers;
    this.onScores = onScores;
    this.onConnection = onConnection;
  }

  isLive(): boolean {
    return this.live;
  }

  async connect(): Promise<void> {
    if (this.socket?.connected) return;
    await this.openSocket(false);
  }

  private async openSocket(retriedAfterClear: boolean): Promise<void> {
    this.onConnection("connecting", "Connecting to the live trail…");
    const origin = await resolveTrailOrigin();
    const opts = {
      ...EMOTA_SOCKET_BASE,
      reconnectionAttempts: this.trailFull ? 2 : 8,
      reconnectionDelay: this.trailFull ? 8_000 : 1000,
      autoConnect: false as const,
    };
    const s = origin ? io(origin, opts) : io(opts);
    this.socket = s;

    s.on("connect", () => {
      if (this.trailFull) {
        this.live = false;
        this.onConnection(
          "solo",
          "The live trail is full right now — playing on this phone only.",
        );
        this.onPeers([]);
        s.disconnect();
        return;
      }
      this.live = true;
      this.onConnection("live", "Your wagon is on the live trail.");
      s.emit("trail:hello", { displayName: getDisplayName(), clientId: getTrailClientId() });
    });

    s.on("trail:error", (payload: unknown) => {
      const msg =
        payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message?: unknown }).message ?? "")
          : "";
      if (/full|busy/i.test(msg)) {
        this.trailFull = true;
        this.live = false;
        this.onConnection(
          "solo",
          msg || "The live trail is full right now — playing on this phone only.",
        );
        this.onPeers([]);
        s.io.opts.reconnection = false;
        s.disconnect();
        window.setTimeout(() => {
          this.trailFull = false;
        }, 60_000);
      }
    });

    s.on("trail:room", (peers: unknown) => this.onPeers(sanitizeTrailPeers(peers)));
    s.on("scores:list", (rows: unknown) => this.onScores(sanitizeScoreRows(rows)));
    s.on("connect_error", () => {
      if (!retriedAfterClear && !this.trailFull) {
        clearStoredTrailOrigin();
        s.removeAllListeners();
        s.disconnect();
        this.socket = null;
        void this.openSocket(true);
        return;
      }
      this.live = false;
      this.onConnection(
        "solo",
        "Playing on this phone only — the big screen cannot see your wagon yet.",
      );
      this.onPeers([]);
    });
    s.on("disconnect", () => {
      this.live = false;
      if (!this.trailFull) {
        this.onConnection("dropped", "Live trail paused — trying to reconnect…");
      }
    });

    s.connect();
  }

  private flushUpdate(): void {
    this.updateFlushTimer = null;
    const pending = this.pendingUpdate;
    if (!pending || !this.socket?.connected) return;
    this.pendingUpdate = null;
    this.lastUpdateAt = Date.now();
    this.socket.emit("trail:update", {
      displayName: getDisplayName(),
      miles: pending.miles,
      day: pending.day,
      ...pending.extras,
    });
  }

  updateProgress(miles: number, day: number, extras?: TrailUpdateExtras): void {
    if (!Number.isFinite(miles) || !Number.isFinite(day)) return;
    this.pendingUpdate = { miles, day, extras };
    const elapsed = Date.now() - this.lastUpdateAt;
    if (elapsed >= CLIENT_UPDATE_MS) {
      if (this.updateFlushTimer) {
        clearTimeout(this.updateFlushTimer);
        this.updateFlushTimer = null;
      }
      this.flushUpdate();
      return;
    }
    if (!this.updateFlushTimer) {
      this.updateFlushTimer = setTimeout(() => this.flushUpdate(), CLIENT_UPDATE_MS - elapsed);
    }
  }

  emitTrailEvent(payload: {
    kind: string;
    text: string;
    miles?: number;
    day?: number;
  }): void {
    const now = Date.now();
    if (now - this.lastEventAt < CLIENT_EVENT_MS) return;
    this.lastEventAt = now;
    this.socket?.emit("trail:event", {
      kind: String(payload.kind ?? "system").slice(0, 32),
      text: String(payload.text ?? "").slice(0, 280),
      miles: payload.miles,
      day: payload.day,
    });
  }

  submitScore(name: string, score: number, meta?: Record<string, unknown>): void {
    if (!Number.isFinite(score)) return;
    let safeMeta: Record<string, unknown> | undefined;
    if (meta) {
      try {
        const s = JSON.stringify(meta);
        if (s.length <= 256) safeMeta = JSON.parse(s) as Record<string, unknown>;
      } catch {
        safeMeta = undefined;
      }
    }
    this.socket?.emit("scores:submit", { name: name.slice(0, 40), score, meta: safeMeta });
  }

  disconnect(): void {
    if (this.updateFlushTimer) {
      clearTimeout(this.updateFlushTimer);
      this.updateFlushTimer = null;
    }
    this.socket?.disconnect();
    this.socket = null;
    this.live = false;
  }
}
