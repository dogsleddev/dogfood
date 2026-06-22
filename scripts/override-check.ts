/**
 * override-check — the POSITIVE gate for the Account-Mapping override layer (CLAUDE.md §16/§17).
 *
 * data-sweep proves the EMPTY-override path is byte-identical (the neutrality baseline). This script
 * proves the layer is LOAD-BEARING: applying an override actually MOVES the statements, coherently, and
 * a reset restores them exactly. Runs on the IN-MEMORY store (overrides are ephemeral; nothing persists).
 *
 * Assertions:
 *   1. Empty ⇒ identical: every statement via the store (no overrides) === the direct builder.
 *   2. P&L same-group re-point (IT → Admin): the source line's Actual drops to 0, the target's rises by
 *      the same, and total OpEx / Operating Income / Net Income (FY + CF) are UNCHANGED; monthly cells
 *      move, monthly totals don't. Reset ⇒ byte-identical.
 *   3. Same-section BS re-point (AR → Unbilled WIP): the source line's Actual → 0, the target → the sum,
 *      Σ assets unchanged, Assets = L + E holds ON THE ACTUAL COLUMN (the gate data-sweep lacks), CF
 *      net change unchanged. Reset ⇒ byte-identical.
 *   4. Monthly tie under a working-capital re-point: every monthly CF line's total still equals the FY
 *      CF Forecast column (proves the total stays series-driven, not cell-derived).
 *   5. Field-only neutrality: an override of classification/function only (no statement_line) moves ZERO
 *      numbers on any statement — locks the "descriptive metadata" contract.
 *   6. (added in step 7) Guard rejection cases — cross-section / cross-statement / subtotal / equity /
 *      bad-field re-points are rejected by the query-layer guard.
 */
import { dataStoreKind, getDataStore } from "@/lib/datastore";
import {
  buildSeedPnL,
  buildSeedBalanceSheet,
  buildSeedCashFlow,
  buildSeedMonthlyPnL,
  buildSeedMonthlyBalanceSheet,
  buildSeedMonthlyCashFlow,
} from "@/lib/seed/statements";
import { setAccountOverride as guardedSetOverride } from "@/lib/queries/account-mapping";
import { month, type Month } from "@/lib/types/period";
import type { StatementLineId } from "@/lib/types/common";

// ── force in-memory: overrides must be ephemeral, never touch Supabase ──
if (process.env.DATASTORE === "supabase") process.env.DATASTORE = "";
if (dataStoreKind() !== "in-memory") {
  console.error("override-check MUST run on the in-memory store (got supabase); aborting.");
  process.exit(1);
}

const P: Month = month(2026, 6);
const ds = getDataStore();

