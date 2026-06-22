import Link from "next/link";
import { cn } from "@/lib/utils";
import type { GlAccount } from "@/lib/types/source";
import type { AccountType, StatementClassification, CostFunction } from "@/lib/types/common";

const SECTION_LABEL: Record<AccountType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  contra_equity: "Equity",
  revenue: "Revenue",
  cost_of_revenue: "Cost of Revenue",
  operating_expense: "Operating Expenses",
  other_income: "Other Income / Expense",
  tax: "Taxes",
};

// Balance-sheet sections first, then P&L, in reading order.
const SECTION_ORDER: AccountType[] = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "cost_of_revenue",
  "operating_expense",
  "other_income",
  "tax",
];

const CLASS_BADGE: Record<StatementClassification, string> = {
  cost_of_revenue: "bg-amber/15 text-amber-deep",
  operating_expense: "bg-steel/15 text-steel",
};

const CLASS_LABEL: Record<StatementClassification, string> = {
  cost_of_revenue: "CoR",
  operating_expense: "OpEx",
};

const FUNCTION_LABEL: Record<CostFunction, string> = {
  direct: "Direct",
  rnd: "R&D",
  sm: "S&M",
  ga: "G&A",
};

/** Humanize a branded statement-line id (e.g. "non_employee_cor" → "Non Employee CoR"). */
export const prettyStatementLine = (id: string): string =>
  id
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bCor\b/, "CoR")
    .replace(/\bRou\b/, "ROU")
    .replace(/\bIt\b/, "IT")
    .replace(/\bHr\b/, "HR")
    .replace(/\bArr\b/, "ARR");

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("px-3 py-2 font-medium", right ? "text-right" : "text-left")}>{children}</th>
);

/**
 * Account Mapping — the read-only GL account → statement-line map (CLAUDE.md §7). Grouped by the
 * account's statement section in reading order; each row shows the GL code, name, the statement line
 * it maps to, and (for expense accounts) the typed CoR/OpEx classification + function sub-role.
 * Reads `getAccountMap` (the live DataStore seam) — display only.
 */
export function AccountMappingTable({
  accounts,
  notedCodes,
  selectedCode,
}: {
  accounts: readonly GlAccount[];
  /** account codes that carry a flux note this period (for the row marker) */
  notedCodes?: ReadonlySet<string>;
  /** the account whose flux card is open (?note=) */
  selectedCode?: string;
}) {
  const sections = SECTION_ORDER.map((type) => ({
    type,
    label: SECTION_LABEL[type],
    rows: accounts
      .filter((a) => a.accountType === type)
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code)),
  })).filter((s) => s.rows.length > 0);

  return (
    <div className="min-w-0">
      <div className="mb-3 text-sm text-steel">
        <span className="font-medium text-ink">{accounts.length}</span> GL accounts mapped to statement
        lines · grouped by statement section · click the Flux marker to add an account note
      </div>

      <div className="overflow-hidden rounded-xl border border-parchment-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
              <TH>Code</TH>
              <TH>Account</TH>
              <TH>Statement line</TH>
              <TH>Class</TH>
              <TH>Function</TH>
              <TH>Flux</TH>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <SectionRows
                key={section.type}
                label={section.label}
                rows={section.rows}
                notedCodes={notedCodes}
                selectedCode={selectedCode}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionRows({
  label,
  rows,
  notedCodes,
  selectedCode,
}: {
  label: string;
  rows: readonly GlAccount[];
  notedCodes?: ReadonlySet<string>;
  selectedCode?: string;
}) {
  return (
    <>
      <tr className="bg-secondary/60">
        <td colSpan={6} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ember-deep">
          {label}
        </td>
      </tr>
      {rows.map((a) => {
        const noted = notedCodes?.has(a.code) ?? false;
        return (
          <tr
            key={a.id}
            className={cn(
              "border-t border-parchment-line/60 hover:bg-ember-tint/40",
              selectedCode === a.code && "bg-ember-tint/60",
            )}
          >
            <td className="px-3 py-1.5 tabular-nums text-steel">{a.code}</td>
            <td className="px-3 py-1.5 text-ink">{a.name}</td>
            <td className="px-3 py-1.5 text-steel">{prettyStatementLine(a.statementLineId)}</td>
            <td className="px-3 py-1.5">
              {a.classification ? (
                <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", CLASS_BADGE[a.classification])}>
                  {CLASS_LABEL[a.classification]}
                </span>
              ) : (
                <span className="text-steel">—</span>
              )}
            </td>
            <td className="px-3 py-1.5 text-steel">{a.function ? FUNCTION_LABEL[a.function] : "—"}</td>
            <td className="px-3 py-1.5">
              <Link
                href={`/setup/account-mapping?note=${a.code}`}
                title={noted ? "View flux notes" : "Add a flux note"}
                className={cn("text-xs", noted ? "text-ember-deep" : "text-steel/40 hover:text-ember-deep")}
              >
                {noted ? "● note" : "＋"}
              </Link>
            </td>
          </tr>
        );
      })}
    </>
  );
}
