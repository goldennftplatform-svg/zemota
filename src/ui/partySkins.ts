import {
  PARTY_SKIN_SHEETS,
  partySkinLocalIndex,
  partySkinSheetIndex,
  type PartySkinSheet,
} from "../game/partySkinSheets";
import { partySkinTrimRect } from "../game/partySkinRects";
import "../css/party-skins.css";

const PARTY_SKIN_REV = "3";

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
  const sheetIndex = partySkinSheetIndex(skinId);
  const local = partySkinLocalIndex(skinId);
  const trimmed = partySkinTrimRect(sheetIndex, local);
  if (!trimmed) return;

  const { canvas: sheet } = keyed;

  if (target.width !== trimmed.sw || target.height !== trimmed.sh) {
    target.width = trimmed.sw;
    target.height = trimmed.sh;
  }

  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(
    sheet,
    trimmed.sx,
    trimmed.sy,
    trimmed.sw,
    trimmed.sh,
    0,
    0,
    trimmed.sw,
    trimmed.sh,
  );
}

export function renderPartySkinHtml(skinId: number): string {
  return `<span class="party-skin" data-party-skin="${skinId}" data-party-skin-rev="${PARTY_SKIN_REV}" aria-hidden="true"></span>`;
}

export function mountPartySkin(el: HTMLElement, opts?: { force?: boolean }): void {
  const raw = el.dataset.partySkin;
  if (raw === undefined) return;

  const skinId = Number(raw);
  if (!Number.isFinite(skinId)) return;
  if (!opts?.force && el.dataset.partySkinMounted === `${PARTY_SKIN_REV}:${skinId}`) return;

  const sheetIndex = partySkinSheetIndex(skinId);
  void loadKeyedSheet(sheetIndex).then((keyed) => {
    if (!keyed || !el.isConnected) return;
    if (el.dataset.partySkin !== String(skinId)) return;
    drawPartySkin(ensureCanvas(el), keyed, skinId);
    el.dataset.partySkinMounted = `${PARTY_SKIN_REV}:${skinId}`;
  });
}

export function hydratePartySkins(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-party-skin]")) {
    mountPartySkin(el);
  }
}

export function preloadPartySkinSheets(): Promise<void> {
  return Promise.all(
    PARTY_SKIN_SHEETS.map((_, i) => loadKeyedSheet(i).then(() => undefined)),
  ).then(() => undefined);
}
