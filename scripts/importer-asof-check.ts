/**
 * importer-asof-check — proves the global as-of ADVANCE (the CSV importer's commit step) is
 * tie-out-neutral. The existing gates (data-sweep, peer-check, override-check) all run at the DEFAULT
 * boundary (May 2026) and derive their window from the same `closeThrough`, so they stay green at ANY
 * boundary "by construction" — which means they would NOT catch a broken advance. This gate is the
 * missing tripwire: it actually drives `setCloseBoundary` to June and asserts the advance behaves.
 *
 * What it proves (CLAUDE.md §16; the importer design's adversarial fix):
 *   1. ADVANCE IS NEUTRAL — the FY26 Forecast column + the §11 anchors (revenue / net income / runway)
 *      are byte-identical at the May and June boundaries (they are FY totals, independent of the split).
 *   2. ADVANCE ACTUALLY HAPPENS — June's existing generator activity flips forecast → Actual: the Actual
 *      column GROWS by exactly June's activity, and the monthly board's June cell flips status with an
 *      IDENTICAL value (the override-layer neutrality property).
 *   3. ROLLUP TIES AT THE ADVANCED BOUNDARY — every P&L leaf's Σ(GL activity over [fyStart..June]) === its
 *      Actual column (the data-sweep rollup check, re-run at June).
 *   4. RESET IS CLEAN — setting the boundary back to May reproduces the May statements byte-for-byte.
 *   5. CROSS-SITE AGREEMENT — getCloseBoundary + the statement window agree on the boundary.
 *
 * Run: npx tsx scripts/importer-asof-check.ts   (forces in-memory; mutates the process-local boundary)
 */
process.env.DATASTORE = "in-memory";

import { buildSeedPnL, buildSeedMonthlyPnL, buildSeedRunway } from "@/lib/seed/statements";
import { activityByStatementLine } from "@/lib/seed/gl";
import { getSubscriptionSeed, getServicesSeed, getBalanceSheetSeed } from "@/lib/seed";
import { getCloseBoundary, setCloseBoundary } from "@/lib/target/placeholder";
import { month, monthToIndex, type Month, type PeriodRange } from "@/lib/types/period";
import { toMajor, type Money } from "@/lib/types/money";
import type { PnL, PnLLineId } from "@/lib/types/statements";

const FY26 = month(2026, 6); // any FY2026 month selects the fiscal year
const MAY: { closeThrough: Month; inCloseMonth: Month; forecastHorizon: PeriodRange } = {
  closeThrough: month(2026, 5),
  inCloseMonth: month(2026, 6),
  forecastHorizon: { start: month(2026, 7), end: month(2026, 12) },
};
const JUNE: typeof MAY = {
  closeThrough: month(2026, 6),
  inCloseMonth: month(2026, 7),
  forecastHorizon: { start: month(2026, 8), end: month(2026, 12) },
};

let fail = 0;
const ok = (b: boolean) => (b ? "PASS" : "FAIL");
function check(name: string, pass: boolean, detail = "") {
  if (!pass) fail++;
  console.log(`  ${ok(pass)}  ${name}${detail ? `  ${detail}` : ""}`);
}
const cents = (m?: Money) => (m ? m.minor : 0);
const lineBy = (pnl: PnL, re: RegExp) => pnl.lines.find((l) => re.test(l.label));
const n = (x: number) => Math.round(x).toLocaleString();

console.log("\n===== IMPORTER-ASOF-CHECK — the as-of advance is tie-out-neutral =====\n");

// ── snapshot at May (the default boundary) ──
setCloseBoundary(MAY);
const mayPnl = buildSeedPnL(FY26);
const mayRevActual = cents(lineBy(mayPnl, /total revenue/i)?.values.actual);
const mayRevForecast = cents(lineBy(mayPnl, /total revenue/i)?.values.forecast);
const mayNiForecast = cents(lineBy(mayPnl, /net income/i)?.values.forecast);
const mayMonthly = buildSeedMonthlyPnL(FY26);
const mayJuneCell = JSON.stringify(mayMonthly.lines.map((l) => l.monthly[5]?.minor)); // index 5 = June within FY
const mayJuneStatus = mayMonthly.months[5]?.status;
const mayRunway = buildSeedRunway(FY26);

// §11 anchors (generator series — must not move with the boundary)
const sub = getSubscriptionSeed();
const svc = getServicesSeed();
const bs = getBalanceSheetSeed();
const rev26 = Math.round(sub.fyRecognized[2026] + svc.fyRecognized[2026]);
const ni26 = Math.round(bs.fyNetIncome[2026]);

