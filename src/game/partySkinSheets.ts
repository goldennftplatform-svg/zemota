/** 72 pioneer portraits — 24 per sheet × 3 sets (calibrated 8×3 grid). */

export interface PartySkinSheet {
  src: string;
  cols: number;
  rows: number;
}

export interface PartySkinCellRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export const PARTY_SKINS_PER_SHEET = 24;
export const PARTY_SKIN_SHEET_COUNT = 3;
export const PARTY_SKIN_COUNT = PARTY_SKINS_PER_SHEET * PARTY_SKIN_SHEET_COUNT;

/** Measured column slices (1024px sheets) — not uniform 128px. */
export const PARTY_SKIN_COL_BOUNDS: readonly (readonly [number, number])[] = [
  [40, 158],
  [158, 281],
  [281, 404],
  [404, 527],
  [527, 646],
  [646, 770],
  [770, 901],
  [901, 1024],
];

/** Measured row slices below title band. */
export const PARTY_SKIN_ROW_BOUNDS: readonly (readonly [number, number])[] = [
  [228, 403],
  [403, 565],
  [565, 720],
];

export const PARTY_SKIN_SHEETS: readonly PartySkinSheet[] = [
  { src: "/art/sprites/party-skins/set-1.png", cols: 8, rows: 3 },
  { src: "/art/sprites/party-skins/set-2.png", cols: 8, rows: 3 },
  { src: "/art/sprites/party-skins/set-3.png", cols: 8, rows: 3 },
];

export function partySkinSheetIndex(skinId: number): number {
  return Math.floor(skinId / PARTY_SKINS_PER_SHEET) % PARTY_SKIN_SHEET_COUNT;
}

export function partySkinCell(skinId: number): { col: number; row: number } {
  const cell = ((skinId % PARTY_SKIN_COUNT) + PARTY_SKIN_COUNT) % PARTY_SKIN_COUNT;
  const local = cell % PARTY_SKINS_PER_SHEET;
  return { col: local % 8, row: Math.floor(local / 8) };
}

export function partySkinCellRect(col: number, row: number): PartySkinCellRect {
  const [left, right] = PARTY_SKIN_COL_BOUNDS[col] ?? [0, 128];
  const [top, bottom] = PARTY_SKIN_ROW_BOUNDS[row] ?? [228, 403];
  return { sx: left, sy: top, sw: right - left, sh: bottom - top };
}

/** Stable skin pick from traveler name + roster slot. */
export function partySkinIndex(name: string, slot: number): number {
  let hash = (slot + 1) * 2654435761;
  for (let i = 0; i < name.length; i++) {
    hash = Math.imul(hash ^ name.charCodeAt(i), 16777619);
  }
  return ((hash >>> 0) + slot * 11) % PARTY_SKIN_COUNT;
}
