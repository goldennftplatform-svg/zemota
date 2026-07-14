/** Client-side clamps for trail room / feed payloads (bot-tolerant display). */

import { MAX_PARTY, MULTIPLAYER_CAP, TOTAL_TRAIL_MILES } from "../game/config";
import type { TrailFeedEvent, TrailPeer, TrailPeerPartyRow } from "./trailProtocol";

function finiteMiles(n: unknown, fallback = 0): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(TOTAL_TRAIL_MILES, x));
}

function finiteDay(n: unknown, fallback = 1): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(1, Math.min(999, Math.floor(x)));
}

function sanitizeParty(raw: unknown): TrailPeerPartyRow[] | undefined {
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
  return out.length ? out : undefined;
}

export function sanitizeTrailPeers(list: unknown): TrailPeer[] {
  if (!Array.isArray(list)) return [];
  const out: TrailPeer[] = [];
  for (const row of list.slice(0, MULTIPLAYER_CAP)) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id ?? "").slice(0, 64);
    if (!id) continue;
    const peer: TrailPeer = {
      id,
      displayName: String(r.displayName ?? "Traveler").slice(0, 24),
      miles: finiteMiles(r.miles),
      day: finiteDay(r.day),
    };
    if (typeof r.alive === "number" && Number.isFinite(r.alive)) {
      peer.alive = Math.max(0, Math.min(10, Math.floor(r.alive)));
    }
    if (r.landmark !== undefined) peer.landmark = String(r.landmark ?? "").slice(0, 80);
    if (r.phase !== undefined) peer.phase = String(r.phase ?? "").slice(0, 40);
    if (typeof r.partyCap === "number" && Number.isFinite(r.partyCap)) {
      peer.partyCap = Math.max(1, Math.min(10, Math.floor(r.partyCap)));
    }
    if (r.profileTitle !== undefined) peer.profileTitle = String(r.profileTitle ?? "").slice(0, 48);
    const party = sanitizeParty(r.party);
    if (party) peer.party = party;
    out.push(peer);
  }
  return out;
}

export function sanitizeTrailFeedList(list: unknown): TrailFeedEvent[] {
  if (!Array.isArray(list)) return [];
  const out: TrailFeedEvent[] = [];
  for (const row of list.slice(0, 200)) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id ?? "").slice(0, 64);
    const text = String(r.text ?? "").slice(0, 280);
    if (!id || !text.trim()) continue;
    const miles = Number(r.miles);
    const day = Number(r.day);
    out.push({
      id,
      at: String(r.at ?? ""),
      kind: String(r.kind ?? "system").slice(0, 32),
      displayName: String(r.displayName ?? "").slice(0, 40),
      text,
      miles: Number.isFinite(miles) ? finiteMiles(miles) : undefined,
      day: Number.isFinite(day) ? finiteDay(day) : undefined,
    });
  }
  return out;
}

export function sanitizeScoreRows(
  list: unknown,
): { name: string; score: number; at: string }[] {
  if (!Array.isArray(list)) return [];
  const out: { name: string; score: number; at: string }[] = [];
  for (const row of list.slice(0, 100)) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? "").slice(0, 40);
    const score = Number(r.score);
    const at = String(r.at ?? "");
    if (!name || !Number.isFinite(score)) continue;
    out.push({ name, score, at });
  }
  return out;
}
