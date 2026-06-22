import { cn } from "@/lib/utils";
import { usd, formatMoney } from "@/lib/types/money";
import { getSubscriptionSeed, getServicesSeed, getPersonnelSeed, getCostOfRevenueSeed, getOpExSeed, getBalanceSheetSeed } from "@/lib/seed";
import { buildSeedRunway } from "@/lib/seed/statements";
import { month } from "@/lib/types/period";
import { getLedger, CHART_OF_ACCOUNTS } from "@/lib/seed/gl";
import { SUBSCRIPTION_REVENUE_TARGETS, SERVICES_REVENUE_TARGETS, OPEX_TARGETS, GROSS_MARGIN_BAND } from "@/lib/seed/params";
import type { TieOutCheck, CheckKind } from "@/lib/seed";

const m = (dollars: number) => formatMoney(usd(dollars), { compact: true });
const FYS = [2024, 2025, 2026] as const;

/**
 * Seed QA (dev-only; not in the nav). Verifies the deterministic generator ties out.
 * Steps 1–5: subscription (606 + deferred + billings roll-forward) · services (% complete + WIP,
 * capacity-gated) · personnel + CoR (two-axis cost model) · non-payroll OpEx (8 groups) · balance
 * sheet + cash flow (AR/DSO, prepaids, fixed assets + D&A, AP/DPO; A=L+E by construction). Each
 * check carries a `kind` (independent / calibration / definitional / sanity) so "all green" is not
 * mistaken for "all reconciled" — see the tie-out audit (tie-out-audit.md).
 */
