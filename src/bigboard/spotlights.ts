import type { TrailFeedEvent } from "../net/trailProtocol";
import { trailFeedSourceKey } from "../net/trailProtocol";

export const SPOTLIGHT_QUEUE_MAX = 4;
export const SPOTLIGHT_COOLDOWN_MS = 30_000;
export const SPOTLIGHT_MAX_AGE_MS = 30_000;

/** FIFO across wagons; one place per wagon, bounded memory, no sync replay. */
export class SpotlightQueue {
  private seen = new Set<string>();
  private recent = new Map<string, number>();
  private queue: TrailFeedEvent[] = [];
  remember(ev: TrailFeedEvent): boolean {
    const key = `${trailFeedSourceKey(ev)}|${ev.kind}|${ev.day}|${Math.floor(ev.miles ?? 0)}|${ev.text}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    if (this.seen.size > 400) this.seen.delete(this.seen.values().next().value!);
    return true;
  }
  add(ev: TrailFeedEvent, now = Date.now()): boolean {
    if (!this.remember(ev)) return false;
    const at = Date.parse(ev.at);
    if (!Number.isFinite(at) || now - at > SPOTLIGHT_MAX_AGE_MS || at > now + 5000) return false;
    if (!["death", "wipeout", "victory", "milestone"].includes(ev.kind)) return false;
    const source = trailFeedSourceKey(ev);
    if (this.queue.length >= SPOTLIGHT_QUEUE_MAX || this.queue.some((e) => trailFeedSourceKey(e) === source)) return false;
    if (now - (this.recent.get(source) ?? -Infinity) < SPOTLIGHT_COOLDOWN_MS) return false;
    this.recent.delete(source);
    this.recent.set(source, now);
    if (this.recent.size > 140) this.recent.delete(this.recent.keys().next().value!);
    this.queue.push(ev);
    return true;
  }
  next(now = Date.now()): TrailFeedEvent | undefined {
    let ev: TrailFeedEvent | undefined;
    while ((ev = this.queue.shift())) if (now - Date.parse(ev.at) <= SPOTLIGHT_MAX_AGE_MS) return ev;
  }
  clearPending(): void { this.queue = []; }
}
