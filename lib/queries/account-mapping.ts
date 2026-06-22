/** Setup · Account Mapping — the account→statement-line map (CLAUDE.md §7). Load-bearing:
 *  read by the statement engine and every drill-down. Reads the GL chart of accounts through
 *  the DataStore seam, and (slice 2, §17) writes the field-level OVERRIDE layer that re-points an
 *  account's mapping — moving its closed activity to a different statement line. */
import type { GlAccount, AccountOverride } from "@/lib/types/source";
import type { ExpenseGroup, ExpenseGroupId, StatementClassification, CostFunction, AccountType } from "@/lib/types/common";
import { getDataStore } from "@/lib/datastore";

export async function getAccountMap(): Promise<readonly GlAccount[]> {
  return getDataStore().listGlAccounts();
}

export async function listExpenseGroups(): Promise<readonly ExpenseGroup[]> {
  return getDataStore().listExpenseGroups();
}

export async function getExpenseGroup(id: ExpenseGroupId): Promise<ExpenseGroup | undefined> {
  const groups = await getDataStore().listExpenseGroups();
  return groups.find((g) => g.id === id);
}

// ── the override layer (§17) — re-point a mapping; field-level deltas ──

/**
 * Re-point GROUPS. A re-point is allowed ONLY within a group, which guarantees the statement stays
 * coherent and the empty-path invariants are preserved under a re-point:
 *  • P&L revenue ↔ revenue and operating-cost ↔ operating-cost (CoR ∪ OpEx) both keep total revenue
 *    and (revenue − total cost) invariant, so Net Income never moves on an allowed P&L re-point.
 *  • BS asset ↔ asset and liability ↔ liability keep each section's sum invariant, so Assets = L + E
 *    holds under a re-point.
 * Lines ABSENT from this map are not re-point targets: the 6 P&L subtotals (computed, never backed by
 * an account), the equity lines (paid_in_capital / accumulated_deficit), and the below-the-line
 * singletons (interest_other / taxes — re-pointing them would move Net Income).
 */
type RepointGroup = "pnl_revenue" | "pnl_operating_cost" | "bs_asset" | "bs_liability";
const LINE_GROUP: Readonly<Record<string, RepointGroup>> = {
  // P&L revenue
  subscription: "pnl_revenue", services: "pnl_revenue",
  // P&L operating cost (CoR + OpEx leaves)
  direct_payroll: "pnl_operating_cost", non_employee_cor: "pnl_operating_cost",
  indirect_payroll: "pnl_operating_cost", employee_expenses: "pnl_operating_cost",
  sales_marketing: "pnl_operating_cost", travel_entertainment: "pnl_operating_cost",
  it: "pnl_operating_cost", hr: "pnl_operating_cost", admin: "pnl_operating_cost",
  facilities: "pnl_operating_cost", insurance: "pnl_operating_cost",
  stock_based_comp: "pnl_operating_cost", depreciation_amortization: "pnl_operating_cost",
  // BS asset
  cash: "bs_asset", accounts_receivable: "bs_asset", unbilled_wip: "bs_asset",
  prepaid_expenses: "bs_asset", fixed_assets_net: "bs_asset", rou_asset: "bs_asset",
  // BS liability
  deferred_revenue: "bs_liability", accounts_payable: "bs_liability", lease_liability: "bs_liability",
};

/** The re-point group an account belongs to, keyed by its (immutable) accountType — null = not re-pointable. */
function repointGroupOf(accountType: AccountType): RepointGroup | null {
  switch (accountType) {
    case "revenue": return "pnl_revenue";
    case "cost_of_revenue":
    case "operating_expense": return "pnl_operating_cost";
    case "asset": return "bs_asset";
    case "liability": return "bs_liability";
    default: return null; // equity, contra_equity, other_income, tax → not re-pointable
  }
}

const isExpenseType = (t: AccountType): boolean => t === "cost_of_revenue" || t === "operating_expense";
const VALID_FUNCTIONS: readonly CostFunction[] = ["direct", "rnd", "sm", "ga"];
const VALID_CLASSES: readonly StatementClassification[] = ["cost_of_revenue", "operating_expense"];

export async function listAccountOverrides(): Promise<readonly AccountOverride[]> {
  return getDataStore().listAccountOverrides();
}

/**
 * The valid re-point target statement lines for an account (same group, excluding its own current line).
 * Empty when the account is not re-pointable (equity / below-the-line). The UI builds its <select> from this.
 */
export async function repointTargetsFor(code: string): Promise<readonly string[]> {
  const account = (await getDataStore().listGlAccounts()).find((a) => a.code === code);
  if (!account) return [];
  const group = repointGroupOf(account.accountType);
  if (!group) return [];
  return Object.keys(LINE_GROUP).filter((id) => LINE_GROUP[id] === group && id !== account.statementLineId);
}

/**
 * Apply a field-level override to an account, MERGING with any existing override (so editing one field
 * keeps the others). Validates every provided field; a write that fails a guard THROWS (the Server
 * Action surfaces it) rather than silently corrupting the map. `statementLineId` must be in the SAME
 * re-point group (same section/nature) — this single check rejects subtotals, equity, below-the-line,
 * and cross-statement targets. `classification`/`function` are editable only on expense accounts.
 */
export async function setAccountOverride(
  code: string,
  delta: { statementLineId?: string; classification?: string; function?: string },
): Promise<void> {
  const ds = getDataStore();
  const account = (await ds.listGlAccounts()).find((a) => a.code === code);
  if (!account) throw new Error(`Unknown account: ${code}`);

  if (delta.statementLineId !== undefined) {
    const group = repointGroupOf(account.accountType);
    if (!group) throw new Error(`Account ${code} (${account.accountType}) is not re-pointable.`);
    if (LINE_GROUP[delta.statementLineId] !== group)
      throw new Error(`Cannot re-point ${code} to "${delta.statementLineId}" — different section/nature (or not a re-pointable leaf line).`);
  }
  if (delta.classification !== undefined) {
    if (!isExpenseType(account.accountType)) throw new Error(`Classification is editable only on expense accounts (${code} is ${account.accountType}).`);
    if (!VALID_CLASSES.includes(delta.classification as StatementClassification)) throw new Error(`Invalid classification "${delta.classification}".`);
  }
  if (delta.function !== undefined) {
    if (!isExpenseType(account.accountType)) throw new Error(`Function is editable only on expense accounts (${code} is ${account.accountType}).`);
    if (!VALID_FUNCTIONS.includes(delta.function as CostFunction)) throw new Error(`Invalid function "${delta.function}".`);
  }

  // merge with any existing override so editing one field doesn't wipe another (e.g. set class after a re-point)
  const existing = (await ds.listAccountOverrides()).find((o) => o.code === code);
  await ds.setAccountOverride(code, {
    statementLineId: (delta.statementLineId ?? existing?.statementLineId) as AccountOverride["statementLineId"],
    classification: (delta.classification ?? existing?.classification) as AccountOverride["classification"],
    function: (delta.function ?? existing?.function) as AccountOverride["function"],
    source: "ui",
  });
}

/** Reset an account to its default (immutable-chart) mapping — removes the whole override row. */
export async function clearAccountOverride(code: string): Promise<void> {
  return getDataStore().clearAccountOverride(code);
}
