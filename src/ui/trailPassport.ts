import { LANDMARKS } from "../game/map";
import { wagonBadge } from "./wagonIdentity";
import type { WagonIdentity } from "../game/wagonIdentity";

/** Mileage is monotonic within a run and already saved, including pre-passport saves. */
export function passportStops(miles: number) {
  return LANDMARKS.map((landmark) => ({ ...landmark, earned: Number.isFinite(miles) && miles >= landmark.milesFromStart }));
}

export function showTrailPassport(miles: number, identity: WagonIdentity, escape: (s: string) => string): void {
  const stops = passportStops(miles);
  const dialog = document.createElement("dialog");
  dialog.className = "trail-passport";
  dialog.setAttribute("aria-labelledby", "passport-title");
  dialog.innerHTML = `<form method="dialog"><button class="run-tool-btn" aria-label="Close passport">Close</button></form>
    <header>${wagonBadge(identity)}<div><p class="passport-kicker">EMOTA / Field record</p><h2 id="passport-title">Trail Passport</h2><p>${stops.filter((s) => s.earned).length} / ${stops.length} stamps earned</p></div></header>
    <p>Stamps record places reached on this run. River stamps mark arrival, not a successful crossing.</p>
    <ol>${stops.map((s, i) => `<li class="passport-stop ${s.earned ? "is-earned" : "is-unvisited"}"><span class="passport-stamp" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><div><small>${s.earned ? "STAMPED" : "NOT YET VISITED"} / ${s.milesFromStart} mi</small><h3>${escape(s.name)}</h3><p>${escape(s.blurb)}</p></div></li>`).join("")}</ol>`;
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.showModal();
}
