import {
  PARTY_SKIN_SHEETS,
  partySkinCell,
  partySkinSheetIndex,
  type PartySkinSheet,
} from "../game/partySkinSheets";
import "../css/party-skins.css";

interface KeyedPartySheet {
  canvas: HTMLCanvasElement;
  def: PartySkinSheet;
}

const keyedCache = new Map<number, KeyedPartySheet>();
const keyedLoads = new Map<number, Promise<KeyedPartySheet | null>>();

function keyBlackSheet(img: HTMLImageElement, def: PartySkinSheet): KeyedPartySheet {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { canvas, def };

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
  return { canvas, def };
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
  const { def, canvas: sheet } = keyed;
  const sx = col * def.cellW;
  const sy = def.cropTop + row * def.cellH;

  if (target.width !== def.cellW || target.height !== def.cellH) {
    target.width = def.cellW;
    target.height = def.cellH;
  }

  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(sheet, sx, sy, def.cellW, def.cellH, 0, 0, def.cellW, def.cellH);
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
    mountPartySkin(el, { force: true });
  }
}

export function preloadPartySkinSheets(): Promise<void> {
  return Promise.all(
    PARTY_SKIN_SHEETS.map((_, i) => loadKeyedSheet(i).then(() => undefined)),
  ).then(() => undefined);
}
