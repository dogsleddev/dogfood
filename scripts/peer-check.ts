/** Temporary measurement — peer-profile retune. Prints mix, GM, runway, burn (not in data-sweep). */
import { getSubscriptionSeed, getServicesSeed, getCostOfRevenueSeed, getBalanceSheetSeed } from "@/lib/seed";
import { buildSeedDashboard } from "@/lib/seed/dashboard-metrics";
import { buildSeedRunway } from "@/lib/seed/statements";
import { formatMetricValue } from "@/lib/types/metrics";
import { toMajor } from "@/lib/types/money";
import { month } from "@/lib/types/period";

const sub = getSubscriptionSeed();
const svc = getServicesSeed();
const cor = getCostOfRevenueSeed();
const bs = getBalanceSheetSeed();
// Report runway/burn at the app's current period (app/dashboard/page.tsx uses month(2026, 6)),
// via buildSeedRunway — the SAME TTM-as-of-period source the dashboard runway/net-burn tiles use,
// so the figures below match the dashboard tiles printed at the end of this script.
const PERIOD = month(2026, 6);
const runway = buildSeedRunway(PERIOD);
const n = (x: number) => Math.round(x).toLocaleString();
const pct = (x: number) => (x * 100).toFixed(1) + "%";

console.log("\n===== PEER-PROFILE METRICS =====\n");
console.log("REVENUE + MIX (FY)");
for (const fy of [2024, 2025, 2026]) {
  const s = sub.fyRecognized[fy];
  const v = svc.fyRecognized[fy];
  const t = s + v;
  console.log(`  FY${fy}: total ${n(t)}  ·  sub ${n(s)} (${pct(s / t)})  ·  svc ${n(v)} (${pct(v / t)})`);
}
console.log("\nGROSS MARGIN (FY)");
for (const fy of [2024, 2025, 2026]) console.log(`  FY${fy}: ${pct(cor.fyGrossMarginPct[fy])}`);
console.log(`  band check: FY26 ${pct(cor.fyGrossMarginPct[2026])} · widens ${cor.fyGrossMarginPct[2024] < cor.fyGrossMarginPct[2025] && cor.fyGrossMarginPct[2025] < cor.fyGrossMarginPct[2026]}`);

console.log("\nCASH / RUNWAY");
const cashSeries = bs.series.cash;
let minCash = Infinity;
let minIdx = 0;
cashSeries.forEach((c, i) => { if (c < minCash) { minCash = c; minIdx = i; } });
console.log(`  min cash: ${n(minCash)} at month index ${minIdx} (Series B lands at index 14) ${minCash < 0 ? "⚠️ NEGATIVE" : "ok"}`);
console.log(`  ending cash: ${n(bs.endingCash)}`);
console.log(`  net burn (TTM/mo, as of ${PERIOD}): ${n(toMajor(runway.netBurn))}`);
console.log(`  runway (as of ${PERIOD}, matches dashboard tile): ${runway.months === null ? "cash-flow positive (TTM)" : runway.months.toFixed(0) + " months"}`);
console.log(`  NI by FY: ${[2024, 2025, 2026].map((fy) => `FY${fy} ${n(bs.fyNetIncome[fy])}`).join(" · ")}`);

const dash = buildSeedDashboard(PERIOD);
console.log("\nKEY DASHBOARD TILES");
for (const f of dash.families) for (const t of f.tiles) console.log(`  ${t.definition.id}: ${formatMetricValue(t.value)}`);
