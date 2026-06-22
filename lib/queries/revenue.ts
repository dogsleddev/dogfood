/** Revenue Forecast — owns subscription + services (layer 2 — CLAUDE.md §8). */
import { type Month, monthToIndex, fyStartIndex } from "@/lib/types/period";
import type { Stream, ContractId } from "@/lib/types/common";
import type { RevenueForecastLine, RecognizedRevenue, RecognizedSubscriptionRow, RecognizedServicesRow } from "@/lib/types/drivers";
import { usd, toMajor, percent } from "@/lib/types/money";
import { getDataStore } from "@/lib/datastore";
import { assertBaseScope, type StreamOpt } from "./util";

const PLAN_LABEL: Record<string, string> = { starter: "Starter", growth: "Growth", scale: "Scale" };

/**
 * Subscription forecast = contracted (the book signed as of the close boundary) + new-business
 * (logos assumed to sign after close) — §8. Returns one line per month of the period's fiscal year,
 * per stream. The split is by each contract/engagement's start vs the close index; contracted +
 * newBusiness === total (the authoritative recognized series) by construction. Actual months are
 * all "contracted"; the wedge opens only in the forecast tail.
 */
export async function getRevenueForecast(period: Month, opts: StreamOpt = {}): Promise<readonly RevenueForecastLine[]> {
  assertBaseScope(opts, "getRevenueForecast");
  const store = getDataStore();
  const sub = await store.getSubscriptionModel();
  const svc = await store.getServicesModel();
  const months = sub.series.months;
  const fyStart = fyStartIndex(period);
  const closeIdx = monthToIndex((await store.getSettings()).closeThrough);
  const custStart = new Map(sub.customers.map((c) => [c.id as string, monthToIndex(c.startMonth)]));
  const projStart = new Map(svc.projects.map((p) => [p.id as string, custStart.get(p.customerId as string) ?? 0]));
  const streams: Stream[] = opts.stream ? [opts.stream] : ["subscription", "services"];

  const lines: RevenueForecastLine[] = [];
  for (let m = fyStart; m <= fyStart + 11; m++) {
    const mo = months[m];
    if (!mo) continue;
    for (const stream of streams) {
      let total = 0;
      let contracted = 0;
      if (stream === "subscription") {
        total = sub.series.recognized[m] ?? 0;
        for (const c of sub.recByContract) {
          const rec = c.recognized[m] ?? 0;
          if (rec !== 0 && (custStart.get(c.customerId) ?? 0) <= closeIdx) contracted += rec;
        }
      } else {
        total = svc.series.recognized[m] ?? 0;
        for (const r of svc.recByProject) {
          const rec = r.monthly[m] ?? 0;
          if (rec !== 0 && (projStart.get(r.projectId) ?? 0) <= closeIdx) contracted += rec;
        }
      }
      lines.push({ period: mo, stream, contracted: usd(contracted), newBusiness: usd(total - contracted), total: usd(total) });
    }
  }
  return lines;
}

/**
 * The recognized-revenue cross-section for a period — the drill behind P&L revenue.
 * Subscription rows come from the per-contract recognition (`recByContract`); services rows from
 * per-project recognition (`recByProject`). Each side's rows sum to its subtotal, and the subtotals
 * are the authoritative seed series — so the drill ties to the P&L Subscription / Services lines.
 */
export async function getRecognizedRevenue(period: Month, opts: { stream?: Stream } = {}): Promise<RecognizedRevenue> {
  const store = getDataStore();
  const sub = await store.getSubscriptionModel();
  const svc = await store.getServicesModel();
  const i = monthToIndex(period);
  const wantSub = !opts.stream || opts.stream === "subscription";
  const wantSvc = !opts.stream || opts.stream === "services";

  const subRows: RecognizedSubscriptionRow[] = wantSub
    ? sub.recByContract
        .filter((c) => (c.recognized[i] ?? 0) > 0)
        .map((c) => ({
          contractId: c.contractId as ContractId,
          customerName: c.customerName,
          plan: PLAN_LABEL[c.tier] ?? c.tier,
          arr: usd(c.arr[i] ?? 0),
          recognized: usd(c.recognized[i] ?? 0),
          deferred: usd(c.deferred[i] ?? 0),
        }))
        .sort((a, b) => b.recognized.minor - a.recognized.minor)
    : [];

  const custName = new Map(sub.customers.map((c) => [c.id as string, c.name]));
  const projById = new Map(svc.projects.map((p) => [p.id as string, p]));
  const svcRows: RecognizedServicesRow[] = wantSvc
    ? svc.recByProject
        .filter((r) => (r.monthly[i] ?? 0) > 0)
        .map((r) => {
          const p = projById.get(r.projectId);
          const cv = p ? toMajor(p.contractValue) : 0;
          return {
            engagementName: p?.name ?? r.projectId,
            customerName: p ? (custName.get(p.customerId as string) ?? "—") : "—",
            pctCompleteDelta: percent(cv > 0 ? (r.monthly[i] ?? 0) / cv : 0),
            recognized: usd(r.monthly[i] ?? 0),
            wip: usd(r.monthly[i] ?? 0), // recognized-but-unbilled (~1 month; billed in arrears)
            marginPct: p ? p.marginPct : percent(0),
          };
        })
        .sort((a, b) => b.recognized.minor - a.recognized.minor)
    : [];

  return {
    period,
    subscription: { rows: subRows, subtotal: usd(sub.series.recognized[i] ?? 0) },
    services: { rows: svcRows, subtotal: usd(svc.series.recognized[i] ?? 0) },
    total: usd((sub.series.recognized[i] ?? 0) + (svc.series.recognized[i] ?? 0)),
  };
}
