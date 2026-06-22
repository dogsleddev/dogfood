import { formatMoney, formatPercent, sumMoney, percent, type Money, type Percent } from "@/lib/types/money";
import type { CostOfRevenueLine, RevenueForecastLine } from "@/lib/types/drivers";

const fmt = (m: Money) => formatMoney(m, { compact: true });
const pct = (p: Percent) => formatPercent(p, 1);

function Card({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-parchment-line bg-surface p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ember-deep">{kicker}</div>
      {children}
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" | "muted" | "total" }) {
  const valueClass =
    tone === "pos" ? "text-sage-deep" : tone === "neg" ? "text-ember-deep" : tone === "muted" ? "text-steel" : "text-ink";
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1 ${
        tone === "total" ? "mt-1 border-t border-parchment-line/70 pt-2" : ""
      }`}
    >
      <span className={`text-sm ${tone === "total" ? "font-medium text-ink" : "text-steel"}`}>{label}</span>
      <span className={`text-sm tabular-nums ${tone === "total" ? "font-semibold text-ink" : valueClass}`}>{value}</span>
    </div>
  );
}

/**
 * The FY roll-ups for the Cost of Revenue driver (CLAUDE.md §8, layer 2). Reads the same live
 * series the monthly table renders: the assembled FY Cost of Revenue split into its two inputs
 * (Direct Payroll from Personnel + the non-employee cost-to-serve rate × revenue per stream), the
 * per-stream cost-to-serve rates, and the gross-margin linkage (Revenue − CoR = Gross Profit), which
 * reconciles to the P&L Total Cost of Revenue / Gross Margin % lines by construction.
 */
export function CostOfRevenueCards({
  lines,
  subLines,
  svcLines,
  revLines,
}: {
  lines: readonly CostOfRevenueLine[];
  subLines: readonly CostOfRevenueLine[];
  svcLines: readonly CostOfRevenueLine[];
  revLines: readonly RevenueForecastLine[];
}) {
  const directFy = sumMoney(lines.map((l) => l.directPayroll));
  const nonEmpFy = sumMoney(lines.map((l) => l.nonEmployee));
  const corFy = sumMoney(lines.map((l) => l.total));

  const revFy = sumMoney(revLines.map((l) => l.total));
  const grossProfitFy: Money = { minor: revFy.minor - corFy.minor, currency: revFy.currency };
  const grossMarginPct: Percent = percent(revFy.minor > 0 ? grossProfitFy.minor / revFy.minor : 0);
  const corPctOfRev: Percent = percent(revFy.minor > 0 ? corFy.minor / revFy.minor : 0);

  // Per-stream blended cost-to-serve rate over the FY (non-employee ÷ that stream's revenue).
  const subRev = sumMoney(revLines.filter((l) => l.stream === "subscription").map((l) => l.total));
  const svcRev = sumMoney(revLines.filter((l) => l.stream === "services").map((l) => l.total));
  const subNeFy = sumMoney(subLines.map((l) => l.nonEmployee));
  const svcNeFy = sumMoney(svcLines.map((l) => l.nonEmployee));
  const subRate: Percent = percent(subRev.minor > 0 ? subNeFy.minor / subRev.minor : 0);
  const svcRate: Percent = percent(svcRev.minor > 0 ? svcNeFy.minor / svcRev.minor : 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card kicker="FY cost of revenue · assembled">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{fmt(corFy)}</div>
        <Line label="Direct payroll" value={fmt(directFy)} tone="muted" />
        <Line label="Non-employee (rate × rev)" value={fmt(nonEmpFy)} tone="muted" />
        <Line label="Total cost of revenue" value={fmt(corFy)} tone="total" />
      </Card>

      <Card kicker="Non-employee rate · by stream">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{pct(corPctOfRev)}</div>
        <Line label="Subscription (hosting)" value={pct(subRate)} tone="muted" />
        <Line label="Services (pass-through)" value={pct(svcRate)} tone="muted" />
        <Line label="Blended CoR % of revenue" value={pct(corPctOfRev)} tone="total" />
      </Card>

      <Card kicker="Gross profit · FY">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{fmt(grossProfitFy)}</div>
        <Line label="Total revenue" value={fmt(revFy)} tone="muted" />
        <Line label="− Cost of revenue" value={`−${fmt(corFy)}`} tone="neg" />
        <Line label="Gross profit" value={fmt(grossProfitFy)} tone="total" />
      </Card>

      <Card kicker="Gross margin %">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{pct(grossMarginPct)}</div>
        <Line label="Gross profit ÷ revenue" value={pct(grossMarginPct)} tone="pos" />
        <Line label="CoR % of revenue" value={pct(corPctOfRev)} tone="muted" />
        <Line label="Ties to P&amp;L Gross Margin %" value="by construction" tone="muted" />
      </Card>
    </div>
  );
}
