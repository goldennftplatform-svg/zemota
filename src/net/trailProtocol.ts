/** Shared types for trail server ↔ clients (game + bigboard). */
import type { WagonIdentity } from "../game/wagonIdentity";

export type TrailFeedKind =
  | "death"
  | "milestone"
  | "victory"
  | "wipeout"
  | "river"
  | "system";

export interface TrailFeedEvent {
  id: string;
  /** Server-generated socket peer ID; stable for the connection. Absent in legacy persisted feed. */
  sourcePeerId?: string;
  at: string;
  kind: TrailFeedKind | string;
  displayName: string;
  text: string;
  miles?: number;
  day?: number;
}

export function trailFeedSourceKey(ev: Pick<TrailFeedEvent, "sourcePeerId" | "displayName">): string {
  return ev.sourcePeerId ? `peer:${ev.sourcePeerId}` : `legacy-name:${ev.displayName}`;
}

/** One party member as broadcast on the trail room (for LAN deep-dive). */
export interface TrailPeerPartyRow {
  name: string;
  health: number;
  alive: boolean;
}

export interface TrailPeer {
  identity?: WagonIdentity;
  id: string;
  displayName: string;
  miles: number;
  day: number;
  alive?: number;
  landmark?: string;
  phase?: string;
  partyCap?: number;
  profileTitle?: string;
  party?: TrailPeerPartyRow[];
}
