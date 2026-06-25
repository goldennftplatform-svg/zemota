/** 72 pioneer portraits — pre-sliced from three sprite sheets. */

export const PARTY_SKINS_PER_SHEET = 24;
export const PARTY_SKIN_SHEET_COUNT = 3;
export const PARTY_SKIN_COUNT = PARTY_SKINS_PER_SHEET * PARTY_SKIN_SHEET_COUNT;

export function partySkinSheetIndex(skinId: number): number {
  return Math.floor(skinId / PARTY_SKINS_PER_SHEET) % PARTY_SKIN_SHEET_COUNT;
}

export function partyPortraitSrc(skinId: number): string {
  const id = ((skinId % PARTY_SKIN_COUNT) + PARTY_SKIN_COUNT) % PARTY_SKIN_COUNT;
  return `/art/sprites/party-skins/portraits/skin-${String(id).padStart(3, "0")}.png`;
}

/** Stable skin pick from traveler name + roster slot. */
export function partySkinIndex(name: string, slot: number): number {
  let hash = (slot + 1) * 2654435761;
  for (let i = 0; i < name.length; i++) {
    hash = Math.imul(hash ^ name.charCodeAt(i), 16777619);
  }
  return ((hash >>> 0) + slot * 11) % PARTY_SKIN_COUNT;
}
