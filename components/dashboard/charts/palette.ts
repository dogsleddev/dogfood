/**
 * Chart palette — the brand colors (CLAUDE.md §19) as hex, for inline SVG fills/strokes where a
 * Tailwind class can't reach. The content surface is always parchment (no in-app dark mode), so
 * these read correctly on every chart card.
 */
export const CHART = {
  ember: "#EC6D3F",
  emberDeep: "#C9582E",
  amber: "#E7B23A",
  amberDeep: "#B9852A",
  sage: "#46C99A",
  sageDeep: "#2FA37D",
  sageDeeper: "#2A8A66",
  steel: "#5A6B7A",
  frost: "#9DB8CC",
  ink: "#1c2530",
  line: "#ECE6DB", // parchment-line (gridlines, axes)
} as const;

/**
 * A "nice" axis for [min, max]: pads to round bounds with evenly spaced ticks, so bars/lines fill
 * the plot height and labels read cleanly ($0/$1M/$2M, 66%/68%/70%). Step snaps to 1/2/2.5/5/10 ×
 * 10^k of the rough range/targetTicks — finer than a plain 1/2/5 ceiling, which over-pads (a $2.4M
 * max would round to a $5M axis).
 */
export function niceAxis(min: number, max: number, targetTicks = 4): { min: number; max: number; ticks: number[] } {
  const lo = min;
  let hi = max;
  if (lo === hi) hi = lo + 1;
  const range = hi - lo || 1;
  const rawStep = range / targetTicks;
  const exp = Math.floor(Math.log10(rawStep));
  const base = Math.pow(10, exp);
  const f = rawStep / base;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * base;
  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) ticks.push(Math.abs(v) < step * 1e-6 ? 0 : v);
  return { min: niceMin, max: niceMax, ticks };
}
