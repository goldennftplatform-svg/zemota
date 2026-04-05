import { io, type Socket } from "socket.io-client";
import { MULTIPLAYER_CAP } from "../game/config";
import type { TrailFeedEvent, TrailPeer } from "./trailProtocol";
import { EMOTA_SOCKET_BASE } from "./socketClientOpts";
import { resolveTrailOrigin } from "./socketUrl";

export type { TrailPeer, TrailFeedEvent };

const LS_NAME = "emota_display_name";

export function getDisplayName(): string {
  return (
    localStorage.getItem(LS_NAME) ||
    `Traveler-${Math.floor(Math.random() * 9000 + 1000)}`
  );
}

export function setDisplayName(n: string): void {
  localStorage.setItem(LS_NAME, n.slice(0, 24));
}

export interface TrailUpdateExtras {
  alive?: number;
  landmark?: string;
  phase?: string;
}

export class TrailMultiplayer {
  private socket: Socket | null = null;
  private onPeers: (peers: TrailPeer[]) => void;
  private onScores: (rows: { name: string; score: number; at: string }[]) => void;
  private onStatus: (msg: string) => void;

  constructor(
    onPeers: (peers: TrailPeer[]) => void,
    onScores: (rows: { name: string; score: number; at: string }[]) => void,
    onStatus: (msg: string) => void,
  ) {
    this.onPeers = onPeers;
    this.onScores = onScores;
    this.onStatus = onStatus;
  }

  async connect(): Promise<void> {
    if (this.socket?.connected) return;
    const origin = await resolveTrailOrigin();
    this.onStatus(
      origin ? `Connecting to trail server…` : "Connecting to local trail server…",
    );
    const opts = {
      ...EMOTA_SOCKET_BASE,
      reconnectionAttempts: 5,
    };
    const s = origin ? io(origin, opts) : io(opts);
    this.socket = s;

    s.on("connect", () => {
      this.onStatus("Trail room connected (max " + MULTIPLAYER_CAP + " players).");
      s.emit("trail:hello", { displayName: getDisplayName() });
    });

    s.on("trail:room", (peers: TrailPeer[]) => this.onPeers(peers ?? []));
    s.on("scores:list", (rows) => this.onScores(rows ?? []));
    s.on("connect_error", () => {
      this.onStatus("Offline mode — start `npm run server` to see other travelers.");
      this.onPeers([]);
    });
    s.on("disconnect", () => {
      this.onStatus("Disconnected from trail server.");
    });
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
  }
}
