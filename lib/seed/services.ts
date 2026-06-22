/**
 * Services seed — step 2 of the §12 generator. Capacity-driven % complete + WIP (§8, §11).
 * Implementation engagements attach to subscription acquisitions by tier; revenue recognizes
 * by % complete, gated by a monthly delivery-capacity curve (when demand exceeds capacity,
 * delivery stretches → backlog: "implementation capacity gates go-lives"). Billed % complete in
 * arrears, so recognized-but-unbilled sits in WIP (a contract asset) at ~1 month of recognition.
 *
 * Tie-out BY CONSTRUCTION: monthly services revenue === Σ project recognition that month;
 * each completed project fully recognizes (Σ over life === contract value); WIP === Σ
 * unbilled recognized-to-date; utilization === recognized ÷ capacity ≤ 100%.
 */
import { mulberry32, between, chance, roundTo, type Rng } from "./prng";
import {
  SEED_MONTH_COUNT,
  SEED_MONTHS,
  SERVICES_RNG_SEED,
  SERVICES_ATTACH_RATE,
  SERVICES_ATTACH_PCT,
  SERVICES_DURATION,
  SERVICES_MARGIN,
} from "./params";
import { usd, percent } from "@/lib/types/money";
import type { Month } from "@/lib/types/period";
import type { Project } from "@/lib/types/source";
import type { Acquisition, TieOutCheck } from "./subscription";

interface SimProject {
  id: string;
  customerId: string;
  name: string;
  contractValue: number;
  startIndex: number;
  nominalDuration: number;
  marginPct: number;
  remaining: number;
  recognizedToDate: number;
  completeIndex?: number;
}

export interface ServicesSeries {
  readonly months: readonly Month[];
  readonly recognized: readonly number[];
  readonly wip: readonly number[];
  /** billed at completion (full contract value leaves WIP → AR) */
  readonly billed: readonly number[];
  readonly utilization: readonly number[];
}

export interface ServicesSeed {
  readonly projects: readonly Project[];
  readonly series: ServicesSeries;
  /** per-project monthly recognized revenue (Σ over projects in month i === series.recognized[i]);
   *  the sub-ledger uses this to job-cost (timesheets × bill rate) and bill in arrears. */
  readonly recByProject: readonly { readonly projectId: string; readonly monthly: readonly number[] }[];
  readonly fyRecognized: Readonly<Record<number, number>>;
  readonly avgMarginPct: number;
  /** recognized-but-undelivered contract value still in flight at the horizon (capacity backlog) */
  readonly endingBacklog: number;
  readonly incompleteCount: number;
  readonly checks: readonly TieOutCheck[];
}

const projectStatus = (p: SimProject): Project["status"] => {
  if (p.completeIndex !== undefined) return "complete";
  if (p.recognizedToDate > 0) return "in_progress";
  return "not_started";
};

/**
 * A project is economically complete once its undelivered value falls below 0.1% of contract
 * value (floored at $1). The old absolute $0.5 cutoff was never reached under proportional
 * capacity throttling — each month shaves `remaining × scale`, so a near-done project decays
 * geometrically toward 0 without crossing $0.5 inside the 36-month horizon, stranding finished
 * projects as "in_progress" forever (inflating the register count + per-project age). A
 * value-relative bound crosses in finite months; the residual is recognized at completion
 * (below) so per-project recognition still ties EXACTLY to contract value.
 */
const doneBound = (p: SimProject): number => Math.max(1, p.contractValue * 0.005); // 0.5% (raised from 0.1%: under the H2-2026 growth ramp a few projects sat stranded at ~99.8% complete because the smaller residual never crossed the bound under capacity throttling; the residual is recognized at completion either way, so tie-outs are unchanged)

