import {
  PARTY_SKIN_SHEETS,
  PARTY_SKINS_PER_SHEET,
  partySkinCell,
  partySkinSheetIndex,
  type PartySkinSheet,
} from "../game/partySkinSheets";
import "../css/party-skins.css";

interface CellRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

interface KeyedPartySheet {
  canvas: HTMLCanvasElement;
  def: PartySkinSheet;
  cells: CellRect[];
}

const keyedCache = new Map<number, KeyedPartySheet>();
const keyedLoads = new Map<number, Promise<KeyedPartySheet | null>>();

function keyBlackSheet(img: HTMLImageElement, def: PartySkinSheet): KeyedPartySheet {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { canvas, def, cells: fallbackCells(def) };
  }

  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]!;
    const g = px[i + 1]!;
    const b = px[i + 2]!;
    if (r < 28 && g < 28 && b < 28) {
      px[i + 3] = 0;
    }
  }
  ctx.putImageData(data, 0, 0);
  const cells = detectPartyCells(px, canvas.width, canvas.height, def);
  return { canvas, def, cells };
}

function fallbackCells(def: PartySkinSheet): CellRect[] {
  const cells: CellRect[] = [];
  for (let row = 0; row < def.rows; row++) {
    for (let col = 0; col < def.cols; col++) {
      cells.push({
        sx: col * def.cellW,
        sy: def.cropTop + row * def.cellH,
        sw: def.cellW,
        sh: def.cellH,
      });
    }
  }
  return cells;
}

function columnProfile(
  px: Uint8ClampedArray,
  width: number,
  y: number,
  halfBand: number,
): number[] {
  const profile = new Array<number>(width).fill(0);
  for (let x = 0; x < width; x++) {
    let score = 0;
    for (let dy = -halfBand; dy <= halfBand; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= height) continue;
      const a = px[(yy * width + x) * 4 + 3]!;
      if (a > 20) score++;
    }
    profile[x] = score;
  }
  return profile;
}

function clusterPeaks(profile: number[], minGap: number, minScore: number): number[] {
  const peaks: number[] = [];
  for (let x = 1; x < profile.length - 1; x++) {
    if (profile[x]! < minScore) continue;
    if (profile[x]! >= profile[x - 1]! && profile[x]! >= profile[x + 1]!) {
      if (!peaks.length || x - peaks[peaks.length - 1]! > minGap) {
        peaks.push(x);
      } else {
        peaks[peaks.length - 1] = Math.round((peaks[peaks.length - 1]! + x) / 2);
      }
    }
  }
  return peaks;
}

function rowProfile(px: Uint8ClampedArray, width: number, height: number, x: number): number[] {
  const profile = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y++) {
    let score = 0;
    for (let dx = -36; dx <= 36; dx++) {
      const xx = x + dx;
      if (xx < 0 || xx >= width) continue;
      const a = px[(y * width + xx) * 4 + 3]!;
      if (a > 20) score++;
    }
    profile[y] = score;
  }
  return profile;
}

