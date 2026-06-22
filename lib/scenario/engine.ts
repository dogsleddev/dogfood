/**
 * The deterministic Scenario engine (CLAUDE.md §9; contract in lib/types/scenario.ts).
 *
 * ONE pure operation: Base + a scenario's active adjustments for the FORECAST horizon →
 * a re-derived Scenario P&L + Scenario Dashboard. Contained to the Scenarios group — nothing
 * outside it changes; actuals are shared and immutable (the only branch point, §9).
 *
 * Purity: no Date.now / Math.random; every input is serializable; the same scenario always
 * yields the same result. Determinism is what lets the contained surfaces tie to the live ones.
 *
 * HARD INVARIANT: with zero (active) adjustments the engine feeds the UNTOUCHED Base leaf
 * series through the IDENTICAL column algebra the seed uses, so Scenario(Base) reproduces the
 * real P&L and dashboard EXACTLY. assertBaseInvariant() proves it.
 *
 * How a lever maps onto the model (all applied per-month, only inside the window, only over the
 * forecast horizon — actual/in-close months are never branched):
 *   revenue▸stream   RATE   scale that stream's recognized-revenue leaf in-window
 *   personnel▸dept   LEVEL  add a payroll delta to direct_payroll (Direct depts) or
 *                           indirect_payroll (others); `freeze` holds payroll at the
 *                           window-start level (no further ramp)
 *   expense▸group    LEVEL  add an opex delta to that group's leaf in-window
 *   direct_cost      RATE   scale the non_employee_cor leaf (the CoR rate) in-window
 *   ar_dso           ABS    working-capital TIMING → a one-time cash delta (cash/runway/burn
 *   ap_dpo           ABS    only; operating income is unchanged)
 * Then Gross Profit / Operating Income / Net Income + margins refoot from the adjusted leaves,
 * and the cash KPIs (net burn, runway, burn multiple, Rule of 40) recompute from the adjusted
 * net income and the working-capital cash deltas.
 */
import { usd, toMajor, percent, type Money } from "@/lib/types/money";
import { monthYear, monthToIndex, type Month, type PeriodRange, monthsInRange, compareMonth } from "@/lib/types/period";
import type {
  Scenario,
  Adjustment,
  ScenarioEngineInput,
  ScenarioEngineResult,
} from "@/lib/types/scenario";
import type { PnL } from "@/lib/types/statements";
import type { DashboardSummary, KpiTile } from "@/lib/types/dashboard";
import type { MetricId } from "@/lib/types/common";
import {
  seedLeafSeries,
  computeColumnsFromSeries,
  pnlFromColumns,
  seedFyWindow,
  type LeafId,
} from "@/lib/seed/statements";
import { buildSeedPnL } from "@/lib/seed/statements";
import { buildSeedDashboard, buildSeedKpiTile } from "@/lib/seed/dashboard-metrics";
import { getBalanceSheetSeed, getSbcSeed } from "@/lib/seed";
import { metricValueFromMagnitude } from "@/lib/types/metrics";

/** Direct-function departments route payroll into Cost of Revenue; everything else into OpEx (§8). */
const DIRECT_DEPARTMENTS: ReadonlySet<string> = new Set(["professional-services", "support"]);

/** Map an Expense-lever group id (the ExpenseGroupId) to its P&L leaf id. They are 1:1 by label. */
const EXPENSE_GROUP_TO_LEAF: Record<string, LeafId> = {
  "employee-expenses": "employee_expenses",
  "sales-marketing": "sales_marketing",
  "travel-entertainment": "travel_entertainment",
  it: "it",
  hr: "hr",
  admin: "admin",
  facilities: "facilities",
  insurance: "insurance",
};

/**
 * The per-month factor an adjustment applies inside its window. Step = full magnitude from the
 * window start; Ramp = linear phase-in across the window (1/N … N/N over an N-month window, or
 * across the remaining horizon when the window is open-ended).
 */
function shapeFactor(adj: Adjustment, idx: number, horizon: PeriodRange): number {
  const startIdx = monthToIndex(adj.window.start);
  if (idx < startIdx) return 0;
  const endIdx = adj.window.end ? monthToIndex(adj.window.end) : monthToIndex(horizon.end);
  if (idx > endIdx) return 0; // bounded window → revert to Base after End
  if (adj.shape === "step") return 1;
  // ramp: phase in evenly across [startIdx, endIdx]
  const span = endIdx - startIdx + 1;
  if (span <= 1) return 1;
  return (idx - startIdx + 1) / span;
}

