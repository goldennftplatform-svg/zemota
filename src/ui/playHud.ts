import type { GameEngine } from "../game/engine";
import { MEEKER_GIFT_SHOP_FOOD_LB, MEEKER_GIFT_SHOP_USES_PER_RUN } from "../game/config";
import type { DashboardSnapshot } from "../game/types";
import {
  idealOutfitCostCents,
  priceAmmo,
  priceClothes,
  priceFood,
  priceOxen,
  priceParts,
} from "../game/store";

const ONBOARD_STEPS = [
  { phase: "party_names", label: "Names", num: 1 },
  { phase: "profile", label: "Job", num: 2 },
  { phase: "store", label: "Supplies", num: 3 },
] as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isOnboardPhase(phase: string): boolean {
  return phase === "party_names" || phase === "profile" || phase === "store";
}

export function buildOnboardRail(phase: string): string {
  if (!isOnboardPhase(phase)) return "";
  const activeIdx = ONBOARD_STEPS.findIndex((s) => s.phase === phase);
  const steps = ONBOARD_STEPS.map((s, i) => {
    const mod =
      i < activeIdx ? " onboard-rail__step--done" : i === activeIdx ? " onboard-rail__step--active" : "";
    return `<span class="onboard-rail__step${mod}"><span class="onboard-rail__num">${s.num}</span>${escapeHtml(s.label)}</span>`;
  }).join("");
  return `<nav class="onboard-rail" aria-label="Setup progress">${steps}</nav>`;
}

/** Always-visible wagon inventory — especially for mobile store / camp. */
export function buildSupplyStrip(s: DashboardSnapshot, phase: string): string {
  if (phase === "title" || phase === "training_text" || phase === "training_quiz") return "";

  const onboard = isOnboardPhase(phase);
  const onTrail = !onboard && phase !== "game_over" && phase !== "victory";

  if (phase === "party_names") {
    return `<div class="supply-strip supply-strip--onboard" role="region" aria-label="Setup">
      <p class="supply-strip__lead">Step 1 · Name your wagon and five travelers</p>
    </div>`;
  }

  if (phase === "profile") {
    const names = s.party.filter((p) => p.alive).map((p) => p.name).join(" · ");
    return `<div class="supply-strip supply-strip--onboard" role="region" aria-label="Party">
      <p class="supply-strip__lead">Step 2 · Pick a job (sets your starting cash)</p>
      <p class="supply-strip__party">${escapeHtml(names)}</p>
    </div>`;
  }

  const cells = [
    `<div class="supply-cell supply-cell--cash"><span class="supply-cell__k">Cash</span><span class="supply-cell__v">${escapeHtml(s.money)}</span></div>`,
    `<div class="supply-cell"><span class="supply-cell__k">Oxen</span><span class="supply-cell__v">${s.oxen}</span></div>`,
    `<div class="supply-cell"><span class="supply-cell__k">Food</span><span class="supply-cell__v">${s.food} lb</span></div>`,
    `<div class="supply-cell"><span class="supply-cell__k">Ammo</span><span class="supply-cell__v">${s.ammo}</span></div>`,
    `<div class="supply-cell"><span class="supply-cell__k">Clothes</span><span class="supply-cell__v">${s.clothes}</span></div>`,
    `<div class="supply-cell supply-cell--wide"><span class="supply-cell__k">Spare parts</span><span class="supply-cell__v">${escapeHtml(s.spareParts)}</span></div>`,
  ];

  if (onTrail) {
    cells.unshift(
      `<div class="supply-cell"><span class="supply-cell__k">Day</span><span class="supply-cell__v">${s.day}</span></div>`,
      `<div class="supply-cell"><span class="supply-cell__k">Miles</span><span class="supply-cell__v">${Math.round(s.miles)}</span></div>`,
      `<div class="supply-cell"><span class="supply-cell__k">Party</span><span class="supply-cell__v">${s.alive}/${s.partyCap}</span></div>`,
    );
  }

  const lead = phase === "store" ? "Your wagon — updates after each purchase" : "Wagon sheet";

  return `<div class="supply-strip" role="region" aria-label="Wagon supplies">
    <p class="supply-strip__lead">${lead}${s.profileTitle ? ` · ${escapeHtml(s.profileTitle)}` : ""}</p>
    <div class="supply-strip__grid">${cells.join("")}</div>
  </div>`;
}