function detectPartyCells(
  px: Uint8ClampedArray,
  width: number,
  height: number,
  def: PartySkinSheet,
): CellRect[] {
  const colProfile = columnProfile(px, width, Math.round(height * 0.42), 48);
  let colCenters = clusterPeaks(colProfile, 48, 18);
  if (colCenters.length < def.cols) {
    colCenters = Array.from({ length: def.cols }, (_, i) =>
      Math.round(((i + 0.5) * width) / def.cols),
    );
  } else if (colCenters.length > def.cols) {
    colCenters = colCenters.slice(0, def.cols);
  }

  const rowProf = rowProfile(px, width, height, colCenters[0] ?? width / 2);
  let rowCenters: number[] = [];
  for (let y = Math.round(height * 0.22); y < height - 40; y++) {
    if (rowProf[y]! < 22) continue;
    if (rowProf[y]! >= rowProf[y - 1]! && rowProf[y]! >= rowProf[y + 1]!) {
      if (!rowCenters.length || y - rowCenters[rowCenters.length - 1]! > 70) {
        rowCenters.push(y);
      }
    }
  }
  if (rowCenters.length < def.rows) {
    const band = (height - def.cropTop) / def.rows;
    rowCenters = Array.from({ length: def.rows }, (_, i) =>
      Math.round(def.cropTop + (i + 0.5) * band),
    );
  } else if (rowCenters.length > def.rows) {
    rowCenters = rowCenters.slice(0, def.rows);
  }

  const colLeft: number[] = [];
  const colRight: number[] = [];
  for (let c = 0; c < def.cols; c++) {
    const left =
      c === 0
        ? Math.max(0, colCenters[0]! - Math.round((colCenters[1]! - colCenters[0]!) / 2))
        : Math.round((colCenters[c - 1]! + colCenters[c]!) / 2);
    const right =
      c === def.cols - 1
        ? width
        : Math.round((colCenters[c]! + colCenters[c + 1]!) / 2);
    colLeft.push(left);
    colRight.push(right);
  }

  const rowTop: number[] = [];
  const rowBottom: number[] = [];
  for (let r = 0; r < def.rows; r++) {
    const top =
      r === 0
        ? Math.max(0, rowCenters[0]! - Math.round((rowCenters[1]! - rowCenters[0]!) / 2))
        : Math.round((rowCenters[r - 1]! + rowCenters[r]!) / 2);
    const bottom =
      r === def.rows - 1
        ? height
        : Math.round((rowCenters[r]! + rowCenters[r + 1]!) / 2);
    rowTop.push(top);
    rowBottom.push(bottom);
  }

  const cells: CellRect[] = [];
  for (let row = 0; row < def.rows; row++) {
    for (let col = 0; col < def.cols; col++) {
      const sx = colLeft[col]!;
      const sy = rowTop[row]!;
      const sw = Math.max(24, colRight[col]! - sx);
      const sh = Math.max(24, rowBottom[row]! - sy);
      cells.push({ sx, sy, sw, sh });
    }
  }
  return cells;
}

function loadKeyedSheet(sheetIndex: number): Promise<KeyedPartySheet | null> {
  const cached = keyedCache.get(sheetIndex);
  if (cached) return Promise.resolve(cached);

  const pending = keyedLoads.get(sheetIndex);
  if (pending) return pending;

  const def = PARTY_SKIN_SHEETS[sheetIndex];
  if (!def) return Promise.resolve(null);

  const promise = new Promise<KeyedPartySheet | null>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const keyed = keyBlackSheet(img, def);
      keyedCache.set(sheetIndex, keyed);
      resolve(keyed);
    };
    img.onerror = () => resolve(null);
    img.src = def.src;
  });
  keyedLoads.set(sheetIndex, promise);
  return promise;
}

function ensureCanvas(el: HTMLElement): HTMLCanvasElement {
  let canvas = el.querySelector<HTMLCanvasElement>("canvas.party-skin__canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "party-skin__canvas";
    el.appendChild(canvas);
  }
  return canvas;
}

function drawPartySkin(target: HTMLCanvasElement, keyed: KeyedPartySheet, skinId: number): void {
  const { col, row } = partySkinCell(skinId);
  const local = row * keyed.def.cols + col;
  const cell = keyed.cells[local] ?? keyed.cells[0];
  if (!cell) return;

  const { canvas: sheet } = keyed;
  const pad = 2;
  const sx = cell.sx + pad;
  const sy = cell.sy + pad;
  const sw = Math.max(8, cell.sw - pad * 2);
  const sh = Math.max(8, cell.sh - pad * 2);

  if (target.width !== sw || target.height !== sh) {
    target.width = sw;
    target.height = sh;
  }

  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
}

export function renderPartySkinHtml(skinId: number): string {
  return `<span class="party-skin" data-party-skin="${skinId}" aria-hidden="true"></span>`;
}

export function mountPartySkin(el: HTMLElement, opts?: { force?: boolean }): void {
  const raw = el.dataset.partySkin;
  if (raw === undefined) return;
  if (!opts?.force && el.dataset.partySkinMounted === "1") return;

  const skinId = Number(raw);
  if (!Number.isFinite(skinId)) return;

  const sheetIndex = partySkinSheetIndex(skinId);
  void loadKeyedSheet(sheetIndex).then((keyed) => {
    if (!keyed || !el.isConnected) return;
    drawPartySkin(ensureCanvas(el), keyed, skinId);
    el.dataset.partySkinMounted = "1";
  });
}

export function hydratePartySkins(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-party-skin]")) {
    delete el.dataset.partySkinMounted;
    const old = el.querySelector("canvas.party-skin__canvas");
    if (old) old.remove();
    mountPartySkin(el, { force: true });
  }
}

export function preloadPartySkinSheets(): Promise<void> {
  return Promise.all(
    PARTY_SKIN_SHEETS.map((_, i) => loadKeyedSheet(i).then(() => undefined)),
  ).then(() => undefined);
}
