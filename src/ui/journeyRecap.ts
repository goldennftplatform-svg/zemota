import { MEEKER_GIFT_SHOP_URL, MEEKER_MANSION_HISTORY_URL } from "../game/config";
import { renderMeekerSpriteHtml, startMeekerSpriteAnimations } from "./meekerSprites";
import "./../css/journey-recap.css";

export type JourneyRecapOutcome = "victory" | "game_over";

export interface JourneyRecapData {
  outcome: JourneyRecapOutcome;
  wagonName: string;
  score: number;
  day: number;
  miles: number;
  totalMiles: number;
  landmark: string;
  alive: number;
  partyCap: number;
  survivors: string[];
  fallen: { name: string; cause?: string }[];
  profileTitle: string;
  triviaCorrect: number;
  money: string;
  landTitle?: string;
  hopKing: boolean;
  stage2Archetype?: string;
  stage2Bonus: number;
}

const MIN_READ_MS = 4200;
const STAT_STAGGER_MS = 380;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function causeLabel(cause?: string): string {
  if (!cause) return "";
  return cause.replace(/_/g, " ");
}

/** Full-screen journey recap — sprite, stats, Hop King / Mansion gold. */
export function showJourneyRecap(data: JourneyRecapData): Promise<void> {
  return new Promise((resolve) => {
    const victory = data.outcome === "victory";
    const pct = Math.round((data.miles / Math.max(1, data.totalMiles)) * 100);
    const spriteHtml = victory
      ? data.hopKing
        ? renderMeekerSpriteHtml("hopKingYoung", {
            anim: "walk-west",
            size: "recap",
            label: "Young Hop King celebrates the trail",
          })
        : renderMeekerSpriteHtml("ezraElder", {
            anim: "idle-west",
            size: "recap",
            label: "Ezra Meeker on the Oregon Trail",
          })
      : renderMeekerSpriteHtml("ezraElder", {
            anim: "idle-west",
            size: "recap",
            label: "Wagon lost on the trail",
          });

    const headline = victory ? "You made hop country" : "The trail wins this time";
    const sub = victory
      ? `Score ${data.score} · ${data.wagonName || "Your wagon"}`
      : `Day ${data.day} · ${Math.round(data.miles)} mi · ${data.wagonName || "Your wagon"}`;

    const stats: string[] = [
      `${data.day} days on the trail · ${Math.round(data.miles)} of ${data.totalMiles} mi (${pct}%)`,
      `Last camp near ${data.landmark}`,
      `Leader: ${data.profileTitle} · Quiz ✓ ${data.triviaCorrect} · Cash ${data.money}`,
    ];
    if (victory && data.landTitle) stats.push(`Land claim: ${data.landTitle}`);
    if (data.hopKing) stats.push("Hop King path · Ezra’s Puyallup thread unlocked");
    if (victory && data.stage2Archetype)
      stats.push(`After Oregon: ${data.stage2Archetype} (+${data.stage2Bonus} pts)`);
    if (victory) stats.push(`Party alive: ${data.alive}/${data.partyCap}`);

    const survivorsHtml =
      data.survivors.length > 0
        ? `<p class="journey-recap__crew"><span class="journey-recap__crew-k">Still riding</span> ${escapeHtml(data.survivors.join(" · "))}</p>`
        : "";
    const fallenHtml =
      data.fallen.length > 0
        ? `<p class="journey-recap__crew journey-recap__crew--fallen"><span class="journey-recap__crew-k">Remember</span> ${escapeHtml(
            data.fallen
              .map((f) => (f.cause ? `${f.name} (${causeLabel(f.cause)})` : f.name))
              .join(" · "),
          )}</p>`
        : "";

    const statsHtml = stats
      .map(
        (line, i) =>
          `<li class="journey-recap__stat" style="--stat-i:${i}">${escapeHtml(line)}</li>`,
      )
      .join("");

    const el = document.createElement("div");
    el.className = `journey-recap journey-recap--${data.outcome}`;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "journey-recap-title");
    el.innerHTML = `
      <div class="journey-recap__vignette" aria-hidden="true"></div>
      <div class="journey-recap__scan" aria-hidden="true"></div>
      <div class="journey-recap__card">
        <figure class="journey-recap__hero">
          ${spriteHtml}
        </figure>
        <p class="journey-recap__brand">EMOTA · TRAIL RECAP</p>
        <h2 id="journey-recap-title" class="journey-recap__headline">${escapeHtml(headline)}</h2>
        <p class="journey-recap__sub">${escapeHtml(sub)}</p>
        <ul class="journey-recap__stats">${statsHtml}</ul>
        ${survivorsHtml}
        ${fallenHtml}
        <aside class="journey-recap__gold" style="--gold-delay:${stats.length * STAT_STAGGER_MS + 600}ms">
          <p class="journey-recap__gold-lead">Real history · real hops · Puyallup</p>
          <p class="journey-recap__gold-copy">Ezra Meeker rode west in 1852, became Hop King, built Meeker Mansion (1890), and saved the Oregon Trail from oblivion.</p>
          <div class="journey-recap__gold-links">
            <a class="journey-recap__link" href="${escapeAttr(MEEKER_MANSION_HISTORY_URL)}" target="_blank" rel="noopener noreferrer">Meeker Mansion history</a>
            <a class="journey-recap__link" href="${escapeAttr(MEEKER_GIFT_SHOP_URL)}" target="_blank" rel="noopener noreferrer">Hop King gift shop</a>
          </div>
        </aside>
        <button type="button" class="journey-recap__cta" disabled>
          <span class="journey-recap__cta-wait">Reading your trail…</span>
          <span class="journey-recap__cta-go" hidden>Return to title</span>
        </button>
      </div>
    `;

    document.body.appendChild(el);
    startMeekerSpriteAnimations(el);

    const btn = el.querySelector<HTMLButtonElement>(".journey-recap__cta")!;
    const waitLbl = el.querySelector<HTMLElement>(".journey-recap__cta-wait")!;
    const goLbl = el.querySelector<HTMLElement>(".journey-recap__cta-go")!;

    const finish = (): void => {
      window.removeEventListener("keydown", onKey, true);
      el.classList.add("journey-recap--out");
      window.setTimeout(() => {
        el.remove();
        resolve();
      }, 420);
    };

    const enable = (): void => {
      btn.disabled = false;
      waitLbl.hidden = true;
      goLbl.hidden = false;
      btn.focus();
    };

    window.setTimeout(enable, MIN_READ_MS);

    btn.addEventListener("click", () => {
      if (!btn.disabled) finish();
    });

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!btn.disabled) finish();
      }
    };
    window.addEventListener("keydown", onKey, true);

    el.querySelectorAll<HTMLElement>(".journey-recap__stat").forEach((li, i) => {
      window.setTimeout(() => li.classList.add("journey-recap__stat--in"), 520 + i * STAT_STAGGER_MS);
    });
  });
}
