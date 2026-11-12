// Pay-per-report prices in rupees, by report mode. Override in Vercel with PRICE_MODE1/2/3.
export function prices() {
  const n = (v, d) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x > 0 ? x : d; };
  return { 1: n(process.env.PRICE_MODE1, 599), 2: n(process.env.PRICE_MODE2, 999), 3: n(process.env.PRICE_MODE3, 1499) };
}
// Amount still due to unlock `mode` when the project is already unlocked at `paidMode` (0 = never paid).
export function amountDue(mode, paidMode) {
  const p = prices(); const m = Math.min(3, Math.max(1, Math.round(mode) || 1));
  const paid = paidMode ? p[Math.min(3, Math.max(1, paidMode))] : 0;
  return Math.max(0, p[m] - paid);
}