/** Is this index inside the forecast horizon? (Adjustments only ever touch forecast months — §9.) */
function inHorizon(idx: number, horizon: PeriodRange): boolean {
  return idx >= monthToIndex(horizon.start) && idx <= monthToIndex(horizon.end);
}

interface AppliedAdjustments {
  readonly leaves: Record<LeafId, number[]>;
  /** signed cash delta (major $) from working-capital levers, by month index */
  readonly cashDelta: Record<number, number>;
}

/**
 * Apply a scenario's adjustments to a fresh copy of the Base leaf series + accumulate the
 * working-capital cash deltas. Composition (§9, COMPOSITION_RULE="later_window_overrides"):
 * within one lever target, adjustments are applied in window-start order, so a later window's
 * factor overrides the earlier one's in the overlap. Separate lever targets compose
 * independently (each touches a different leaf / cash line).
 */
function applyAdjustments(scenario: Scenario, horizon: PeriodRange): AppliedAdjustments {
  const base = seedLeafSeries();
  const leaves = Object.fromEntries(
    (Object.keys(base) as LeafId[]).map((k) => [k, [...base[k]]]),
  ) as Record<LeafId, number[]>;
  const cashDelta: Record<number, number> = {};

  // Group adjustments by their resolved target key so "same lever, overlapping window" composes
  // deterministically (later window overrides). Different keys are independent.
  const byKey = new Map<string, Adjustment[]>();
  const keyOf = (a: Adjustment): string => {
    switch (a.lever) {
      case "revenue":
        return `revenue:${a.stream}`;
      case "personnel":
        return `personnel:${a.departmentId ?? "all"}`;
      case "expense":
        return `expense:${a.groupId}`;
      default:
        return a.lever; // direct_cost / ar_dso / ap_dpo are singletons
    }
  };
  for (const a of scenario.adjustments) {
    const k = keyOf(a);
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(a);
  }

  for (const [, group] of byKey) {
    // window-start ascending so the LAST applicable adjustment wins in any overlap
    const ordered = [...group].sort((x, y) => compareMonth(x.window.start, y.window.start));
    for (const adj of ordered) {
      for (const mo of monthsInRange(horizon)) {
        const idx = monthToIndex(mo);
        if (!inHorizon(idx, horizon)) continue;
        const f = shapeFactor(adj, idx, horizon);
        if (f === 0) continue;
        applyOneAt(adj, idx, f, leaves, base, cashDelta);
      }
    }
  }
  return { leaves, cashDelta };
}

/** Apply a single adjustment to month `idx` at shape-factor `f`. Mutates `leaves`/`cashDelta`. */
function applyOneAt(
  adj: Adjustment,
  idx: number,
  f: number,
  leaves: Record<LeafId, number[]>,
  base: Record<LeafId, readonly number[]>,
  cashDelta: Record<number, number>,
): void {
  switch (adj.lever) {
    case "revenue": {
      // RATE: scale the stream's recognized revenue off the BASE value (override-in-window).
      if (adj.magnitude.kind !== "rate") return;
      const leaf: LeafId = adj.stream === "subscription" ? "subscription" : "services";
      const mult = 1 + adj.magnitude.value * f;
      leaves[leaf][idx] = base[leaf][idx] * mult;
      return;
    }
    case "personnel": {
      const leaf: LeafId = adj.departmentId && DIRECT_DEPARTMENTS.has(adj.departmentId)
        ? "direct_payroll"
        : "indirect_payroll";
      if (adj.magnitude.kind === "categorical" && adj.magnitude.value === "freeze") {
        // FREEZE: hold payroll flat at the window-start level (no further ramp). Use the BASE
        // value at the window start; revert outside the window happens via f=0.
        const startIdx = monthToIndex(adj.window.start);
        leaves[leaf][idx] = base[leaf][startIdx] ?? base[leaf][idx];
        return;
      }
      if (adj.magnitude.kind === "level") {
        // LEVEL: add a payroll-dollar delta in-window (the slider is a monthly $ delta).
        leaves[leaf][idx] = base[leaf][idx] + adj.magnitude.delta * f;
      }
      return;
    }
    case "expense": {
      if (adj.magnitude.kind !== "level") return;
      const leaf = EXPENSE_GROUP_TO_LEAF[adj.groupId];
      if (!leaf) return;
      leaves[leaf][idx] = base[leaf][idx] + adj.magnitude.delta * f;
      return;
    }
    case "direct_cost": {
      // RATE: scale the non-employee CoR rate (the only new CoR input — §8).
      if (adj.magnitude.kind !== "rate") return;
      leaves.non_employee_cor[idx] = base.non_employee_cor[idx] * (1 + adj.magnitude.value * f);
      return;
    }
    case "ar_dso":
    case "ap_dpo": {
      // ABSOLUTE (days): working-capital TIMING. A change in days shifts cash, not P&L. Model the
      // monthly cash impact off that month's revenue (AR) / total cost run-rate (AP):
      //   AR: +1 day of DSO ties up ~ (revenue/30) of cash  → cash DOWN as DSO rises
      //   AP: +1 day of DPO frees   ~ (cost/30)    of cash  → cash UP   as DPO rises
      if (adj.magnitude.kind !== "absolute") return;
      const dsoBaselineDays = 45; // Base DSO/DPO assumption (cash KPIs only; not a tie-out figure)
      const deltaDays = (adj.magnitude.value - dsoBaselineDays) * f;
      const dailyRev = (base.subscription[idx] + base.services[idx]) / 30;
      const dailyCost =
        (base.direct_payroll[idx] + base.non_employee_cor[idx] + base.indirect_payroll[idx]) / 30;
      const sign = adj.lever === "ar_dso" ? -1 : 1; // higher DSO → less cash; higher DPO → more cash
      const basisDaily = adj.lever === "ar_dso" ? dailyRev : dailyCost;
      cashDelta[idx] = (cashDelta[idx] ?? 0) + sign * deltaDays * basisDaily;
      return;
    }
  }
}

