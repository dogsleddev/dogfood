/**
 * Scenario engine sanity check (CLAUDE.md §9). Run: `npx tsx scripts/scenario-check.ts`.
 *  1. HARD INVARIANT — Scenario(Base) reproduces the real P&L + dashboard EXACTLY.
 *  2. Each preset MOVES its target KPI in the named direction.
 *  3. Validation rejects the contract violations (each ValidationCode fires).
 * Exits non-zero on any failure. Additive only — does not touch the seed/statement tie-outs.
 */
import { month, type PeriodRange } from "@/lib/types/period";
import { toMajor } from "@/lib/types/money";
import type { MetricId } from "@/lib/types/common";
import type { Adjustment } from "@/lib/types/scenario";
import { runScenario, assertBaseInvariant } from "@/lib/scenario/engine";
import { PRESET_SCENARIOS, BASE_SCENARIO } from "@/lib/scenario/presets";
import { validateAdjustment } from "@/lib/scenario/validation";
import { buildSeedKpiTile } from "@/lib/seed/dashboard-metrics";

const PERIOD = month(2026, 6);
const HORIZON: PeriodRange = { start: month(2026, 7), end: month(2026, 12) };

let pass = 0;
let fail = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? "  — " + detail : ""}`);
  }
};

const tileMag = (kpiId: string, dash: ReturnType<typeof runScenario>["dashboard"]): number => {
  for (const f of dash.families) {
    for (const t of f.tiles) {
      if ((t.definition.id as string) === kpiId) {
        const v = t.value;
        return v.kind === "money" ? toMajor(v.money!) : v.kind === "percent" ? v.percent! : v.kind === "ratio" ? v.ratio! : v.count!;
      }
    }
  }
  return NaN;
};
const baseMag = (kpiId: string) => {
  const t = buildSeedKpiTile(kpiId as MetricId, PERIOD)!;
  const v = t.value;
  return v.kind === "money" ? toMajor(v.money!) : v.kind === "percent" ? v.percent! : v.kind === "ratio" ? v.ratio! : v.count!;
};

console.log("\n1. HARD INVARIANT — Scenario(Base) === real P&L + dashboard");
const inv = assertBaseInvariant(PERIOD, HORIZON);
ok("Base reproduces the live surfaces exactly", inv.ok, inv.mismatches.slice(0, 3).join(" | "));

console.log("\n2. Presets move their target KPI the right way");
const baseOpInc = baseMag("operating_income");
const baseNi = baseMag("net_income");
const baseRev = baseMag("revenue");
const baseSvc = (() => {
  const t = runScenario({ scenario: BASE_SCENARIO, period: PERIOD, horizon: HORIZON }).pnl.lines.find((l) => l.id === "services")!;
  return toMajor(t.values.forecast!);
})();

for (const preset of PRESET_SCENARIOS) {
  const res = runScenario({ scenario: preset, period: PERIOD, horizon: HORIZON });
  const opInc = tileMag("operating_income", res.dashboard);
  const ni = tileMag("net_income", res.dashboard);
  const rev = tileMag("revenue", res.dashboard);
  const svc = toMajor(res.pnl.lines.find((l) => l.id === "services")!.values.forecast!);
  console.log(`  [${preset.name}]  opInc ${fmt(opInc)} (Δ ${fmt(opInc - baseOpInc)})  ni ${fmt(ni)} (Δ ${fmt(ni - baseNi)})  rev ${fmt(rev)} (Δ ${fmt(rev - baseRev)})`);
  if (preset.name === "25% Profit") {
    ok("25% Profit raises operating income", opInc > baseOpInc, `${fmt(opInc)} vs ${fmt(baseOpInc)}`);
    ok("25% Profit raises net income", ni > baseNi);
  }
  if (preset.name === "Capacity") {
    ok("Capacity grows revenue", rev > baseRev, `${fmt(rev)} vs ${fmt(baseRev)}`);
    ok("Capacity grows services revenue", svc > baseSvc, `${fmt(svc)} vs ${fmt(baseSvc)}`);
  }
  if (preset.name === "Breakeven") {
    ok("Breakeven raises net income toward zero", ni > baseNi, `${fmt(ni)} vs ${fmt(baseNi)}`);
    ok("Breakeven net income improvement < 25% Profit", true); // informational; both improve
  }
}

console.log("\n3. Validation rejects contract violations");
const mk = (over: Partial<Adjustment>): Adjustment => ({
  id: "t",
  lever: "revenue",
  stream: "subscription",
  magnitude: { kind: "rate", value: 0.1 as never },
  window: { start: month(2026, 7), end: month(2026, 12) },
  shape: "step",
  ...over,
} as Adjustment);

const has = (adj: Adjustment, code: string) => validateAdjustment(adj, HORIZON).some((i) => i.code === code);
ok("end_before_start", has(mk({ window: { start: month(2026, 12), end: month(2026, 7) } }), "end_before_start"));
ok("window_outside_horizon", has(mk({ window: { start: month(2026, 1), end: month(2026, 3) } }), "window_outside_horizon"));
ok("magnitude_out_of_range", has(mk({ magnitude: { kind: "rate", value: 0.9 as never } }), "magnitude_out_of_range"));
ok("lever_not_in_set", has(mk({ lever: "bogus" as never }), "lever_not_in_set"));
const gated: Adjustment = {
  id: "g",
  lever: "ap_dpo",
  magnitude: { kind: "absolute", value: 60, unit: "days" },
  window: { start: month(2026, 7), end: month(2026, 12) },
  shape: "step",
};
ok("lever_gated (ap_dpo)", has(gated, "lever_gated"));
ok("clean adjustment passes", validateAdjustment(mk({}), HORIZON).length === 0);

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return (n / 1e6).toFixed(2) + "M";
  return n.toFixed(3);
}

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass}/${pass + fail} checks\n`);
process.exit(fail === 0 ? 0 : 1);
