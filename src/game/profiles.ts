import type { ProfileId } from "./types";

/** Weighted modifiers + starting cash. Cash tuned so ~40% of “ideal” outfit is affordable; rest from hunt/trade/chance. */
export interface ProfileDef {
  id: ProfileId;
  title: string;
  startCashCents: number;
  /** Multiplier on store prices (>1 = you pay more). */
  buyPriceMult: number;
  /** Extra food lbs when foraging/hunting succeeds. */
  forageBonus: number;
  /** Multiplier on fatal-event probability (<1 = safer). */
  dangerMult: number;
  /** Discount on spare parts (0.5 = half price). */
  partsDiscount: number;
  /** Sell / trade bonus when trading posts appear. */
  tradeMult: number;
  lore: string;
}

export const PROFILES: Record<ProfileId, ProfileDef> = {
  banker: {
    id: "banker",
    title: "Banker (traveling west)",
    startCashCents: 800_00,
    buyPriceMult: 1,
    forageBonus: 0,
    dangerMult: 0.92,
    partsDiscount: 1,
    tradeMult: 1,
    lore:
      "City polish and letters of credit. You can buy more upfront, but the trail does not care about ledgers.",
  },
  farmer: {
    id: "farmer",
    title: "Farmer",
    startCashCents: 400_00,
    buyPriceMult: 1,
    forageBonus: 12,
    dangerMult: 1,
    partsDiscount: 1,
    tradeMult: 1,
    lore:
      "You read weather in the clouds and know how to stretch a harvest. Foraging treats you a little better.",
  },
  blacksmith: {
    id: "blacksmith",
    title: "Blacksmith",
    startCashCents: 500_00,
    buyPriceMult: 1,
    forageBonus: 0,
    dangerMult: 1,
    partsDiscount: 0.5,
    tradeMult: 1,
    lore:
      "Iron and axle grease. Wagon parts cost you less because you know what actually breaks.",
  },
  goldSeeker: {
    id: "goldSeeker",
    title: "Gold seeker",
    startCashCents: 200_00,
    buyPriceMult: 1.05,
    forageBonus: 6,
    dangerMult: 1.08,
    partsDiscount: 1,
    tradeMult: 1.05,
    lore:
      "Thin purse, thick hope. You take slightly bigger risks and sometimes find a little more in the dirt.",
  },
  companyAgent: {
    id: "companyAgent",
    title: "Agent for a company",
    startCashCents: 600_00,
    buyPriceMult: 1,
    forageBonus: 0,
    dangerMult: 1,
    partsDiscount: 1,
    tradeMult: 1.12,
    lore:
      "Not a family party — you are on company business with drafts and samples. Fur-trade and supply-house lore of the 1850s: you barter a little better at posts.",
  },
};

export const PROFILE_ORDER: ProfileId[] = [
  "banker",
  "farmer",
  "blacksmith",
  "goldSeeker",
  "companyAgent",
];