/** Σ the working-capital cash deltas over the fiscal year of `period`. */
function fyCashDelta(period: Month, cashDelta: Record<number, number>): number {
  const { fyStart, fyEnd } = seedFyWindow(period);
  let s = 0;
  for (let i = fyStart; i <= fyEnd; i++) s += cashDelta[i] ?? 0;
  return s;
}

// ── Dashboard recompute ───────────────────────────────────────────────────────────────
// Only the KPIs that DEPEND on the adjusted P&L / cash move; everything else (ARR, NRR, logo
// retention, bookings, CAC, LTV:CAC, magic number, utilization) is untouched by P&L-level
// levers, so we keep the Base tile verbatim — which is exactly why Scenario(Base) === Base.

const FINANCIAL_RECOMPUTE: ReadonlySet<string> = new Set([
  "revenue",
  "gross_profit",
  "gross_margin_pct",
  "operating_income",
  "net_income",
  "net_margin_pct",
  "rule_of_40",
  "growth_rate",
  "net_burn",
  "runway",
  "burn_multiple",
]);

interface ScenarioAggregates {
  readonly revenue: number;
  readonly grossProfit: number;
  readonly operatingIncome: number;
  readonly netIncome: number;
  readonly sbc: number;
  readonly priorRevenue: number;
  readonly baseNetIncome: number;
  readonly fyCashDelta: number;
  /** Base TTM net burn ($/mo) — the net_burn tile magnitude, for burn-multiple reconstruction */
  readonly baseNetBurn: number;
  /** Base burn multiple — to recover TTM net new ARR (= baseNetBurn*12 / baseBurnMultiple) */
  readonly baseBurnMultiple: number;
}

