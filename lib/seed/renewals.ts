/**
 * Renewals seed — the retention worklist (layer 1, CLAUDE.md §8: "the forward worklist that defends
 * the contracted base"). DERIVED from the subscription contracts (no new financial state), so it
 * moves no tie-out. Each contract's annual anniversaries within a window around the current period
 * become a Renewal: forthcoming ones are "open"; recent past ones carry an outcome (renewed, with a
 * deterministic sprinkle of expanded/contracted; churned contracts show "churned").
 *
 * The window back is < the 12-month term, so a contract has at most one PAST anniversary in it — a
 * churned contract therefore shows "churned" exactly once (it can't churn twice), and active
 * contracts get one recent outcome + (if due soon) one forward "open".
 */
import { mulberry32 } from "./prng";
import { monthToIndex } from "@/lib/types/period";
import { PLACEHOLDER_SETTINGS } from "@/lib/target/placeholder";
import { indexToMonth, SEED_RNG_SEED } from "./params";
import { usd, toMajor } from "@/lib/types/money";
import type { RenewalId } from "@/lib/types/common";
import type { Contract, Renewal, RenewalStatus } from "@/lib/types/source";

const RENEWALS_SEED = (SEED_RNG_SEED ^ 0x85ebca6b) >>> 0;
// As-of is the in-close month (2026-06). A renewal due IN or AFTER it has not resolved yet (the month
// isn't closed), so it stays "open"; only renewals due in a fully-closed month carry an outcome (#30).
// Derive from the global as-of: the in-close month (2026-06 → index 29), NOT the last-closed month
// (closeThrough = 2026-05 → 28). Centralized so moving the as-of (the global-as-of work) moves this too.
const NOW_IDX = monthToIndex(PLACEHOLDER_SETTINGS.inCloseMonth ?? PLACEHOLDER_SETTINGS.closeThrough);
const WINDOW_BACK = 6; // months of recent history to show (< the 12-mo term — see header)
const WINDOW_FWD = 12; // forthcoming renewals to defend

export interface RenewalsSeed {
  readonly renewals: readonly Renewal[];
}

export function generateRenewalsSeed(contracts: readonly Contract[]): RenewalsSeed {
  const rng = mulberry32(RENEWALS_SEED);
  const renewals: Renewal[] = [];

  for (const c of contracts) {
    const start = monthToIndex(c.startMonth);
    const term = c.termMonths > 0 ? c.termMonths : 12;
    for (let due = start + term; due <= NOW_IDX + WINDOW_FWD; due += term) {
      if (due < NOW_IDX - WINDOW_BACK) continue;

      let status: RenewalStatus;
      if (due >= NOW_IDX) {
        if (c.status !== "active") continue; // a churned contract has no forward renewal
        status = "open";
      } else if (c.status === "churned") {
        status = "churned";
      } else {
        const r = rng();
        status = r < 0.18 ? "expanded" : r < 0.26 ? "contracted" : "renewed";
      }

      // Outcome ARR carries a real magnitude (audit #13): expanded steps up 5–25%, contracted down
      // 5–20%, renewed is flat, churned goes to $0; an open renewal has no outcome yet (undefined).
      const prior = toMajor(c.arr);
      let newArr: number | undefined;
      if (status === "expanded") newArr = prior * (1 + 0.05 + rng() * 0.2);
      else if (status === "contracted") newArr = prior * (1 - (0.05 + rng() * 0.15));
      else if (status === "renewed") newArr = prior;
      else if (status === "churned") newArr = 0;

      renewals.push({
        id: `RN-${c.id}-${due}` as RenewalId,
        contractId: c.id,
        customerId: c.customerId,
        dueMonth: indexToMonth(due),
        arrUpForRenewal: c.arr,
        newArr: newArr === undefined ? undefined : usd(Math.round(newArr)),
        status,
      });
    }
  }
  return { renewals };
}