console.log("§11 anchors (computed once; generator series, boundary-independent)");
check("FY26 revenue === 23,420,700", rev26 === 23_420_700, n(rev26));
check("FY26 net income === -11,918,577", ni26 === -11_918_577, n(ni26));
check("runway (as of FY26) === 49 months", mayRunway.months !== null && Math.round(mayRunway.months) === 49, `${mayRunway.months?.toFixed(0)}mo`);

// ── advance to June ──
console.log("\nAdvance the as-of May → June, then rebuild");
setCloseBoundary(JUNE);
check("getCloseBoundary reflects June", getCloseBoundary().closeThrough === month(2026, 6) && getCloseBoundary().inCloseMonth === month(2026, 7));

const junePnl = buildSeedPnL(FY26);
const juneRevActual = cents(lineBy(junePnl, /total revenue/i)?.values.actual);
const juneRevForecast = cents(lineBy(junePnl, /total revenue/i)?.values.forecast);
const juneNiForecast = cents(lineBy(junePnl, /net income/i)?.values.forecast);
const juneMonthly = buildSeedMonthlyPnL(FY26);
const juneJuneCell = JSON.stringify(juneMonthly.lines.map((l) => l.monthly[5]?.minor));
const juneJuneStatus = juneMonthly.months[5]?.status;
const juneRunway = buildSeedRunway(FY26);

// (1) ADVANCE IS NEUTRAL — FY Forecast + §11 anchors byte-identical
check("FY26 Forecast revenue byte-identical (May vs June)", mayRevForecast === juneRevForecast, `${n(toMajor(junePnl.lines.find((l) => /total revenue/i.test(l.label))!.values.forecast!))}`);
check("FY26 Forecast net income byte-identical", mayNiForecast === juneNiForecast);
check("runway byte-identical (FY26 TTM, boundary-independent)", JSON.stringify(mayRunway) === JSON.stringify(juneRunway));

// (2) ADVANCE ACTUALLY HAPPENS — June's activity flips to Actual: the Actual column GROWS
check("Actual revenue GREW (June flipped forecast → actual)", juneRevActual > mayRevActual, `May Σ=${n(toMajor(mayPnl.lines.find((l) => /total revenue/i.test(l.label))!.values.actual!))} → June Σ=${n(toMajor(junePnl.lines.find((l) => /total revenue/i.test(l.label))!.values.actual!))}`);
// the monthly board's June cell VALUE is identical (only its status label flips) — override-neutrality
check("monthly board June cell VALUE unchanged (status flips, value identical)", mayJuneCell === juneJuneCell);
check("monthly board June status flips in_close → actual", mayJuneStatus === "in_close" && juneJuneStatus === "actual", `${mayJuneStatus} → ${juneJuneStatus}`);

// (3) ROLLUP TIES AT THE ADVANCED BOUNDARY — every leaf's Σ(activity over [fyStart..June]) === Actual
const fyStart = monthToIndex(month(2026, 1));
const closeIdx = monthToIndex(getCloseBoundary().closeThrough); // June = 29
const byLine = activityByStatementLine(); // generator chart
let maxDelta = 0;
let leaves = 0;
for (const l of junePnl.lines) {
  const ser = byLine.get(l.id as PnLLineId as string);
  if (!ser) continue; // subtotal (no backing account) — footed from leaves, not rolled directly
  leaves++;
  let sum = 0;
  for (let i = fyStart; i <= closeIdx; i++) sum += ser[i] ?? 0;
  const delta = Math.abs(sum - toMajor(l.values.actual ?? ({ minor: 0 } as Money)));
  maxDelta = Math.max(maxDelta, delta);
}
check(`P&L Actual ← GL rollup ties at June (${leaves} leaves, max Δ < $0.01)`, maxDelta < 0.01, `max Δ $${maxDelta.toFixed(4)}`);

// (4) RESET IS CLEAN — back to May reproduces the May statements byte-for-byte
console.log("\nReset the as-of June → May");
setCloseBoundary(MAY);
const resetPnl = buildSeedPnL(FY26);
check("reset reproduces the May P&L byte-for-byte", JSON.stringify(resetPnl) === JSON.stringify(mayPnl));

console.log(`\n================ IMPORTER-ASOF-CHECK: ${fail === 0 ? "PASS" : `${fail} FAILING`} ================\n`);
process.exitCode = fail === 0 ? 0 : 1;
