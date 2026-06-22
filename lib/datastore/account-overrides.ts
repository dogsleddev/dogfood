/**
 * The Account-Mapping override compose seam (CLAUDE.md §16/§17 — the override layer).
 *
 * `composeGlAccounts(base, overrides)` is the single place the immutable GL chart is merged with the
 * CFO's field-level overrides. It is the seam `listGlAccounts()` returns on both backends, so every
 * caller (the Account Mapping table, the statement rollup, Scout) reads the SAME composed map.
 *
 * CRITICAL invariant: when there are no overrides it returns `base` BY REFERENCE — the byte-identical
 * fast path that keeps every gate (data-sweep, supabase-parity, peer-check) bit-for-bit unchanged on
 * the empty store. Orphan overrides (a `code` not in `base`, e.g. after a re-import dropped an account)
 * are silently ignored — `base` drives the set (a left join).
 */
import type { GlAccount, AccountOverride } from "@/lib/types/source";

export function composeGlAccounts(
  base: readonly GlAccount[],
  overrides: readonly AccountOverride[],
): readonly GlAccount[] {
  if (overrides.length === 0) return base; // identity by reference — the byte-identical empty path
  const byCode = new Map(overrides.map((o) => [o.code, o]));
  return base.map((a) => {
    const o = byCode.get(a.code);
    if (!o) return a;
    // overlay each DEFINED field; `undefined` keeps the base value (a per-field delta, §17)
    return {
      ...a,
      statementLineId: o.statementLineId ?? a.statementLineId,
      classification: o.classification ?? a.classification,
      function: o.function ?? a.function,
    };
    // orphan overrides (code not in `base`) are never visited → dropped, never materialized
  });
}
