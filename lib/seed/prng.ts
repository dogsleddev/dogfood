/**
 * Deterministic PRNG for the seed generator (CLAUDE.md §12 — deterministic math in TS).
 * mulberry32: same seed → same dataset, every run. The LLM is used only for texture
 * (names/memos authored at design time in names.ts), never for numbers that must tie out.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export const between = (rng: Rng, lo: number, hi: number): number => lo + rng() * (hi - lo);

export const chance = (rng: Rng, p: number): boolean => rng() < p;

/** Round to the nearest step (e.g. nearest $1,000) for tidy ARR figures. */
export const roundTo = (value: number, step: number): number => Math.round(value / step) * step;

/** Weighted pick from [{weight}] specs. */
export function weightedIndex(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}