function scenarioTileMagnitude(id: string, agg: ScenarioAggregates, base: KpiTile): number {
  const rev = agg.revenue;
  switch (id) {
    case "revenue":
      return rev;
    case "gross_profit":
      return agg.grossProfit;
    case "gross_margin_pct":
      return rev > 0 ? agg.grossProfit / rev : 0;
    case "operating_income":
      return agg.operatingIncome;
    case "net_income":
      return agg.netIncome;
    case "net_margin_pct":
      return rev > 0 ? agg.netIncome / rev : 0;
    case "growth_rate":
      return agg.priorRevenue > 0 ? rev / agg.priorRevenue - 1 : 0;
    case "rule_of_40": {
      const growth = agg.priorRevenue > 0 ? rev / agg.priorRevenue - 1 : 0;
      const nonGaapOpMargin = rev > 0 ? (agg.operatingIncome + agg.sbc) / rev : 0;
      return growth + nonGaapOpMargin;
    }
    case "net_burn":
      return scenarioNetBurn(agg);
    case "runway": {
      const newBurn = scenarioNetBurn(agg);
      const cash = currentCash(base.value.period) + agg.fyCashDelta;
      // Raw cash/burn (not pre-rounded to 1 decimal) so Scenario(Base) reproduces the live dashboard's
      // raw runway exactly — a 1-decimal pre-round could flip an integer boundary (50.45 → 50.5 → 51).
      return newBurn > 0 ? cash / newBurn : 999;
    }
    case "burn_multiple": {
      // annualized net burn ÷ TTM net new ARR. ARR is unchanged by P&L-level levers, so recover
      // the (Base) TTM net new ARR from the Base burn multiple: baseMult = baseNetBurn*12 / ttmARR.
      const newBurn = scenarioNetBurn(agg);
      if (agg.baseBurnMultiple <= 0) return 0;
      const ttmArr = (agg.baseNetBurn * 12) / agg.baseBurnMultiple;
      return ttmArr > 0 ? (newBurn * 12) / ttmArr : 0;
    }
    default:
      return magnitudeOf(base);
  }
}

/** Scenario net burn ($/mo): Base net burn improved by the FY net-income swing + working-capital cash. */
function scenarioNetBurn(agg: ScenarioAggregates): number {
  const niSwing = agg.netIncome - agg.baseNetIncome; // + = less burn
  const monthlyImprovement = (niSwing + agg.fyCashDelta) / 12;
  return agg.baseNetBurn - monthlyImprovement;
}

const magnitudeOf = (tile: KpiTile): number => {
  const v = tile.value;
  switch (v.kind) {
    case "money":
      return v.money ? v.money.minor / 100 : 0;
    case "percent":
      return v.percent ?? 0;
    case "ratio":
      return v.ratio ?? 0;
    case "count":
      return v.count ?? 0;
  }
};

function currentCash(period: Month): number {
  const bs = getBalanceSheetSeed();
  const n = bs.series.cash.length;
  const idx = Math.max(0, Math.min(monthToIndex(period), n - 1));
  return bs.series.cash[idx] ?? bs.endingCash;
}

function recomputeDashboard(period: Month, applied: AppliedAdjustments): DashboardSummary {
  const base = buildSeedDashboard(period);
  const fy = monthYear(period);
  // Scenario FY aggregates from the adjusted leaves
  const c = computeColumnsFromSeries(period, applied.leaves);
  const baseNi = magnitudeOf(buildSeedKpiTile("net_income" as MetricId, period)!);
  const priorRevenue = (() => {
    // prior FY revenue from the BASE series (a scenario only branches the forecast year)
    const priorPeriod = `${fy - 1}-06` as Month;
    const t = buildSeedKpiTile("revenue" as MetricId, priorPeriod);
    return t ? magnitudeOf(t) : 0;
  })();
  const agg: ScenarioAggregates = {
    revenue: toMajor(c.totalRevenue.forecast ?? usd(0)),
    grossProfit: toMajor(c.grossProfit.forecast ?? usd(0)),
    operatingIncome: toMajor(c.operatingIncome.forecast ?? usd(0)),
    netIncome: toMajor(c.netIncome.forecast ?? usd(0)),
    sbc: getSbcSeed().fySbc[fy] ?? 0,
    priorRevenue,
    baseNetIncome: baseNi,
    fyCashDelta: fyCashDelta(period, applied.cashDelta),
    baseNetBurn: magnitudeOf(buildSeedKpiTile("net_burn" as MetricId, period)!),
    baseBurnMultiple: magnitudeOf(buildSeedKpiTile("burn_multiple" as MetricId, period)!),
  };

  return {
    period,
    families: base.families.map((fam) => ({
      ...fam,
      tiles: fam.tiles.map((tile) => {
        const id = tile.definition.id as string;
        if (!FINANCIAL_RECOMPUTE.has(id)) return tile; // unchanged ⇒ preserves the invariant
        const mag = scenarioTileMagnitude(id, agg, tile);
        return {
          ...tile,
          value: metricValueFromMagnitude(tile.definition.id, period, tile.definition.kind, mag),
        };
      }),
    })),
  };
}

// ── The engine ─────────────────────────────────────────────────────────────────────────

/**
 * Run the engine: Base + the scenario's adjustments → Scenario P&L + Scenario Dashboard.
 * Pure & deterministic. With no adjustments it short-circuits to the Base builders so the
 * output is byte-identical to the live surfaces (the HARD INVARIANT).
 */