export default function SeedQaPage() {
  const sub = getSubscriptionSeed();
  const svc = getServicesSeed();
  const per = getPersonnelSeed();
  const cor = getCostOfRevenueSeed();
  const opx = getOpExSeed();
  const bs = getBalanceSheetSeed();
  // Runway/burn at the app's current period (matches app/dashboard/page.tsx + the dashboard tile),
  // via buildSeedRunway (TTM-as-of-period) rather than a stray Dec-2026 figure.
  const runway = buildSeedRunway(month(2026, 6));
  const led = getLedger();
  const last = sub.series.months.length - 1;
  const activeCount = sub.customers.filter((c) => c.status === "active").length;
  const endHeads = per.series.headcountByFunction[last];

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Seed QA · dev only</div>
        <h1 className="font-heading text-3xl text-ink">Bearing seed — steps 1–6</h1>
        <p className="mt-2 max-w-2xl text-sm text-steel">
          Deterministic generators: subscription (606 ratable + deferred + billings roll-forward),
          services (% complete + WIP, capacity-gated), personnel + Cost of Revenue (two-axis model),
          non-payroll OpEx (8 groups), the balance sheet + cash flow (AR/DSO, prepaids, fixed assets
          + D&amp;A, AP/DPO), and the general ledger (balanced JEs → trial balance). The live queries
          read this seed. Story events: churn spike Q3-2024, soft quarter Q1-2026, price increase
          Jan-2026. First-pass parameters; tunable in <code>lib/seed/params.ts</code>.
        </p>
        <CheckLegend />
      </header>

      {/* combined revenue + mix */}
      <section className="mb-8 rounded-xl border border-parchment-line bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold text-ink">Total revenue vs target (subscription + services)</h2>
        <div className="grid grid-cols-3 gap-3">
          {FYS.map((fy) => {
            const s = sub.fyRecognized[fy];
            const v = svc.fyRecognized[fy];
            const total = s + v;
            const target = SUBSCRIPTION_REVENUE_TARGETS[fy] + SERVICES_REVENUE_TARGETS[fy];
            const pct = ((total / target - 1) * 100).toFixed(0);
            // Color by the WORST stream, not the netted total — otherwise a +2% subscription beat
            // masks a -24% services miss behind a green headline.
            const subOff = Math.abs(s / SUBSCRIPTION_REVENUE_TARGETS[fy] - 1);
            const svcOff = Math.abs(v / SERVICES_REVENUE_TARGETS[fy] - 1);
            const close = Math.max(subOff, svcOff) <= 0.12;
            const laggard = svcOff > subOff ? "services" : "subscription";
            const mix = ((v / total) * 100).toFixed(0);
            return (
              <div key={fy} className="rounded-lg bg-secondary/40 p-3">
                <div className="text-xs text-steel">FY{fy}</div>
                <div className="font-heading text-xl text-ink">{m(total)}</div>
                <div className="text-xs text-steel">target {m(target)} · services mix {mix}%</div>
                <div className={cn("text-xs font-medium", close ? "text-sage-deep" : "text-amber-deep")}>
                  {Number(pct) >= 0 ? "+" : ""}
                  {pct}% net{close ? "" : ` · ${laggard} off band`}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Subscription ── */}
      <h2 className="mb-3 font-heading text-xl text-ink">Subscription · 606 ratable + deferred</h2>
      <Checks checks={sub.checks} />
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Logos (gross)" value={`${sub.contracts.length}`} />
        <Stat label="Active" value={`${activeCount}`} />
        <Stat label="Exit ARR" value={m(sub.series.arr[last])} />
        <Stat label="Exit MRR" value={m(sub.series.mrr[last])} />
      </section>
      <FyVsTarget actual={sub.fyRecognized} target={SUBSCRIPTION_REVENUE_TARGETS} />
      <section className="mb-8 overflow-hidden rounded-xl border border-parchment-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-parchment-line bg-secondary/50 text-xs uppercase tracking-wide text-steel">
              <th className="px-3 py-2 text-left font-medium">Month</th>
              <th className="px-3 py-2 text-right font-medium">Billings</th>
              <th className="px-3 py-2 text-right font-medium">Recognized</th>
              <th className="px-3 py-2 text-right font-medium">Deferred</th>
              <th className="px-3 py-2 text-right font-medium">ARR</th>
              <th className="px-3 py-2 text-right font-medium">New</th>
              <th className="px-3 py-2 text-right font-medium">Expansion</th>
              <th className="px-3 py-2 text-right font-medium">Churn</th>
              <th className="px-3 py-2 text-right font-medium">Net ΔARR</th>
            </tr>
          </thead>
          <tbody>
            {sub.series.months.map((mo, i) => {
              const b = sub.series.bookings[i];
              return (
                <tr key={mo} className="border-t border-parchment-line/60 tabular-nums">
                  <td className="px-3 py-1.5 text-left text-ink">{mo}</td>
                  <td className="px-3 py-1.5 text-right text-steel">{m(sub.series.billings[i])}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{m(sub.series.recognized[i])}</td>
                  <td className="px-3 py-1.5 text-right text-steel">{m(sub.series.deferred[i])}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{m(sub.series.arr[i])}</td>
                  <td className="px-3 py-1.5 text-right text-sage-deep">{b.newBusiness ? m(b.newBusiness) : "—"}</td>
                  <td className="px-3 py-1.5 text-right text-sage-deep">{b.expansion ? m(b.expansion) : "—"}</td>
                  <td className="px-3 py-1.5 text-right text-ember-deep">{b.contraction ? `(${m(b.contraction)})` : "—"}</td>
                  <td className="px-3 py-1.5 text-right font-medium text-ink">{m(b.net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ── Services ── */}
      <h2 className="mb-3 font-heading text-xl text-ink">Services · % complete + WIP (capacity-gated)</h2>
      <Checks checks={svc.checks} />
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Projects" value={`${svc.projects.length - svc.incompleteCount}/${svc.projects.length} complete`} />
        <Stat label="Backlog (WIP at horizon)" value={m(svc.endingBacklog)} />
        <Stat label="Avg margin" value={`${(svc.avgMarginPct * 100).toFixed(0)}%`} />
        <Stat label="Peak utilization" value={`${(Math.max(...svc.series.utilization) * 100).toFixed(0)}%`} />
      </section>
      <FyVsTarget actual={svc.fyRecognized} target={SERVICES_REVENUE_TARGETS} />
      <section className="overflow-hidden rounded-xl border border-parchment-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-parchment-line bg-secondary/50 text-xs uppercase tracking-wide text-steel">
              <th className="px-3 py-2 text-left font-medium">Month</th>
              <th className="px-3 py-2 text-right font-medium">Recognized</th>
              <th className="px-3 py-2 text-right font-medium">WIP (unbilled)</th>
              <th className="px-3 py-2 text-right font-medium">Utilization</th>
            </tr>
          </thead>
          <tbody>
            {svc.series.months.map((mo, i) => (
              <tr key={mo} className="border-t border-parchment-line/60 tabular-nums">
                <td className="px-3 py-1.5 text-left text-ink">{mo}</td>
                <td className="px-3 py-1.5 text-right text-ink">{m(svc.series.recognized[i])}</td>
                <td className="px-3 py-1.5 text-right text-steel">{m(svc.series.wip[i])}</td>
                <td
                  className={cn(
                    "px-3 py-1.5 text-right",
                    svc.series.utilization[i] >= 0.95 ? "text-ember-deep" : "text-ink",
                  )}
                >
                  {(svc.series.utilization[i] * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Personnel ── */}
      <h2 className="mb-3 mt-8 font-heading text-xl text-ink">Personnel · two-axis cost model</h2>
      <Checks checks={per.checks} />
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="End headcount" value={`${per.endHeadcount}`} />
        <Stat label="Direct (PS+Support)" value={`${endHeads.direct}`} />
        <Stat label="FY26 payroll" value={m(per.fyPayroll[2026])} />
        <Stat label="FY26 direct payroll" value={m(per.fyDirectPayroll[2026])} />
      </section>
      <section className="mb-8 overflow-hidden rounded-xl border border-parchment-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-parchment-line bg-secondary/50 text-xs uppercase tracking-wide text-steel">
              <th className="px-3 py-2 text-left font-medium">Month</th>
              <th className="px-3 py-2 text-right font-medium">Heads</th>
              <th className="px-3 py-2 text-right font-medium">Direct</th>
              <th className="px-3 py-2 text-right font-medium">R&amp;D</th>
              <th className="px-3 py-2 text-right font-medium">S&amp;M</th>
              <th className="px-3 py-2 text-right font-medium">G&amp;A</th>
              <th className="px-3 py-2 text-right font-medium">Payroll / mo</th>
            </tr>
          </thead>
          <tbody>
            {per.series.months.map((mo, i) => {
              const h = per.series.headcountByFunction[i];
              return (
                <tr key={mo} className="border-t border-parchment-line/60 tabular-nums">
                  <td className="px-3 py-1.5 text-left text-ink">{mo}</td>
                  <td className="px-3 py-1.5 text-right font-medium text-ink">{per.series.totalHeadcount[i]}</td>
                  <td className="px-3 py-1.5 text-right text-steel">{h.direct}</td>
                  <td className="px-3 py-1.5 text-right text-steel">{h.rnd}</td>
                  <td className="px-3 py-1.5 text-right text-steel">{h.sm}</td>
                  <td className="px-3 py-1.5 text-right text-steel">{h.ga}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{m(per.series.totalPayroll[i])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ── Cost of Revenue ── */}
      <h2 className="mb-3 font-heading text-xl text-ink">Cost of Revenue · assembled (Direct payroll + rate × revenue)</h2>
      <Checks checks={cor.checks} />
      <section className="mb-4 grid grid-cols-3 gap-3">
        {FYS.map((fy) => (
          <div key={fy} className="rounded-lg bg-secondary/40 p-3">
            <div className="text-xs text-steel">FY{fy} gross margin</div>
            <div className="font-heading text-xl text-ink">{(cor.fyGrossMarginPct[fy] * 100).toFixed(1)}%</div>
            <div className="text-xs text-steel">GP {m(cor.fyGrossProfit[fy])} · CoR {m(cor.fyTotalCoR[fy])}</div>
          </div>
        ))}
      </section>
      <section className="mb-8 overflow-hidden rounded-xl border border-parchment-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-parchment-line bg-secondary/50 text-xs uppercase tracking-wide text-steel">
              <th className="px-3 py-2 text-left font-medium">Month</th>
              <th className="px-3 py-2 text-right font-medium">Revenue</th>
              <th className="px-3 py-2 text-right font-medium">Direct payroll</th>
              <th className="px-3 py-2 text-right font-medium">Non-employee</th>
              <th className="px-3 py-2 text-right font-medium">Total CoR</th>
              <th className="px-3 py-2 text-right font-medium">Gross profit</th>
              <th className="px-3 py-2 text-right font-medium">GM %</th>
            </tr>
          </thead>
          <tbody>
            {cor.series.months.map((mo, i) => {
              const rev = cor.series.totalRevenue[i];
              const gp = cor.series.grossProfit[i];
              return (
                <tr key={mo} className="border-t border-parchment-line/60 tabular-nums">
                  <td className="px-3 py-1.5 text-left text-ink">{mo}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{m(rev)}</td>
                  <td className="px-3 py-1.5 text-right text-steel">{m(cor.series.directPayroll[i])}</td>
                  <td className="px-3 py-1.5 text-right text-steel">{m(cor.series.nonEmployee[i])}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{m(cor.series.totalCoR[i])}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{m(gp)}</td>
                  <td className="px-3 py-1.5 text-right text-sage-deep">{rev > 0 ? ((gp / rev) * 100).toFixed(0) : "0"}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ── OpEx ── */}
      <h2 className="mb-3 font-heading text-xl text-ink">Operating Expenses · non-payroll (8 groups)</h2>
      <Checks checks={opx.checks} />
      <FyVsTarget actual={opx.fyTotal} target={OPEX_TARGETS} />
      <section className="mb-8 overflow-hidden rounded-xl border border-parchment-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-parchment-line bg-secondary/50 text-xs uppercase tracking-wide text-steel">
              <th className="px-3 py-2 text-left font-medium">Expense group</th>
              <th className="px-3 py-2 text-right font-medium">FY2024</th>
              <th className="px-3 py-2 text-right font-medium">FY2025</th>
              <th className="px-3 py-2 text-right font-medium">FY2026</th>
            </tr>
          </thead>
          <tbody>
            {opx.series.groups.map((g) => (
              <tr key={g.groupId} className="border-t border-parchment-line/60 tabular-nums">
                <td className="px-3 py-1.5 text-left text-ink">{g.label}</td>
                <td className="px-3 py-1.5 text-right text-steel">{m(g.fyTotal[2024])}</td>
                <td className="px-3 py-1.5 text-right text-steel">{m(g.fyTotal[2025])}</td>
                <td className="px-3 py-1.5 text-right text-ink">{m(g.fyTotal[2026])}</td>
              </tr>
            ))}
            <tr className="border-t border-parchment-line bg-secondary/30 font-semibold tabular-nums">
              <td className="px-3 py-1.5 text-left text-ink">Total non-payroll OpEx</td>
              <td className="px-3 py-1.5 text-right text-ink">{m(opx.fyTotal[2024])}</td>
              <td className="px-3 py-1.5 text-right text-ink">{m(opx.fyTotal[2025])}</td>
              <td className="px-3 py-1.5 text-right text-ink">{m(opx.fyTotal[2026])}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Implied P&L (full, post-D&A → net income) ── */}
      <h2 className="mb-3 font-heading text-xl text-ink">Implied P&amp;L · post-D&amp;A → net income</h2>
      <p className="mb-3 text-xs text-steel">
        Gross Profit − Indirect Payroll − non-payroll OpEx − D&amp;A = operating income; + interest income
        − taxes (0, net operating losses) = net income. This is what the live P&amp;L will read once the seed
        is wired in (step 6).
      </p>
      <section className="mb-8 grid grid-cols-3 gap-3">
        {FYS.map((fy) => {
          const rev = cor.fyTotalRevenue[fy];
          const gp = cor.fyGrossProfit[fy];
          const indirect = per.fyPayroll[fy] - per.fyDirectPayroll[fy];
          const nonPayroll = opx.fyTotal[fy];
          const da = bs.fyDepreciation[fy];
          const oi = gp - indirect - nonPayroll - da;
          const ni = bs.fyNetIncome[fy];
          return (
            <div key={fy} className="rounded-lg bg-secondary/40 p-3">
              <div className="text-xs text-steel">FY{fy} operating income</div>
              <div className={cn("font-heading text-xl", oi < 0 ? "text-ember-deep" : "text-sage-deep")}>{m(oi)}</div>
              <div className={cn("text-xs font-medium", oi < 0 ? "text-ember-deep" : "text-sage-deep")}>
                {((oi / rev) * 100).toFixed(0)}% op margin · net {m(ni)} ({((ni / rev) * 100).toFixed(0)}%)
              </div>
              <div className="mt-1 text-[11px] text-steel">
                GP {m(gp)} − IndPay {m(indirect)} − OpEx {m(nonPayroll)} − D&amp;A {m(da)}
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Balance sheet + cash flow (step 5) ── */}
      <h2 className="mb-3 font-heading text-xl text-ink">Balance sheet + cash flow · step 5</h2>
      <Checks checks={bs.checks} />
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Ending cash" value={m(bs.endingCash)} />
        <Stat label="Net burn / mo (TTM)" value={formatMoney(runway.netBurn, { compact: true })} />
        <Stat label="Runway" value={runway.months === null ? "cash-flow +" : `${runway.months.toFixed(0)} mo`} />
        <Stat label="Deferred (contract liab.)" value={m(bs.series.deferredRevenue[last])} />
      </section>
      <BalanceSheetTable bs={bs} />
      <CashFlowTable bs={bs} />

      {/* ── General ledger · trial balance (step 6b) ── */}
      <h2 className="mb-3 font-heading text-xl text-ink">General ledger · trial balance · step 6b</h2>
      <p className="mb-3 text-xs text-steel">
        The seed posts its monthly activity as balanced double-entry journal entries (§12: drivers → JEs → GL →
        statements). The statements above are a VIEW of this ledger. Trial balance shown at FY2026 close.
      </p>
      <Checks checks={led.checks} />
      <TrialBalance />

      {/* ── Reconciliation watch: known open gaps, tracked not hidden (NOT pass/fail checks) ── */}
      <ReconciliationWatch />
    </div>
  );
}

/** End-of-fiscal-year month index (FY24→11, FY25→23, FY26→35). */
const fyEnd = (fy: number) => (fy - 2024) * 12 + 11;

function BalanceSheetTable({ bs }: { bs: ReturnType<typeof getBalanceSheetSeed> }) {
  const s = bs.series;
  const assetRows: ReadonlyArray<readonly [string, readonly number[]]> = [
    ["Cash", s.cash],
    ["Accounts receivable", s.accountsReceivable],
    ["Unbilled WIP (contract asset)", s.unbilledWip],
    ["Prepaid expenses", s.prepaidExpenses],
    ["Fixed assets, net", s.fixedAssetsNet],
  ];
  const liabRows: ReadonlyArray<readonly [string, readonly number[]]> = [
    ["Deferred revenue (contract liab.)", s.deferredRevenue],
    ["Accounts payable", s.accountsPayable],
  ];
  const totalAssets = (i: number) => assetRows.reduce((sum, [, ser]) => sum + ser[i], 0);
  const totalLiabEquity = (i: number) => s.deferredRevenue[i] + s.accountsPayable[i] + s.paidInCapital[i] - s.accumulatedDeficit[i];

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary/50 text-xs uppercase tracking-wide text-steel">
            <th className="px-3 py-2 text-left font-medium">Balance sheet (FY-end)</th>
            {FYS.map((fy) => (
              <th key={fy} className="px-3 py-2 text-right font-medium">FY{fy}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assetRows.map(([label, ser]) => (
            <tr key={label} className="border-t border-parchment-line/60 tabular-nums">
              <td className="px-3 py-1.5 text-left text-ink">{label}</td>
              {FYS.map((fy) => <td key={fy} className="px-3 py-1.5 text-right text-steel">{m(ser[fyEnd(fy)])}</td>)}
            </tr>
          ))}
          <tr className="border-t border-parchment-line bg-secondary/20 font-medium tabular-nums">
            <td className="px-3 py-1.5 text-left text-ink">Total assets</td>
            {FYS.map((fy) => <td key={fy} className="px-3 py-1.5 text-right text-ink">{m(totalAssets(fyEnd(fy)))}</td>)}
          </tr>
          {liabRows.map(([label, ser]) => (
            <tr key={label} className="border-t border-parchment-line/60 tabular-nums">
              <td className="px-3 py-1.5 text-left text-ink">{label}</td>
              {FYS.map((fy) => <td key={fy} className="px-3 py-1.5 text-right text-steel">{m(ser[fyEnd(fy)])}</td>)}
            </tr>
          ))}
          <tr className="border-t border-parchment-line/60 tabular-nums">
            <td className="px-3 py-1.5 text-left text-ink">Paid-in capital</td>
            {FYS.map((fy) => <td key={fy} className="px-3 py-1.5 text-right text-steel">{m(s.paidInCapital[fyEnd(fy)])}</td>)}
          </tr>
          <tr className="border-t border-parchment-line/60 tabular-nums">
            <td className="px-3 py-1.5 text-left text-ink">Accumulated deficit</td>
            {FYS.map((fy) => <td key={fy} className="px-3 py-1.5 text-right text-ember-deep">({m(s.accumulatedDeficit[fyEnd(fy)])})</td>)}
          </tr>
          <tr className="border-t border-parchment-line bg-secondary/20 font-medium tabular-nums">
            <td className="px-3 py-1.5 text-left text-ink">Total liabilities + equity</td>
            {FYS.map((fy) => <td key={fy} className="px-3 py-1.5 text-right text-ink">{m(totalLiabEquity(fyEnd(fy)))}</td>)}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function CashFlowTable({ bs }: { bs: ReturnType<typeof getBalanceSheetSeed> }) {
  const s = bs.series;
  const fySum = (ser: readonly number[], fy: number) => {
    let sum = 0;
    for (let i = (fy - 2024) * 12; i < (fy - 2024) * 12 + 12; i++) sum += ser[i];
    return sum;
  };
  const rows: ReadonlyArray<{ label: string; fy: (fy: number) => number; strong?: boolean }> = [
    { label: "Net income", fy: (fy) => bs.fyNetIncome[fy] },
    { label: "+ Depreciation & amortization", fy: (fy) => bs.fyDepreciation[fy] },
    { label: "Operating cash flow", fy: (fy) => bs.fyOperatingCashFlow[fy], strong: true },
    { label: "− Capex (investing)", fy: (fy) => fySum(s.investingCashFlow, fy) },
    { label: "+ Financing (Series B)", fy: (fy) => fySum(s.financingCashFlow, fy) },
    { label: "Ending cash", fy: (fy) => s.cash[fyEnd(fy)], strong: true },
  ];
  return (
    <section className="mb-8 overflow-hidden rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary/50 text-xs uppercase tracking-wide text-steel">
            <th className="px-3 py-2 text-left font-medium">Cash flow (indirect)</th>
            {FYS.map((fy) => (
              <th key={fy} className="px-3 py-2 text-right font-medium">FY{fy}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={cn("border-t border-parchment-line/60 tabular-nums", row.strong && "bg-secondary/20 font-medium")}>
              <td className="px-3 py-1.5 text-left text-ink">{row.label}</td>
              {FYS.map((fy) => {
                const v = row.fy(fy);
                return <td key={fy} className={cn("px-3 py-1.5 text-right", v < 0 ? "text-ember-deep" : "text-ink")}>{m(v)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const TB_DEBIT_NORMAL = new Set(["asset", "cost_of_revenue", "operating_expense", "tax", "contra_equity"]);

/** FY2026-close trial balance: BS accounts at their year-end balance, P&L accounts at FY activity,
 *  accumulated deficit at the FY-opening balance — Σ debits === Σ credits by construction. */
function TrialBalance() {
  const led = getLedger();
  const bs = getBalanceSheetSeed();
  const o = bs.opening;
  const openMap: Record<string, number> = {
    "1000": o.cash, "1100": o.accountsReceivable, "1200": o.unbilledWip, "1300": o.prepaidExpenses,
    "1500": o.fixedAssetsNet, "2000": o.accountsPayable, "2100": o.deferredRevenue, "3000": o.paidInCapital,
  };
  const amount = (code: string, type: string): number => {
    const act = led.activity.get(code) ?? [];
    if (type === "contra_equity") return bs.series.accumulatedDeficit[23]; // FY2026-opening deficit
    if (type === "asset" || type === "liability" || type === "equity") {
      let b = openMap[code] ?? 0;
      for (const x of act) b += x;
      return b;
    }
    let s = 0;
    for (let i = 24; i < 36; i++) s += act[i]; // FY2026 P&L activity
    return s;
  };
  const rows = CHART_OF_ACCOUNTS.map((a) => {
    const amt = amount(a.code, a.accountType);
    const debit = TB_DEBIT_NORMAL.has(a.accountType);
    return { code: a.code, name: a.name, dr: debit ? amt : 0, cr: debit ? 0 : amt };
  });
  const totalDr = rows.reduce((s, r) => s + r.dr, 0);
  const totalCr = rows.reduce((s, r) => s + r.cr, 0);
  const balances = Math.abs(totalDr - totalCr) < 1;

  return (
    <section className="mb-8 overflow-hidden rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary/50 text-xs uppercase tracking-wide text-steel">
            <th className="px-3 py-2 text-left font-medium">Acct</th>
            <th className="px-3 py-2 text-left font-medium">Account</th>
            <th className="px-3 py-2 text-right font-medium">Debit</th>
            <th className="px-3 py-2 text-right font-medium">Credit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-t border-parchment-line/60 tabular-nums">
              <td className="px-3 py-1 text-left text-steel">{r.code}</td>
              <td className="px-3 py-1 text-left text-ink">{r.name}</td>
              <td className="px-3 py-1 text-right text-ink">{r.dr ? m(r.dr) : "—"}</td>
              <td className="px-3 py-1 text-right text-ink">{r.cr ? m(r.cr) : "—"}</td>
            </tr>
          ))}
          <tr className="border-t border-parchment-line bg-secondary/30 font-semibold tabular-nums">
            <td className="px-3 py-1.5 text-left text-ink" colSpan={2}>
              Total {balances ? <span className="text-sage-deep">· balances ✓</span> : <span className="text-ember-deep">· OUT OF BALANCE ✗</span>}
            </td>
            <td className="px-3 py-1.5 text-right text-ink">{m(totalDr)}</td>
            <td className="px-3 py-1.5 text-right text-ink">{m(totalCr)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

// Honest classification badge — distinguishes a real tie-out from a definitional invariant
// so a wall of green ✓ is not read as a wall of reconciliations (tie-out audit, 2026-06-17).
const KIND_STYLE: Record<CheckKind, { label: string; cls: string }> = {
  independent: { label: "independent", cls: "bg-sage/15 text-sage-deep" },
  calibration: { label: "calibration", cls: "bg-amber/15 text-amber-deep" },
  definitional: { label: "definitional", cls: "bg-secondary text-steel" },
  sanity: { label: "sanity", cls: "bg-secondary text-slate" },
};

function KindBadge({ kind }: { kind: CheckKind }) {
  const s = KIND_STYLE[kind];
  return <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide", s.cls)}>{s.label}</span>;
}

function CheckLegend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-steel">
      <span>Check kinds:</span>
      {(Object.keys(KIND_STYLE) as CheckKind[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <KindBadge kind={k} />
        </span>
      ))}
      <span className="text-slate">— only “independent” and “calibration” can actually fail.</span>
    </div>
  );
}

interface WatchItem {
  readonly title: string;
  readonly severity: "central" | "high" | "medium";
  readonly detail: string;
}

const SEVERITY_STYLE: Record<WatchItem["severity"], string> = {
  central: "border-ember text-ember-deep",
  high: "border-amber text-amber-deep",
  medium: "border-parchment-line text-steel",
};

/**
 * Step-6 status: the live queries now read THIS seed (the "swap don't rewrite" seam). Most of the
 * tie-out-audit watch items are resolved; what remains is tracked here, not gated.
 */
function ReconciliationWatch() {
  const cor = getCostOfRevenueSeed();
  const gm26 = cor.fyGrossMarginPct[2026];

  const items: WatchItem[] = [
    {
      title: "Transaction-level JE → GL roll-up — deferred to step 6b",
      severity: "high",
      detail:
        "The statements assemble directly from the driver series (and tie out by construction). The §12 reference GL (balanced per-transaction journal entries → trial balance → statements) plus Account Mapping and Scout drill-to-JE are the next layer — fidelity/auditability, not the critical path to real data.",
    },
    {
      title: "SaaS metric formulas are first-pass",
      severity: "medium",
      detail:
        "ARR/MRR, bookings, NRR and logo retention derive from real series; CAC, LTV:CAC, magic number and burn multiple use standard but first-pass formulas (the seed's low churn + deferred-funded efficiency make some read optimistically). Refine the formulas + drill-downs in the Run.",
    },
    {
      title: "FY26 gross-margin band is thin",
      severity: "medium",
      detail: `${(gm26 * 100).toFixed(1)}% is only ${((gm26 - GROSS_MARGIN_BAND.lo) * 100).toFixed(1)} pts above the ${(GROSS_MARGIN_BAND.lo * 100).toFixed(0)}% floor — a small hosting/pass-through nudge flips the gmInBand check red.`,
    },
  ];

  return (
    <>
      <h2 className="mb-1 font-heading text-xl text-ink">Reconciliation watch · remaining (tracked, not gated)</h2>
      <p className="mb-3 text-xs text-steel">
        The live queries now read this seed (step 6). The deferred roll-forward, the services miss, and the
        model-vs-seed conflict are resolved; what is left for step 6b / the Run is below. See <code>tie-out-audit.md</code>.
      </p>
      <section className="mb-8 space-y-2">
        {items.map((it) => (
          <div key={it.title} className={cn("rounded-lg border-l-2 bg-surface px-3 py-2", SEVERITY_STYLE[it.severity])}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide">{it.severity}</span>
              <span className="text-sm font-medium text-ink">{it.title}</span>
            </div>
            <div className="mt-0.5 text-xs text-steel">{it.detail}</div>
          </div>
        ))}
      </section>
    </>
  );
}

function Checks({ checks }: { checks: readonly TieOutCheck[] }) {
  return (
    <section className="mb-4 rounded-xl border border-parchment-line bg-surface p-4">
      <ul className="space-y-1.5">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-sm">
            <span className={cn("font-semibold", c.ok ? "text-sage-deep" : "text-ember-deep")}>{c.ok ? "✓" : "✗"}</span>
            <KindBadge kind={c.kind} />
            <span className="text-ink">{c.label}</span>
            <span className="text-xs text-steel">— {c.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FyVsTarget({
  actual,
  target,
}: {
  actual: Readonly<Record<number, number>>;
  target: Readonly<Record<number, number>>;
}) {
  return (
    <section className="mb-4 grid grid-cols-3 gap-3">
      {FYS.map((fy) => {
        const a = actual[fy];
        const t = target[fy];
        const pct = ((a / t - 1) * 100).toFixed(0);
        const close = Math.abs(a / t - 1) <= 0.12;
        return (
          <div key={fy} className="rounded-lg bg-secondary/40 p-3">
            <div className="text-xs text-steel">FY{fy}</div>
            <div className="font-heading text-lg text-ink">{m(a)}</div>
            <div className="text-xs text-steel">target {m(t)}</div>
            <div className={cn("text-xs font-medium", close ? "text-sage-deep" : "text-amber-deep")}>
              {Number(pct) >= 0 ? "+" : ""}
              {pct}% vs target
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-parchment-line bg-surface p-4">
      <div className="text-xs text-steel">{label}</div>
      <div className="font-heading text-2xl text-ink">{value}</div>
    </div>
  );
}
