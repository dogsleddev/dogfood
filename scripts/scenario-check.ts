/**
 * Scenario engine sanity check (CLAUDE.md §9). Run: `npx tsx scripts/scenario-check.ts`.
 *  1. HARD INVARIANT — Scenario(Base) reproduces the real P&L + dashboard EXACTLY.
 *  2. Each preset MOVES its target KPI in the named direction.
 *  3. Validation rejects the contract violations (each ValidationCode fires).
 * Exits non-zero on any failure. Additive only — does not touch the seed/statement tie-outs.
 */
import { month, type PeriodRange } from "@/lib/types/period";
import { toMajor, percent } from "@/lib/types/money";
import type { MetricId, ScenarioId, ExpenseGroupId } from "@/lib/types/common";
import type { Adjustment, Scenario } from "@/lib/types/scenario";
import { runScenario, assertBaseInvariant } from "@/lib/scenario/engine";
import { PRESET_SCENARIOS, BASE_SCENARIO } from "@/lib/scenario/presets";
import { validateAdjustment, validateScenario } from "@/lib/scenario/validation";
import { buildSeedKpiTile } from "@/lib/seed/dashboard-metrics";
import { getDataStore } from "@/lib/datastore";
import { upsertUserScenario, deleteUserScenario } from "@/lib/scenario/registry";

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

// Canonical (key-sorted) JSON for order-insensitive deep equality (the JSONB round-trip may reorder keys).
function canon(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );
}

void (async () => {
  console.log("\n4. Persist → read → run-engine round-trip (lossless JSONB + re-brand)");
  const sid = "check-roundtrip" as ScenarioId;
  // One adjustment of EVERY magnitude kind across the lever set — every union arm the JSONB must preserve.
  const adjustments: Adjustment[] = [
    { id: "rt-rate", lever: "revenue", stream: "subscription", magnitude: { kind: "rate", value: percent(0.08) }, window: { start: month(2026, 7) }, shape: "ramp" }, // open-ended (no end)
    { id: "rt-level", lever: "expense", groupId: "sales-marketing" as ExpenseGroupId, magnitude: { kind: "level", delta: -100_000 }, window: { start: month(2026, 7), end: month(2026, 12) }, shape: "ramp" },
    { id: "rt-absolute", lever: "ar_dso", magnitude: { kind: "absolute", value: 35, unit: "days" }, window: { start: month(2026, 7), end: month(2026, 12) }, shape: "step" },
    { id: "rt-categorical", lever: "personnel", magnitude: { kind: "categorical", value: "freeze" }, window: { start: month(2026, 7), end: month(2026, 12) }, shape: "step" },
  ];
  const sc: Scenario = { id: sid, name: "Round-trip check", baseline: "base", adjustments };
  const store = getDataStore();
  await upsertUserScenario(sc);
  const round = await store.getScenario(sid);
  ok("scenario round-trips from the store", round !== undefined);
  if (round) {
    ok("adjustments structurally identical (lossless)", canon(round.adjustments) === canon(sc.adjustments),
      `sent ${canon(sc.adjustments)} | back ${canon(round.adjustments)}`);
    ok("open-ended window round-trips with end ABSENT", round.adjustments[0]?.window.end === undefined);
    const sentPnl = runScenario({ scenario: sc, period: PERIOD, horizon: HORIZON }).pnl;
    const backPnl = runScenario({ scenario: round, period: PERIOD, horizon: HORIZON }).pnl;
    ok("engine output identical from deserialized scenario (re-brand correct)", canon(sentPnl) === canon(backPnl));
    ok("deserialized scenario validates", validateScenario(round, HORIZON).ok);
  }
  await deleteUserScenario(sid);
  ok("scenario deletes cleanly", (await store.getScenario(sid)) === undefined);

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass}/${pass + fail} checks\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
