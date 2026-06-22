/**
 * Cross-cutting domain primitives: branded ids, the two-axis cost model,
 * revenue streams, and the five data layers (CLAUDE.md §5, §7, §8).
 */

/** Generic branded id helper. */
export type Id<Brand extends string> = string & { readonly __idBrand: Brand };

export type FirmId = Id<"Firm">;
export type ScenarioId = Id<"Scenario">;
export type CustomerId = Id<"Customer">;
export type ContractId = Id<"Contract">;
export type DealId = Id<"Deal">;
export type RenewalId = Id<"Renewal">;
export type ProjectId = Id<"Project">;
export type StaffId = Id<"Staff">;
export type DepartmentId = Id<"Department">;
export type GlAccountId = Id<"GlAccount">;
export type JournalEntryId = Id<"JournalEntry">;
export type ExpenseGroupId = Id<"ExpenseGroup">;
export type StatementLineId = Id<"StatementLine">;
export type MetricId = Id<"Metric">;
export type GuideId = Id<"Guide">;

/** The two revenue streams (Bearing: ~75% subscription / 25% services — §11). */
export type Stream = "subscription" | "services";

/** Cost NATURE — how a cost is entered (CLAUDE.md §8 two-axis cost model). */
export type CostNature = "payroll" | "non_payroll";

/** Cost FUNCTION — how a cost is presented/measured (Direct/CoR · R&D · S&M · G&A). */
export type CostFunction = "direct" | "rnd" | "sm" | "ga";

/** Typed P&L classification carried by every expense group (§7). */
export type StatementClassification = "cost_of_revenue" | "operating_expense";

/** GL account nature — sets the normal balance (asset/expense = debit; the rest = credit) and
 *  the statement section. `accumulated_deficit` is contra-equity (a debit-natured equity account). */
export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "contra_equity"
  | "revenue"
  | "cost_of_revenue"
  | "operating_expense"
  | "other_income"
  | "tax";

/** The five data-model layers (§5). */
export type LayerNumber = 1 | 2 | 3 | 4 | 5;

/** A department with its locked function tag (seed set is editable in Settings — §8). */
export interface Department {
  readonly id: DepartmentId;
  readonly name: string;
  readonly function: CostFunction;
}

/** An expense group: membership is config-driven, classification is typed (§7). */
export interface ExpenseGroup {
  readonly id: ExpenseGroupId;
  readonly label: string;
  readonly classification: StatementClassification;
  readonly function: CostFunction;
  /** display order, owned by Settings */
  readonly order: number;
}
