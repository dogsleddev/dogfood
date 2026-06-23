/**
 * Sample trial-balance generator (CLAUDE.md §16). Emits the real close-month trial balance FROM the
 * current generator — BS accounts at their period-end balance, P&L accounts at FYTD activity, natural
 * side per account, footing to the cent (the rounding residual is absorbed into Cash, a TB-only
 * account). One source for both the committed contract file (scripts/make-trial-balance.ts) AND the
 * on-screen quick-import demos on Setup → Data Import, so the samples can never drift from the books
 * (the staleness this importer is built to catch) and there is no disk read on the deployed app.
 */
import { CHART_OF_ACCOUNTS, accountTrialBalanceAt, isDebitNormal } from "@/lib/seed/gl";
import { monthToIndex, indexToMonth, type Month } from "@/lib/types/period";

const r2 = (x: number) => Math.round(x * 100) / 100;
const csvField = (s: string) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** A footing-exact trial balance CSV for `period`, optionally perturbing one account (to demo an exception). */
export function sampleTrialBalanceCsv(period: Month, perturb?: { code: string; delta: number }): string {
  const tb = accountTrialBalanceAt(period);
  const nat = new Map<string, number>();
  for (const a of CHART_OF_ACCOUNTS) nat.set(a.code, r2(tb.get(a.code) ?? 0));
  if (perturb) nat.set(perturb.code, r2((nat.get(perturb.code) ?? 0) + perturb.delta));

  const place = (code: string) => {
    const v = nat.get(code) ?? 0;
    const dn = isDebitNormal(CHART_OF_ACCOUNTS.find((a) => a.code === code)!.accountType);
    return dn ? { debit: Math.max(v, 0), credit: Math.max(-v, 0) } : { debit: Math.max(-v, 0), credit: Math.max(v, 0) };
  };
  let sumD = 0, sumC = 0;
  for (const a of CHART_OF_ACCOUNTS) { const p = place(a.code); sumD += p.debit; sumC += p.credit; }
  nat.set("1000", r2((nat.get("1000") ?? 0) - r2(sumD - sumC))); // foot-correct via Cash

  const lines = ["period,account_code,account_name,debit,credit"];
  for (const a of CHART_OF_ACCOUNTS) {
    const p = place(a.code);
    lines.push(`${period},${a.code},${csvField(a.name)},${p.debit.toFixed(2)},${p.credit.toFixed(2)}`);
  }
  return lines.join("\n") + "\n";
}

export type SampleTbKind = "current" | "next-month" | "broken";

/** Resolve a demo sample (the Setup → Data Import quick-import buttons) against the live close boundary. */
export function sampleTbFor(kind: SampleTbKind, closeThrough: Month): { period: Month; csv: string; label: string } {
  const next = indexToMonth(monthToIndex(closeThrough) + 1);
  switch (kind) {
    case "current":
      return { period: closeThrough, csv: sampleTrialBalanceCsv(closeThrough), label: `re-import ${closeThrough} (restatement — as-of unmoved)` };
    case "next-month":
      return { period: next, csv: sampleTrialBalanceCsv(next), label: `import ${next} (clean — advances the close)` };
    case "broken":
      return { period: closeThrough, csv: sampleTrialBalanceCsv(closeThrough, { code: "6200", delta: 100_000 }), label: `import a contradicting ${closeThrough} (exception)` };
  }
}
