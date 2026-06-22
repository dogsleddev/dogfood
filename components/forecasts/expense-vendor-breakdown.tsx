import { cn } from "@/lib/utils";
import { formatMoney, sumMoney, toMajor, type Money } from "@/lib/types/money";
import { monthLabel, type Month } from "@/lib/types/period";
import type { ExpenseForecastLine } from "@/lib/types/drivers";

const fmt = (m: Money) => formatMoney(m, { compact: false });

interface AcctGroup {
  readonly accountId: string;
  readonly subCode: string;
  readonly label: string;
  readonly vendors: readonly ExpenseForecastLine[];
  readonly total: Money;
}

/**
 * The group's GL accounts and the VENDORS under each, for ONE focused month (§7 drill bottom). A
 * forecast month shows recurring vendors at run-rate + an "Other — <account>" residual; a closed month
 * shows the real sub-ledger bills (isActual). Each account is a <details> (open when focused) so the
 * page progressively discloses with no client JS. Σ vendors === account === the grid cell above.
 */
export function ExpenseVendorBreakdown({
  lines,
  focusMonth,
  isClosed,
  focusAccountId,
}: {
  lines: readonly ExpenseForecastLine[]; // breakdown: "vendor", already filtered to focusMonth
  focusMonth: Month;
  isClosed: boolean;
  focusAccountId?: string;
}) {
  const byAcct = new Map<string, AcctGroup>();
  for (const l of lines) {
    const id = l.accountId ?? "—";
    if (!byAcct.has(id)) byAcct.set(id, { accountId: id, subCode: l.subCode ?? "", label: l.accountLabel ?? id, vendors: [], total: { minor: 0, currency: l.amount.currency } });
    const grp = byAcct.get(id)!;
    (grp.vendors as ExpenseForecastLine[]).push(l);
  }
  const accts = [...byAcct.values()]
    .map((a) => ({ ...a, total: sumMoney(a.vendors.map((v) => v.amount)) }))
    .sort((a, b) => a.subCode.localeCompare(b.subCode));

  return (
    <div className="rounded-xl border border-parchment-line bg-surface">
      <div className="flex items-baseline justify-between border-b border-parchment-line px-4 py-2.5">
        <span className="text-sm font-medium text-ink">
          {monthLabel(focusMonth)} · by account → vendor
        </span>
        <span className={cn("text-xs", isClosed ? "text-sage-deep" : "text-steel")}>
          {isClosed ? "actuals — real bills" : "forecast — recurring at run-rate + Other"}
        </span>
      </div>
      <div className="divide-y divide-parchment-line/60">
        {accts.map((a) => {
          const open = !focusAccountId || a.accountId === focusAccountId;
          return (
            <details key={a.accountId} open={open} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2 hover:bg-ember-tint/30">
                <span className="flex items-center gap-2 text-sm text-ink">
                  <span className="text-steel transition group-open:rotate-90">▸</span>
                  <span className="font-mono text-xs text-steel">{a.subCode}</span>
                  {a.label}
                </span>
                <span className="tabular-nums text-sm font-semibold text-ink">{fmt(a.total)}</span>
              </summary>
              <div className="pb-2">
                {a.vendors
                  .slice()
                  .sort((x, y) => toMajor(y.amount) - toMajor(x.amount))
                  .map((v, i) => (
                    <div
                      key={`${v.vendor}-${i}`}
                      className={cn(
                        "flex items-center justify-between py-1 pl-12 pr-4 text-sm",
                        v.isResidual ? "italic text-steel" : "text-ink",
                      )}
                    >
                      <span>
                        {v.vendor}
                        {v.isActual && <span className="ml-2 text-xs text-sage-deep">actual</span>}
                      </span>
                      <span className="tabular-nums">{fmt(v.amount)}</span>
                    </div>
                  ))}
              </div>
            </details>
          );
        })}
        {accts.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-steel">No vendor detail for {monthLabel(focusMonth)}.</div>
        )}
      </div>
    </div>
  );
}