type StoreRow = {
  n: number;
  name: string;
  have: string;
  buyLabel: string;
  costCents: number;
  leave?: boolean;
};

export function renderStoreChoicesHtml(engine: GameEngine, feedback: string): string {
  const inv = engine.inv;
  const p = engine.profile;
  const ideal = idealOutfitCostCents(p);

  const rows: StoreRow[] = [
    { n: 1, name: "Oxen", have: String(inv.oxen), buyLabel: "+1 head", costCents: priceOxen(p, 1) },
    { n: 2, name: "Food", have: `${inv.foodLbs} lb`, buyLabel: "+100 lb", costCents: priceFood(p, 100) },
    { n: 3, name: "Ammo", have: `${inv.ammo} rounds`, buyLabel: "+1 box (20)", costCents: priceAmmo(p, 1) },
    { n: 4, name: "Clothes", have: `${inv.clothes} sets`, buyLabel: "+1 set", costCents: priceClothes(p, 1) },
    {
      n: 5,
      name: "Spare wheel",
      have: `${inv.spareWheels}`,
      buyLabel: "+1 wheel",
      costCents: priceParts(p, 1, 0),
    },
    {
      n: 6,
      name: "Spare axle",
      have: `${inv.spareAxles}`,
      buyLabel: "+1 axle",
      costCents: priceParts(p, 0, 1),
    },
    { n: 7, name: "Leave for the trail", have: "—", buyLabel: "Start journey", costCents: 0, leave: true },
  ];

  const giftLeft = MEEKER_GIFT_SHOP_USES_PER_RUN - engine.giftShopBoostsUsed;
  if (giftLeft > 0) {
    rows.splice(rows.length - 1, 0, {
      n: 8,
      name: "Hop King gift perk",
      have: `${giftLeft} left`,
      buyLabel: `+${MEEKER_GIFT_SHOP_FOOD_LB} lb food · rest 1 day`,
      costCents: 0,
    });
  }

  const items = rows
    .map((row) => {
      const afford = row.leave || inv.moneyCents >= row.costCents;
      const mod = row.leave
        ? " store-choice--leave"
        : afford
          ? " store-choice--ok"
          : " store-choice--broke";
      const price =
        row.leave ? "" : `<span class="store-choice__price">${formatCents(row.costCents)}</span>`;
      return `<li tabindex="0" data-n="${row.n}" role="button" class="store-choice${mod}">
        <span class="store-choice__name">${escapeHtml(row.name)}</span>
        <span class="store-choice__have">Have: <strong>${escapeHtml(row.have)}</strong></span>
        <span class="store-choice__buy">${escapeHtml(row.buyLabel)} ${price}</span>
      </li>`;
    })
    .join("");

  const tip = `<p class="store-tip">Suggested full outfit ≈ ${formatCents(ideal)} · Tip: 2+ oxen, 200+ lb food, ammo for hunting.</p>`;
  const fb = feedback
    ? `<p class="store-feedback" role="status">${escapeHtml(feedback)}</p>`
    : "";

  return `${tip}${fb}<ul class="choices choices--store">${items}</ul>`;
}

function formatCents(cents: number): string {
  const neg = cents < 0;
  const c = Math.abs(cents);
  const d = Math.floor(c / 100);
  const cc = c % 100;
  return `${neg ? "-" : ""}$${d}.${cc.toString().padStart(2, "0")}`;
}
