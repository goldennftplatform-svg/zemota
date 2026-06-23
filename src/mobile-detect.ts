/** Sets `html.emota-mobile` for touch / narrow viewports — easy-read CSS follows. */
export function initMobileShellClass(): void {
  if (typeof window === "undefined") return;
  const mq = window.matchMedia("(max-width: 899.98px), (pointer: coarse)");
  const apply = (): void => {
    const on = mq.matches;
    document.documentElement.classList.toggle("emota-mobile", on);
    document.documentElement.classList.toggle("emota-easy-read", on);
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
