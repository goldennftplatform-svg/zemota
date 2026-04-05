import type { ProfileId } from "./types";
import { PROFILES } from "./profiles";

export const STORE = {
  oxenCentsEach: 40_00,
  foodCentsPerLb: 4,
  ammoBoxCents: 2_00,
  clothesSetCents: 12_50,
  wheelCents: 10_00,
  axleCents: 12_00,
} as const;

export function priceOxen(profile: ProfileId, qty: number): number {
  return Math.round(STORE.oxenCentsEach * qty * PROFILES[profile].buyPriceMult);
}

export function priceFood(profile: ProfileId, lbs: number): number {
  return Math.round(STORE.foodCentsPerLb * lbs * PROFILES[profile].buyPriceMult);
}

export function priceAmmo(profile: ProfileId, boxes: number): number {
  return Math.round(STORE.ammoBoxCents * boxes * PROFILES[profile].buyPriceMult);
}

export function priceClothes(profile: ProfileId, sets: number): number {
  return Math.round(STORE.clothesSetCents * sets * PROFILES[profile].buyPriceMult);
}

export function priceParts(
  profile: ProfileId,
  wheels: number,
  axles: number,
): number {
  const d = PROFILES[profile].partsDiscount * PROFILES[profile].buyPriceMult;
  return Math.round(STORE.wheelCents * wheels * d + STORE.axleCents * axles * d);
}

/** Suggested “ideal” spend is ~2.5× starting cash for richest profile — forces hunting/trade. */
export function idealOutfitCostCents(profile: ProfileId): number {
  return (
    priceOxen(profile, 6) +
    priceFood(profile, 900) +
    priceAmmo(profile, 5) +
    priceClothes(profile, 5) +
    priceParts(profile, 2, 2)
  );
}
