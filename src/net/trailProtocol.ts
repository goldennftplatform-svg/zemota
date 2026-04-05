/** Shared types for trail server ↔ clients (game + bigboard). */

export type TrailFeedKind =
  | "death"
  | "milestone"
  | "victory"
  | "wipeout"
  | "river"
  | "system";

export interface TrailFeedEvent {
  id: string;
  at: string;
  kind: TrailFeedKind | string;
  displayName: string;
  text: string;
  miles?: number;
  day?: number;
}

export interface TrailPeer {
  id: string;
  displayName: string;
  miles: number;
  day: number;
  alive?: number;
  landmark?: string;
  phase?: string;
}
