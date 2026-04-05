/** Sets `html.emota-mobile` for touch / narrow viewports — stronger mobile browser layout. */
export function initMobileShellClass(): void {
  if (typeof window === "undefined") return;
  const mq = window.matchMedia("(max-width: 768px), (pointer: coarse)");
  const apply = (): void => {
    document.documentElement.classList.toggle("emota-mobile", mq.matches);
  };
  apply();
  mq.addEventListener?.("change", apply);
}
