/** Sets `html.emota-mobile` for touch / narrow viewports — stronger mobile browser layout. */
export function initMobileShellClass(): void {
  if (typeof window === "undefined") return;
  const mq = window.matchMedia("(max-width: 768px), (pointer: coarse)");
  const apply = (): void => {
    document.documentElement.classList.toggle("emota-mobile", mq.matches);
  };
  apply();
  mq.addEventListener?.("change", apply);

  /** iOS Safari / iPadOS — extra safe-area + input quirks handled in mobile-shell.css */
  const ua = navigator.userAgent || "";
  const mtp = typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && mtp > 1);
  document.documentElement.classList.toggle("emota-ios", isIOS);
}
