/**
 * Pipeline seed — open sales opportunities (layer 1, CLAUDE.md §8). NET-NEW seed: Pipeline is a
 * FORWARD funnel of un-closed deals, so it does NOT feed the GL/statements — generating it moves no
 * tie-out. Deterministic (its own RNG stream). Sized to the same plan tiers as the book, weighted
 * into a normal funnel shape (more leads than negotiations), closing across the H2-2026 forecast.
 *
 * Prospects are drawn from the name pool: the unused tail reads as new logos, the overlap with the
 * customer book reads as expansion opportunities on existing accounts (both are real pipeline).
 */
import { mulberry32, between, roundTo, weightedIndex, chance, type Rng } from "./prng";
import { CUSTOMER_NAMES } from "./names";
import { generatePersonnelSeed } from "./personnel";
import { TIERS, indexToMonth, SEED_RNG_SEED } from "./params";
import { usd, percent } from "@/lib/types/money";
import type { Stream } from "@/lib/types/common";
import type { DealId } from "@/lib/types/common";
import type { PipelineOpportunity, PipelineStage, Customer } from "@/lib/types/source";

const PIPELINE_SEED = (SEED_RNG_SEED ^ 0x9e3779b9) >>> 0;
const PIPELINE_COUNT = 46;

/** Open funnel stages (closed_won/closed_lost are not "open pipeline"), with conversion probability. */
const STAGES: readonly { stage: PipelineStage; weight: number; prob: number }[] = [
  { stage: "lead", weight: 34, prob: 0.1 },
  { stage: "qualified", weight: 30, prob: 0.25 },
  { stage: "proposal", weight: 22, prob: 0.5 },
  { stage: "negotiation", weight: 14, prob: 0.75 },
];
/**
 * Deal owners are the REAL Sales-function staff (Sales / Marketing / Customer Success — the 'sm'
 * function), sourced from the personnel seed so pipeline-by-rep and the Staff register show the same
 * people (drilling one resolves to the other). Derived from generatePersonnelSeed(), which is
 * deterministic and index-consumed, so the owner pool is RNG-stable and tie-out-neutral. We use only
 * heads hired by the H2-2026 close window (a deal can't be owned by someone not yet on the team).
 */
function salesRoster(): readonly string[] {
  const staff = generatePersonnelSeed().staff;
  const sm = staff.filter((s) => s.function === "sm");
  // A deal can't be owned by someone not yet on the team (or who has departed): keep 'sm' heads on board
  // by the last expected-close month. Month is a "YYYY-MM" string, so the compares are plain lexical.
  const closeBy = indexToMonth(CLOSE_IDX[CLOSE_IDX.length - 1]);
  const onBoard = sm.filter((s) => s.startMonth <= closeBy && (!s.endMonth || s.endMonth > closeBy));
  // Defensive: if the window filter ever yields nothing, fall back to all 'sm' staff (still real people).
  return (onBoard.length > 0 ? onBoard : sm).map((s) => s.name);
}
/** Expected close window Jul–Dec 2026 (indices 30–35). */
const CLOSE_IDX: readonly number[] = [30, 31, 32, 33, 34, 35];
/** Close timing is BIASED BY STAGE (audit #27): late-stage deals (negotiation/proposal) skew to the
 *  next month or two; early-stage (lead/qualified) skew further out. Each row weights CLOSE_IDX. */
const STAGE_CLOSE_BIAS: Record<PipelineStage, readonly number[]> = {
  negotiation: [40, 30, 16, 8, 4, 2],
  proposal: [24, 28, 22, 14, 8, 4],
  qualified: [8, 16, 24, 24, 16, 12],
  lead: [3, 8, 14, 22, 25, 28],
  closed_won: [1, 1, 1, 1, 1, 1],
  closed_lost: [1, 1, 1, 1, 1, 1],
};

export interface PipelineSeed {
  readonly opportunities: readonly PipelineOpportunity[];
}

const pick = (rng: Rng, arr: readonly string[]): string => arr[Math.floor(rng() * arr.length)];

export function generatePipelineSeed(customers: readonly Customer[]): PipelineSeed {
  const rng = mulberry32(PIPELINE_SEED);
  const reps = salesRoster();
  const tierWeights = TIERS.map((t) => t.weight);
  const stageWeights = STAGES.map((s) => s.weight);

  // Name pools tied to the real book (audit #29): EXPANSION opps target existing ACTIVE accounts (never
  // a churned logo); NEW-LOGO opps draw from names not in the book at all, in order with no wrap into
  // the pool head. So a deal flagged 'expansion' resolves to a live customer, and 'new_logo' is genuinely
  // new — no silent overlap, no churned target.
  const activeNames = customers.filter((c) => c.status === "active").map((c) => c.name);
  const bookNames = new Set(customers.map((c) => c.name));
  const freshNames = CUSTOMER_NAMES.filter((n) => !bookNames.has(n));
  let freshCursor = 0;

  const opportunities: PipelineOpportunity[] = [];
  for (let k = 0; k < PIPELINE_COUNT; k++) {
    const sg = STAGES[weightedIndex(rng, stageWeights)];
    const tier = TIERS[weightedIndex(rng, tierWeights)];
    const arr = roundTo(between(rng, tier.arrLo, tier.arrHi), 1000);
    const stream: Stream = chance(rng, 0.85) ? "subscription" : "services";
    // ~40% expansion on the active base, the rest fresh logos (fall back to fresh if no active names).
    const isExpansion = activeNames.length > 0 && freshNames.length > 0 ? chance(rng, 0.4) : freshNames.length === 0;
    const kind: "new_logo" | "expansion" = isExpansion ? "expansion" : "new_logo";
    const customerName = isExpansion
      ? activeNames[Math.floor(rng() * activeNames.length)]
      : freshNames[freshCursor++ % freshNames.length];
    // deal-level probability jitter around the stage base, clamped (audit #28)
    const prob = Math.min(0.95, Math.max(0.03, sg.prob + (rng() * 0.16 - 0.08)));
    opportunities.push({
      id: `deal-${k}` as DealId,
      customerName,
      stream,
      stage: sg.stage,
      arr: usd(arr),
      owner: pick(rng, reps),
      expectedClose: indexToMonth(CLOSE_IDX[weightedIndex(rng, STAGE_CLOSE_BIAS[sg.stage] as number[])]),
      probability: percent(prob),
      kind,
    });
  }
  return { opportunities };
}
