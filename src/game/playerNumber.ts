const LS_KEY = "emota_traveler_no";

/** Stable 6-digit id for contests / call-outs (device-local). */
export function getTravelerNumber(): number {
  try {
    const raw = localStorage.getItem(LS_KEY);
    let n = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n) || n < 100_000 || n > 999_999) {
      n = 100_000 + Math.floor(Math.random() * 900_000);
      localStorage.setItem(LS_KEY, String(n));
    }
    return n;
  } catch {
    return 100_000 + Math.floor(Math.random() * 900_000);
  }
}