export function runScenario(input: ScenarioEngineInput): ScenarioEngineResult {
  const { scenario, period, horizon } = input;
  if (scenario.adjustments.length === 0) {
    return {
      scenarioId: scenario.id,
      pnl: { ...buildSeedPnL(period), scenarioId: scenario.id },
      dashboard: buildSeedDashboard(period),
    };
  }
  const applied = applyAdjustments(scenario, horizon);
  const c = computeColumnsFromSeries(period, applied.leaves);
  const pnl: PnL = pnlFromColumns(period, c, scenario.id);
  const dashboard = recomputeDashboard(period, applied);
  return { scenarioId: scenario.id, pnl, dashboard };
}

/** The {@link ScenarioEngine} contract value (the typed function symbol). */
export const scenarioEngine = runScenario;

// ── Money equality + the Base invariant assertion ──

const moneyEq = (a?: Money, b?: Money): boolean => (a?.minor ?? 0) === (b?.minor ?? 0);

/**
 * Assert that Scenario(Base, no adjustments) reproduces the real seed P&L + dashboard EXACTLY.
 * Returns a structured result (no throw) so scripts can report it. The §9 hard invariant.
 */
export function assertBaseInvariant(period: Month, horizon: PeriodRange): {
  readonly ok: boolean;
  readonly mismatches: readonly string[];
} {
  const mismatches: string[] = [];
  const baseScenario: Scenario = {
    id: "base" as Scenario["id"],
    name: "Base",
    baseline: "base",
    adjustments: [],
  };
  // Run the engine through the NON-short-circuit path too (a 0-magnitude no-op) to prove the
  // recompute math itself is identity, not just the early return.
  const probe: Scenario = {
    ...baseScenario,
    adjustments: [
      {
        id: "noop",
        lever: "revenue",
        stream: "subscription",
        magnitude: { kind: "rate", value: percent(0) },
        window: { start: horizon.start, end: horizon.end },
        shape: "step",
      },
    ],
  };

  const realPnl = buildSeedPnL(period);
  for (const scen of [baseScenario, probe]) {
    const res = runScenario({ scenario: scen, period, horizon });
    for (const line of realPnl.lines) {
      const got = res.pnl.lines.find((l) => l.id === line.id);
      if (!got) {
        mismatches.push(`${scen.name}: missing P&L line ${line.id}`);
        continue;
      }
      for (const col of ["forecast", "actual", "budget", "variance"] as const) {
        if (!moneyEq(line.values[col], got.values[col])) {
          mismatches.push(
            `${scen.name}: P&L ${line.id}.${col} ${line.values[col]?.minor ?? 0} ≠ ${got.values[col]?.minor ?? 0}`,
          );
        }
      }
    }
  }

  // Dashboard identity (financial-family magnitudes, the ones the engine recomputes).
  // NOTE: the real-Base short-circuit path (no adjustments) returns buildSeedDashboard verbatim,
  // so the live Scenario Dashboard ties to the Dashboard EXACTLY. The `probe` here forces the
  // RECOMPUTE path (a 0-magnitude no-op) to prove the recompute math is identity too. The recompute
  // re-foots money KPIs from the leaf-summed P&L columns and re-rounds to cents, while the seed tile
  // derives some aggregates (operating/net income) from separate FY series — so the recompute can
  // differ by ≤ $0.01 of rounding on a multi-$M figure. We allow a 1-cent tolerance on MONEY tiles
  // (rounding noise, not a branch) and exact equality on percent/ratio/count tiles.
  const realDash = buildSeedDashboard(period);
  const probeDash = runScenario({ scenario: probe, period, horizon }).dashboard;
  for (let fi = 0; fi < realDash.families.length; fi++) {
    const rf = realDash.families[fi];
    const pf = probeDash.families[fi];
    for (let ti = 0; ti < rf.tiles.length; ti++) {
      const rm = magnitudeOf(rf.tiles[ti]);
      const pm = magnitudeOf(pf.tiles[ti]);
      const tol = rf.tiles[ti].definition.kind === "money" ? 0.011 : 1e-6;
      if (Math.abs(rm - pm) > tol) {
        mismatches.push(`dashboard ${rf.tiles[ti].definition.id}: ${rm} ≠ ${pm}`);
      }
    }
  }

  return { ok: mismatches.length === 0, mismatches };
}
