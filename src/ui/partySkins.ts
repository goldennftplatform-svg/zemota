import { partyPortraitSrc } from "../game/partySkinSheets";
import "../css/party-skins.css";

const PARTY_SKIN_REV = "5";

export function renderPartySkinHtml(skinId: number): string {
  const src = partyPortraitSrc(skinId);
  return `<span class="party-skin" data-party-skin="${skinId}" data-party-skin-rev="${PARTY_SKIN_REV}" aria-hidden="true"><img class="party-skin__img" src="${src}" alt="" loading="lazy" decoding="async" /></span>`;
}

/** No-op — portraits are inline <img> tags now. Kept for call sites. */
export function mountPartySkin(_el: HTMLElement): void {}

export function hydratePartySkins(_root: ParentNode = document): void {}

export function preloadPartySkinSheets(): Promise<void> {
  const urls: string[] = [];
  for (let i = 0; i < 72; i++) urls.push(partyPortraitSrc(i));
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
