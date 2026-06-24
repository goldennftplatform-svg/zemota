import { io, type Socket } from "socket.io-client";
import { getTravelerNumber } from "../game/playerNumber";
import type { TrailFeedEvent, TrailPeer, TrailPeerPartyRow } from "./trailProtocol";
import { EMOTA_SOCKET_BASE } from "./socketClientOpts";
import { clearStoredTrailOrigin, resolveTrailOrigin } from "./socketUrl";

export type { TrailPeer, TrailFeedEvent, TrailPeerPartyRow };

export type TrailConnectionState = "connecting" | "live" | "solo" | "dropped";

const LS_NAME = "emota_display_name";
const LS_CLIENT = "emota_trail_client_id";

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
      reconnectionAttempts: 8,
      autoConnect: false as const,
    };
    const s = origin ? io(origin, opts) : io(opts);
    this.socket = s;

    s.on("connect", () => {
      this.live = true;
      this.onConnection("live", "Your wagon is on the live trail.");
      s.emit("trail:hello", { displayName: getDisplayName(), clientId: getTrailClientId() });
    });

    s.on("trail:room", (peers: TrailPeer[]) => this.onPeers(peers ?? []));
    s.on("scores:list", (rows) => this.onScores(rows ?? []));
    s.on("connect_error", () => {
      if (!retriedAfterClear) {
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
      this.onConnection("dropped", "Live trail paused — trying to reconnect…");
    });

    s.connect();
  }

  updateProgress(miles: number, day: number, extras?: TrailUpdateExtras): void {
    this.socket?.emit("trail:update", {
      displayName: getDisplayName(),
      miles,
      day,
      ...extras,
    });
  }

  emitTrailEvent(payload: {
    kind: string;
    text: string;
    miles?: number;
    day?: number;
  }): void {
    this.socket?.emit("trail:event", payload);
  }

  submitScore(name: string, score: number, meta?: Record<string, unknown>): void {
    this.socket?.emit("scores:submit", { name, score, meta });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.live = false;
  }
}