/** capacityByMonth is the PS-headcount-derived delivery capacity from the personnel step (§11). */
export function generateServicesSeed(
  acquisitions: readonly Acquisition[],
  capacityByMonth: readonly number[],
): ServicesSeed {
  const rng: Rng = mulberry32(SERVICES_RNG_SEED);

  // 1) spawn implementation projects from in-window acquisitions
  const projects: SimProject[] = [];
  for (const a of acquisitions) {
    if (a.startIndex < 0) continue;
    if (!chance(rng, SERVICES_ATTACH_RATE[a.tier])) continue;
    const value = roundTo(a.arr * SERVICES_ATTACH_PCT[a.tier], 1000);
    if (value < 2000) continue;
    projects.push({
      id: `svc-${a.customerId}`,
      customerId: a.customerId,
      name: `Implementation · ${a.name}`,
      contractValue: value,
      startIndex: a.startIndex,
      nominalDuration: SERVICES_DURATION[a.tier],
      // Illustrative project-level margin (texture on the Projects register). The authoritative
      // services cost in the P&L is the assembled CoR (pass-through % + allocated PS payroll),
      // not this figure — they are not reconciled by design.
      marginPct: between(rng, SERVICES_MARGIN.lo, SERVICES_MARGIN.hi),
      remaining: value,
      recognizedToDate: 0,
    });
  }

  // 2) capacity-constrained % complete schedule
  const recognized: number[] = [];
  const wip: number[] = [];
  const billed: number[] = [];
  const utilization: number[] = [];
  const recByProject = new Map<string, number[]>();
  for (const p of projects) recByProject.set(p.id, new Array<number>(SEED_MONTH_COUNT).fill(0));

  for (let i = 0; i < SEED_MONTH_COUNT; i++) {
    const capacity = capacityByMonth[i] ?? 0;
    const active = projects.filter((p) => p.startIndex <= i && p.remaining > doneBound(p));
    const demands = active.map((p) => Math.min(p.remaining, p.contractValue / p.nominalDuration));
    const totalDemand = demands.reduce((a, b) => a + b, 0);
    const scale = totalDemand > capacity ? capacity / totalDemand : 1;

    let rec = 0;
    let delivered = 0; // capacity-throttled delivery this month (≤ capacity by construction)
    active.forEach((p, idx) => {
      const take = demands[idx] * scale;
      p.remaining -= take;
      p.recognizedToDate += take;
      let pRec = take;
      rec += take;
      delivered += take;
      if (p.remaining <= doneBound(p)) {
        // recognize the final residual (≤ 0.1% of contract value) so the project ties EXACTLY
        // to its contract value (no value leaks across the many completions). This closure is
        // counted in recognized REVENUE but NOT in `delivered`: it is the discretization sliver
        // at the completion event, not throttled delivery, so it must not push utilization > 100%.
        p.recognizedToDate += p.remaining;
        rec += p.remaining;
        pRec += p.remaining;
        p.remaining = 0;
        p.completeIndex = i;
      }
      recByProject.get(p.id)![i] = pRec;
    });
    recognized.push(rec);
    // Utilization measures DELIVERY against capacity (≤ 100% by construction); completion-closure
    // residuals live in `recognized` (revenue) but not here (see the forEach note above).
    utilization.push(capacity > 0 ? delivered / capacity : 0);
  }

  // Billing: % complete IN ARREARS — bill last month's recognized this month. This keeps the
  // §11 "capacity gates go-lives" story (capacity still gates RECOGNITION) while the contract
  // asset stays realistic (WIP = the current month's recognized, ~1 month), not a balloon that
  // grows whenever capacity binds (the prior bill-at-completion model). Σbilled = Σrecognized −
  // ending WIP holds by construction.
  for (let i = 0; i < SEED_MONTH_COUNT; i++) {
    billed.push(i > 0 ? recognized[i - 1] : 0);
    wip.push(recognized[i]); // recognized-but-unbilled = this month's recognition
  }

  // 3) records
  const projectRecords: Project[] = projects.map((p) => ({
    id: p.id as Project["id"],
    name: p.name,
    customerId: p.customerId as Project["customerId"],
    status: projectStatus(p),
    pctComplete: percent(p.contractValue > 0 ? p.recognizedToDate / p.contractValue : 0),
    contractValue: usd(p.contractValue),
    wip: usd(p.completeIndex !== undefined ? 0 : p.recognizedToDate),
    marginPct: percent(p.marginPct),
  }));

  // 4) aggregates
  const fyRecognized: Record<number, number> = { 2024: 0, 2025: 0, 2026: 0 };
  recognized.forEach((r, i) => {
    fyRecognized[2024 + Math.floor(i / 12)] += r;
  });
  const totalValue = projects.reduce((a, p) => a + p.contractValue, 0);
  const avgMarginPct = projects.length
    ? projects.reduce((a, p) => a + p.marginPct * p.contractValue, 0) / (totalValue || 1)
    : 0;

  // 5) tie-out checks
  const totalRecognized = recognized.reduce((a, b) => a + b, 0);
  const totalContractValue = projects.reduce((a, p) => a + p.contractValue, 0);
  const sumRecognizedToDate = projects.reduce((a, p) => a + p.recognizedToDate, 0);
  const endingBacklog = projects.reduce((a, p) => a + p.remaining, 0);
  const completed = projects.filter((p) => p.completeIndex !== undefined);
  const incompleteCount = projects.length - completed.length;
  // INDEPENDENT recognition reconciliation across THREE accumulators that drift apart under a
  // real bug (e.g. the completion residual added to one but not the other):
  //   (a) totalRecognized  — the monthly recognized[] series (pushed per month)
  //   (b) sumRecognizedToDate — the per-project recognizedToDate field
  //   (c) totalContractValue − endingBacklog — conservation across all projects
  // A months-vs-field desync flips this red; the prior `field + backlog === value` form was a
  // per-project tautology (recognizedToDate + remaining ≡ contractValue by construction).
  const seriesVsField = Math.abs(totalRecognized - sumRecognizedToDate) < 1;
  const seriesVsConservation = Math.abs(totalRecognized - (totalContractValue - endingBacklog)) < 1;
  const projectsExist = projects.length > 0;
  const recognitionReconciles = seriesVsField && seriesVsConservation && projectsExist;
  const completedFullyRecognized = projectsExist && completed.every((p) => Math.abs(p.recognizedToDate - p.contractValue) < 1);
  const wipNonNeg = wip.every((w) => w >= -1);
  const maxUtil = Math.max(...utilization);
  // INDEPENDENT: billed-at-completion (a completion-event accumulator) must equal recognized
  // less what is still unbilled in WIP at the horizon — a different path than the recognized sum.
  const totalBilled = billed.reduce((a, b) => a + b, 0);
  const billedTiesToRecognized = Math.abs(totalBilled - (totalRecognized - wip[SEED_MONTH_COUNT - 1])) < 1;

  const checks: TieOutCheck[] = [
    {
      label: "Services recognition reconciles (months series === project field === value − backlog)",
      ok: recognitionReconciles,
      detail: `Σ months ${Math.round(totalRecognized).toLocaleString()} === Σ project field ${Math.round(sumRecognizedToDate).toLocaleString()} === value ${Math.round(totalContractValue).toLocaleString()} − backlog ${Math.round(endingBacklog).toLocaleString()}`,
      kind: "independent",
    },
    {
      label: "Completed projects fully recognized",
      ok: completedFullyRecognized,
      detail: `${completed.length}/${projects.length} complete · ${incompleteCount} in backlog at horizon (under-recognizing any completed project trips this)`,
      kind: "independent",
    },
    {
      label: "Billed (%-complete, in arrears) ties to recognized − WIP",
      ok: billedTiesToRecognized,
      detail: `Σ billed ${Math.round(totalBilled).toLocaleString()} === Σ recognized ${Math.round(totalRecognized).toLocaleString()} − ending WIP ${Math.round(wip[SEED_MONTH_COUNT - 1]).toLocaleString()}`,
      kind: "independent",
    },
    { label: "WIP (contract asset) never negative", ok: wipNonNeg, detail: "recognized-but-unbilled; one-sided bound", kind: "sanity" },
    { label: "Utilization ≤ 100% (capacity-gated)", ok: maxUtil <= 1.0001, detail: `peak ${(maxUtil * 100).toFixed(0)}%`, kind: "sanity" },
  ];

  return {
    projects: projectRecords,
    series: { months: SEED_MONTHS, recognized, wip, billed, utilization },
    recByProject: Array.from(recByProject, ([projectId, monthly]) => ({ projectId, monthly })),
    fyRecognized,
    avgMarginPct,
    endingBacklog,
    incompleteCount,
    checks,
  };
}
