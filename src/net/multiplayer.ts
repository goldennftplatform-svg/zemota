import { io, type Socket } from "socket.io-client";
import type { TrailFeedEvent, TrailPeer, TrailPeerPartyRow } from "./trailProtocol";
import { EMOTA_SOCKET_BASE } from "./socketClientOpts";
import { resolveTrailOrigin } from "./socketUrl";

export type { TrailPeer, TrailFeedEvent, TrailPeerPartyRow };

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
  partyCap?: number;
  profileTitle?: string;
  party?: TrailPeerPartyRow[];
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
    this.onStatus("Connecting…");
    const opts = {
      ...EMOTA_SOCKET_BASE,
      reconnectionAttempts: 5,
    };
    const s = origin ? io(origin, opts) : io(opts);
    this.socket = s;

    s.on("connect", () => {
      this.onStatus("Live — other parties can be on the trail with you.");
      s.emit("trail:hello", { displayName: getDisplayName(), clientId: getTrailClientId() });
    });

    s.on("trail:room", (peers: TrailPeer[]) => this.onPeers(peers ?? []));
    s.on("scores:list", (rows) => this.onScores(rows ?? []));
    s.on("connect_error", () => {
      this.onStatus("Solo for now — other parties aren’t available.");
      this.onPeers([]);
    });
    s.on("disconnect", () => {
      this.onStatus("Connection dropped — you’re on your own until it returns.");
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