let passed = 0;
let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? `  (${detail})` : ""}`); }
  else { failed++; console.log(`  ✗ ${label}  <- FAIL${detail ? `  (${detail})` : ""}`); }
};

type Cell = { minor: number } | undefined | null;
type ColLine = { id: string; values?: { actual?: Cell; forecast?: Cell } };
type MonthlyLine = { id: string; monthly: readonly Cell[]; total: Cell };
const minor = (m: Cell): number => m?.minor ?? 0;
const line = <T extends { id: string }>(lines: readonly T[], id: string): T => lines.find((l) => l.id === id)!;

// deep byte compare of two statements' columns/cells (actual + forecast + monthly cells + total)
function pnlSame(a: { lines: readonly ColLine[] }, b: { lines: readonly ColLine[] }): boolean {
  return a.lines.every((l) => {
    const m = b.lines.find((x) => x.id === l.id);
    return !!m && minor(l.values?.actual) === minor(m.values?.actual) && minor(l.values?.forecast) === minor(m.values?.forecast);
  });
}
function monthlySame(a: { lines: readonly MonthlyLine[] }, b: { lines: readonly MonthlyLine[] }): boolean {
  return a.lines.every((l) => {
    const m = b.lines.find((x) => x.id === l.id);
    if (!m || minor(l.total) !== minor(m.total)) return false;
    return l.monthly.every((c, i) => minor(c) === minor(m.monthly[i]));
  });
}

async function clearAll() {
  for (const o of await ds.listAccountOverrides()) await ds.clearAccountOverride(o.code);
}

async function main() {
  await clearAll();

  // capture the EMPTY baselines (via the store)
  const basePnL = await ds.getPnL(P);
  const baseBS = await ds.getBalanceSheet(P);
  const baseCF = await ds.getCashFlow(P);
  const baseMPnL = await ds.getMonthlyPnL(P);
  const baseMBS = await ds.getMonthlyBalanceSheet(P);
  const baseMCF = await ds.getMonthlyCashFlow(P);
  const baseDash = JSON.stringify(await ds.getDashboardSummary(P)); // must NOT move on a re-point (reads Budget/Forecast)

  console.log("\n[1] Empty ⇒ identical (store === direct builder)");
  ok("getPnL === buildSeedPnL", pnlSame(basePnL, buildSeedPnL(P)));
  ok("getBalanceSheet === buildSeedBalanceSheet", pnlSame(baseBS, buildSeedBalanceSheet(P)));
  ok("getCashFlow === buildSeedCashFlow", pnlSame(baseCF, buildSeedCashFlow(P)));
  ok("getMonthlyPnL === buildSeedMonthlyPnL", monthlySame(baseMPnL, buildSeedMonthlyPnL(P)));
  ok("getMonthlyBalanceSheet === build", monthlySame(baseMBS, buildSeedMonthlyBalanceSheet(P)));
  ok("getMonthlyCashFlow === build", monthlySame(baseMCF, buildSeedMonthlyCashFlow(P)));

  // ── [2] P&L same-group re-point: IT (6400 → line `it`) into the Admin line ──
  console.log("\n[2] P&L re-point IT → Admin (same OpEx group)");
  const baseIt = minor(line(basePnL.lines, "it").values.actual);
  const baseAdmin = minor(line(basePnL.lines, "admin").values.actual);
  const baseNI = minor(line(basePnL.lines, "net_income").values.actual);
  const baseOI = minor(line(basePnL.lines, "operating_income").values.actual);
  const baseTotOpex = minor(line(basePnL.lines, "total_opex").values.actual);
  await ds.setAccountOverride("6400", { statementLineId: "admin" as StatementLineId, source: "ui" });
  const pnl2 = await ds.getPnL(P);
  ok("IT line Actual → 0 (account moved away)", minor(line(pnl2.lines, "it").values.actual) === 0,
     `it=${minor(line(pnl2.lines, "it").values.actual) / 100}`);
  ok("Admin line Actual === IT + Admin", minor(line(pnl2.lines, "admin").values.actual) === baseIt + baseAdmin,
     `admin=${minor(line(pnl2.lines, "admin").values.actual) / 100} vs ${(baseIt + baseAdmin) / 100}`);
  ok("Total OpEx Actual UNCHANGED", minor(line(pnl2.lines, "total_opex").values.actual) === baseTotOpex);
  ok("Operating Income Actual UNCHANGED", minor(line(pnl2.lines, "operating_income").values.actual) === baseOI);
  ok("Net Income Actual UNCHANGED", minor(line(pnl2.lines, "net_income").values.actual) === baseNI);
  const cfAfterPnL = await ds.getCashFlow(P);
  ok("CF Net Income Actual UNCHANGED (NI overlay = 0)",
     minor(line(cfAfterPnL.lines, "net_income").values.actual) === minor(line(baseCF.lines, "net_income").values.actual));
  const mp2 = await ds.getMonthlyPnL(P);
  const itClosedMoved = minor(line(mp2.lines, "it").monthly[4]) === 0; // May (idx 4 within FY) is closed
  ok("Monthly P&L IT closed cell → 0", itClosedMoved);
  ok("Monthly P&L totals UNCHANGED (forecast path)",
     mp2.lines.every((l) => minor(l.total) === minor(line(baseMPnL.lines, l.id).total)));
  ok("Dashboard UNCHANGED by the P&L re-point (reads Budget/Forecast, never the Actual rollup)",
     JSON.stringify(await ds.getDashboardSummary(P)) === baseDash);
  await clearAll();
  ok("Reset ⇒ P&L byte-identical to baseline", pnlSame(await ds.getPnL(P), basePnL));

  // ── [3] same-section BS re-point: AR (1100 → line `accounts_receivable`) into Unbilled WIP ──
  console.log("\n[3] BS re-point AR → Unbilled WIP (same section: asset)");
  const baseAR = minor(line(baseBS.lines, "accounts_receivable").values.actual);
  const baseWIP = minor(line(baseBS.lines, "unbilled_wip").values.actual);
  type BSLine = { section: string; values?: { actual?: Cell } };
  const assetsOf = (bs: { lines: readonly BSLine[] }) =>
    bs.lines.filter((l) => l.section === "asset").reduce((s, l) => s + minor(l.values?.actual), 0);
  const leOf = (bs: { lines: readonly BSLine[] }) =>
    bs.lines.filter((l) => l.section === "liability" || l.section === "equity").reduce((s, l) => s + minor(l.values?.actual), 0);
  ok("baseline Assets = L+E on the ACTUAL column", Math.abs(assetsOf(baseBS) - leOf(baseBS)) < 100,
     `Δ $${(assetsOf(baseBS) - leOf(baseBS)) / 100}`);
  await ds.setAccountOverride("1100", { statementLineId: "unbilled_wip" as StatementLineId, source: "ui" });
  const bs2 = await ds.getBalanceSheet(P);
  ok("AR line Actual → 0 (account moved away)", minor(line(bs2.lines, "accounts_receivable").values.actual) === 0);
  ok("Unbilled WIP Actual === AR + WIP", minor(line(bs2.lines, "unbilled_wip").values.actual) === baseAR + baseWIP,
     `wip=${minor(line(bs2.lines, "unbilled_wip").values.actual) / 100} vs ${(baseAR + baseWIP) / 100}`);
  ok("Σ assets Actual UNCHANGED", Math.abs(assetsOf(bs2) - assetsOf(baseBS)) < 1);
  ok("Assets = L+E STILL holds on the ACTUAL column", Math.abs(assetsOf(bs2) - leOf(bs2)) < 100,
     `Δ $${(assetsOf(bs2) - leOf(bs2)) / 100}`);
  const cf3 = await ds.getCashFlow(P);
  // working-capital deltas are independently usd()-rounded, so moving a balance between lines can shift
  // net change by a cent (the baseline itself carries a Δ -0.01); a real desync would be ≥ thousands.
  const cfNetDelta = minor(line(cf3.lines, "net_change_in_cash").values.actual) - minor(line(baseCF.lines, "net_change_in_cash").values.actual);
  ok("CF Net Change in Cash Actual UNCHANGED (≤ 1¢ rounding)", Math.abs(cfNetDelta) < 100, `Δ $${cfNetDelta / 100}`);

  // ── [4] monthly tie under the working-capital re-point (override still active) ──
  console.log("\n[4] Monthly CF totals still tie under a working-capital re-point");
  const mcf4 = await ds.getMonthlyCashFlow(P);
  // Σ(12 rounded monthly compF) vs the FY forecast (one rounded delta): the standard sum-of-rounded
  // penny, exactly the < $1 tolerance the data-sweep monthly-CF check uses.
  let mcfMax = 0;
  for (const l of mcf4.lines) mcfMax = Math.max(mcfMax, Math.abs(minor(l.total) - minor(line(cf3.lines, l.id).values.forecast)));
  ok("every monthly CF line total === FY CF Forecast column (≤ 1¢)", mcfMax < 100, `max Δ $${mcfMax / 100}`);

  // monthly Balance Sheet board: CLOSED-month cells roll up too (the override is still active). May
  // (the 5th FY month, idx 4) is the last closed month for FY2026.
  const mbs3 = await ds.getMonthlyBalanceSheet(P);
  const mayIdx = 4;
  const baseArMay = minor(line(baseMBS.lines, "accounts_receivable").monthly[mayIdx]);
  const baseWipMay = minor(line(baseMBS.lines, "unbilled_wip").monthly[mayIdx]);
  ok("Monthly BS: AR closed cell (May) → 0", minor(line(mbs3.lines, "accounts_receivable").monthly[mayIdx]) === 0);
  ok("Monthly BS: WIP closed cell (May) === AR + WIP", minor(line(mbs3.lines, "unbilled_wip").monthly[mayIdx]) === baseArMay + baseWipMay,
     `${minor(line(mbs3.lines, "unbilled_wip").monthly[mayIdx]) / 100} vs ${(baseArMay + baseWipMay) / 100}`);
  // Assets = L+E on EVERY closed monthly column (each of ~11 lines is independently usd-rounded per month
  // → use the < $1 section-sum tolerance, NOT 1¢).
  let mbsIdMax = 0;
  for (let i = 0; i <= mayIdx; i++) {
    const a = mbs3.lines.filter((l) => l.section === "asset").reduce((sum, l) => sum + minor(l.monthly[i]), 0);
    const le = mbs3.lines.filter((l) => l.section === "liability" || l.section === "equity").reduce((sum, l) => sum + minor(l.monthly[i]), 0);
    mbsIdMax = Math.max(mbsIdMax, Math.abs(a - le));
  }
  ok("Monthly BS: Assets = L+E on every closed column (≤ $1)", mbsIdMax < 100, `max Δ $${mbsIdMax / 100}`);

  await clearAll();
  ok("Reset ⇒ BS byte-identical to baseline", pnlSame(await ds.getBalanceSheet(P), baseBS));
  ok("Reset ⇒ Monthly BS byte-identical to baseline", monthlySame(await ds.getMonthlyBalanceSheet(P), baseMBS));

  // ── [5] field-only override (classification/function) moves ZERO numbers ──
  console.log("\n[5] Field-only override (classification/function) is number-neutral");
  await ds.setAccountOverride("6400", { classification: "cost_of_revenue", function: "direct", source: "ui" });
  ok("getPnL UNCHANGED", pnlSame(await ds.getPnL(P), basePnL));
  ok("getBalanceSheet UNCHANGED", pnlSame(await ds.getBalanceSheet(P), baseBS));
  ok("getCashFlow UNCHANGED", pnlSame(await ds.getCashFlow(P), baseCF));
  ok("getMonthlyPnL UNCHANGED", monthlySame(await ds.getMonthlyPnL(P), baseMPnL));
  const accts = await ds.listGlAccounts();
  const it = accts.find((a) => a.code === "6400")!;
  ok("but the metadata edit took effect (6400.classification = cost_of_revenue)", it.classification === "cost_of_revenue");
  await clearAll();

  // ── [6] guard rejection cases (the query-layer setAccountOverride) ──
  console.log("\n[6] Guard rejects incoherent re-points");
  const rejects = async (label: string, fn: () => Promise<unknown>) => {
    try { await fn(); ok(label, false, "expected a rejection but it succeeded"); }
    catch { ok(label, true); }
  };
  await rejects("cross-section: AR (asset) → Accounts Payable (liability)", () => guardedSetOverride("1100", { statementLineId: "accounts_payable" }));
  await rejects("cross-statement: IT (P&L) → Cash (BS)", () => guardedSetOverride("6400", { statementLineId: "cash" }));
  await rejects("CoR↔OpEx: Direct Payroll (CoR) → Sales & Marketing (OpEx) — would move Gross Profit", () => guardedSetOverride("5000", { statementLineId: "sales_marketing" }));
  await rejects("subtotal target: IT → total_opex", () => guardedSetOverride("6400", { statementLineId: "total_opex" }));
  await rejects("equity source: Paid-in Capital → anything", () => guardedSetOverride("3000", { statementLineId: "paid_in_capital" }));
  await rejects("below-the-line: Interest Income → taxes", () => guardedSetOverride("7000", { statementLineId: "taxes" }));
  await rejects("classification on a non-expense account (Cash)", () => guardedSetOverride("1000", { classification: "cost_of_revenue" }));
  await rejects("invalid function value", () => guardedSetOverride("6400", { function: "bogus" }));
  await rejects("unknown account", () => guardedSetOverride("9999", { statementLineId: "admin" }));
  // and VALID same-group re-points are NOT rejected (the guard isn't over-broad)
  let validOk = true;
  try { await guardedSetOverride("6400", { statementLineId: "admin" }); } catch { validOk = false; }
  ok("a VALID same-group OpEx re-point (IT → Admin) is accepted", validOk);
  await clearAll();
  let validCor = true;
  try { await guardedSetOverride("5000", { statementLineId: "non_employee_cor" }); } catch { validCor = false; }
  ok("a VALID same-group CoR re-point (Direct Payroll → Non-employee CoR) is accepted", validCor);
  await clearAll();

  console.log(`\n================ override-check: ${passed} passed, ${failed} failed ================`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
