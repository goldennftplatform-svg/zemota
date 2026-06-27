import { partyPortraitSrc } from "../game/partySkinSheets";
import "../css/party-skins.css";

const PARTY_SKIN_REV = "9";

export function partyPortraitUrl(skinId: number): string {
  const src = partyPortraitSrc(skinId);
  return `${src}?v=${PARTY_SKIN_REV}`;
}

export function renderPartySkinHtml(skinId: number): string {
  const src = partyPortraitUrl(skinId);
  return `<span class="party-skin" data-party-skin="${skinId}" data-party-skin-rev="${PARTY_SKIN_REV}" aria-hidden="true"><img class="party-skin__img" src="${src}" alt="" loading="eager" decoding="async" /></span>`;
}

/** Refresh portrait <img> src when an old cache-bust rev is still in the DOM. */
export function hydratePartySkins(root: ParentNode = document): void {
  const needle = `v=${PARTY_SKIN_REV}`;
  root.querySelectorAll<HTMLImageElement>("img.party-skin__img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (src.includes(needle)) return;
    const skin = img.closest(".party-skin")?.getAttribute("data-party-skin");
    if (!skin) return;
    const next = partyPortraitUrl(Number(skin));
    if (src !== next) img.src = next;
  });
}

export function preloadPartySkinSheets(): Promise<void> {
  const urls: string[] = [];
  for (let i = 0; i < 72; i++) urls.push(partyPortraitUrl(i));
  return Promise.all(
    urls.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src;
        }),
    ),
  ).then(() => undefined);
}
