/** Sets `html.emota-mobile` for coarse pointers / narrow viewports — drives stronger mobile CSS. */
export function initMobileShellClass(): void {
  if (typeof window === "undefined") return;
  const mq = window.matchMedia("(max-width: 768px), (pointer: coarse)");
  const apply = (): void => {
    document.documentElement.classList.toggle("emota-mobile", mq.matches);
  };
  apply();
  mq.addEventListener?.("change", apply);
}
