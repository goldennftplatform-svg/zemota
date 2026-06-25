/** 72 pioneer portraits — 24 per sheet × 3 sets (8×3 grid below title band). */

export interface PartySkinSheet {
  src: string;
  cols: number;
  rows: number;
  cropTop: number;
  cellW: number;
  cellH: number;
}

export const PARTY_SKINS_PER_SHEET = 24;
export const PARTY_SKIN_SHEET_COUNT = 3;
export const PARTY_SKIN_COUNT = PARTY_SKINS_PER_SHEET * PARTY_SKIN_SHEET_COUNT;

export const PARTY_SKIN_SHEETS: readonly PartySkinSheet[] = [
  {
    src: "/art/sprites/party-skins/set-1.png",
    cols: 8,
    rows: 3,
    cropTop: 96,
    cellW: 128,
    cellH: 224,
  },
  {
    src: "/art/sprites/party-skins/set-2.png",
    cols: 8,
    rows: 3,
    cropTop: 96,
    cellW: 128,
    cellH: 224,
  },
  {
    src: "/art/sprites/party-skins/set-3.png",
    cols: 8,
    rows: 3,
    cropTop: 96,
    cellW: 128,
    cellH: 224,
  },
];

export function partySkinSheetIndex(skinId: number): number {
  return Math.floor(skinId / PARTY_SKINS_PER_SHEET) % PARTY_SKIN_SHEET_COUNT;
}

export function partySkinCell(skinId: number): { col: number; row: number } {
  const cell = ((skinId % PARTY_SKIN_COUNT) + PARTY_SKIN_COUNT) % PARTY_SKIN_COUNT;
  const local = cell % PARTY_SKINS_PER_SHEET;
  return { col: local % 8, row: Math.floor(local / 8) };
}

/** Stable skin pick from traveler name + roster slot. */
export function partySkinIndex(name: string, slot: number): number {
  let hash = (slot + 1) * 2654435761;
  for (let i = 0; i < name.length; i++) {
    hash = Math.imul(hash ^ name.charCodeAt(i), 16777619);
  }
  return (hash >>> 0) % PARTY_SKIN_COUNT;
}
