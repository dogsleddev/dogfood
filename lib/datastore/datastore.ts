/**
 * The DataStore interface — the "Swap Don't Rewrite" seam (CLAUDE.md §4).
 * lib/queries/ reads ONLY through this. Start with InMemoryDataStore (reads the seed);
 * swap to SupabaseDataStore later behind the same interface. All methods are async so
 * the Supabase swap needs no restructuring.
 *
 * The DataStore returns raw records/config; lib/queries/ composes them into the typed
 * outputs the UI and Scout share (one source, two callers).
 */
import type { CurrencyCode } from "@/lib/types/money";
import type { Month, PeriodRange } from "@/lib/types/period";
import type {
  FirmId,
  CostFunction,
  ExpenseGroupId,
  ScenarioId,
  MetricId,
  Department,
  ExpenseGroup,
} from "@/lib/types/common";
import type {
  Contract,
  Customer,
  Renewal,
  PipelineOpportunity,
  Project,
  StaffMember,
  ExpenseTransaction,
  GlAccount,
  JournalEntry,
} from "@/lib/types/source";
import type { CustomerInvoice, CashReceipt, Paycheck, Timesheet } from "@/lib/types/transactions";
import type { FluxNote, NewFluxNote, FluxNoteFilter } from "@/lib/types/flux";
import type { Scenario } from "@/lib/types/scenario";
import type {
  PnL,
  MonthlyPnL,
  BudgetSnapshot,
  BalanceSheet,
  CashFlow,
  Runway,
  NonGaapReconciliation,
} from "@/lib/types/statements";
import type { DashboardSummary, KpiTile } from "@/lib/types/dashboard";
import type { MetricValue } from "@/lib/types/metrics";
// Type-only imports of the seed model shapes. These are compile-time contracts (erased at
// runtime), so they do NOT couple the spine to the seed: the composer queries read these
// models through getDataStore(), and a SupabaseDataStore returns the same typed shapes (§4).
import type { SubscriptionSeed } from "@/lib/seed/subscription";
import type { ServicesSeed } from "@/lib/seed/services";
import type { BalanceSheetSeed } from "@/lib/seed/balance-sheet";
import type { PersonnelSeed } from "@/lib/seed/personnel";
import type { CostOfRevenueSeed } from "@/lib/seed/cost-of-revenue";
import type { OpExSeed } from "@/lib/seed/opex";

export interface FirmProfile {
  readonly id: FirmId;
  readonly name: string;
  readonly shortCode: string;
}

/**
 * Firm/period config. The close boundary follows CLAUDE.md §11 (calendar FY; May 2026
 * closed, June 2026 in close, Jul–Dec 2026 forecast). The PRECISE close state is a
 * pending seed parameter (§17) — read it from here, never hardcode in queries.
 */
export interface AppSettings {
  readonly currency: CurrencyCode;
  /** 1 = January (Bearing runs a calendar fiscal year) */
  readonly fiscalYearStartMonth: number;
  /** last fully closed month */
  readonly closeThrough: Month;
  /** the month currently in close, if any */
  readonly inCloseMonth?: Month;
  readonly forecastHorizon: PeriodRange;
}

export interface ExpenseTransactionFilter {
  readonly period?: Month;
  readonly groupId?: ExpenseGroupId;
  readonly function?: CostFunction;
}

export interface TimesheetFilter {
  readonly period?: Month;
  readonly projectId?: string;
  readonly staffId?: string;
}

export interface PaycheckFilter {
  readonly period?: Month;
  readonly staffId?: string;
}

export interface CustomerInvoiceFilter {
  readonly period?: Month;
  readonly customerId?: string;
  readonly stream?: "subscription" | "services";
}

export interface CashReceiptFilter {
  readonly period?: Month;
  readonly customerId?: string;
}

export interface DataStore {
  // ── config / account mapping ──
  getFirm(): Promise<FirmProfile>;
  getSettings(): Promise<AppSettings>;
  listDepartments(): Promise<readonly Department[]>;
  listExpenseGroups(): Promise<readonly ExpenseGroup[]>;
  listGlAccounts(): Promise<readonly GlAccount[]>;

  // ── layer 1 · source records ──
  listPipeline(): Promise<readonly PipelineOpportunity[]>;
  listContracts(): Promise<readonly Contract[]>;
  getContract(id: string): Promise<Contract | undefined>;
  listCustomers(): Promise<readonly Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  listRenewals(window?: PeriodRange): Promise<readonly Renewal[]>;
  listProjects(): Promise<readonly Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  listStaff(): Promise<readonly StaffMember[]>;
  listExpenseTransactions(filter?: ExpenseTransactionFilter): Promise<readonly ExpenseTransaction[]>;
  listJournalEntries(period?: Month): Promise<readonly JournalEntry[]>;

  // ── layer 1 · transaction sub-ledger (individual invoices / paychecks / timesheets / receipts) ──
  listTimesheets(filter?: TimesheetFilter): Promise<readonly Timesheet[]>;
  listPaychecks(filter?: PaycheckFilter): Promise<readonly Paycheck[]>;
  listCustomerInvoices(filter?: CustomerInvoiceFilter): Promise<readonly CustomerInvoice[]>;
  listCashReceipts(filter?: CashReceiptFilter): Promise<readonly CashReceipt[]>;

  // ── scenarios (the contained deltas — scenario_inputs) ──
  listScenarios(): Promise<readonly Scenario[]>;
  getScenario(id: ScenarioId): Promise<Scenario | undefined>;
  upsertScenario(scenario: Scenario): Promise<void>;
  deleteScenario(id: ScenarioId): Promise<void>;

  // ── flux notes (the first user-WRITE surface — flux-analysis.md; a comment thread per anchor) ──
  listFluxNotes(filter?: FluxNoteFilter): Promise<readonly FluxNote[]>;
  addFluxNote(note: NewFluxNote): Promise<FluxNote>;
  setFluxNoteResolved(id: string, resolved: boolean): Promise<void>;
  deleteFluxNote(id: string): Promise<void>;

  // ── budget snapshot (the locked baseline — §8) ──
  getBudgetSnapshot(): Promise<BudgetSnapshot | undefined>;
  saveBudgetSnapshot(snapshot: BudgetSnapshot): Promise<void>;

  // ── derived financial statements (layer 3) ──
  // The seed's tying-out reference implementation lives behind these. lib/queries forwards or
  // composes them; it never imports lib/seed directly (Swap Don't Rewrite — Principle 5).
  getPnL(period: Month): Promise<PnL>;
  /** Month-across-columns P&L for the fiscal year of `period` (the board-package view). */
  getMonthlyPnL(period: Month): Promise<MonthlyPnL>;
  /** Per-period Budget VIEW derived from the plan (distinct from getBudgetSnapshot, the locked store). */
  getBudgetView(period: Month): Promise<BudgetSnapshot>;
  getBalanceSheet(period: Month): Promise<BalanceSheet>;
  getCashFlow(period: Month): Promise<CashFlow>;
  getRunway(asOf: Month): Promise<Runway>;
  getNonGaapReconciliation(period: Month): Promise<NonGaapReconciliation>;

  // ── dashboard + metrics (layers 4–5) ──
  getDashboardSummary(period: Month): Promise<DashboardSummary>;
  getKpiTile(metricId: MetricId, period: Month): Promise<KpiTile | undefined>;
  getMetricValue(metricId: MetricId, period: Month): Promise<MetricValue | undefined>;

  // ── raw financial model (the driver series the composer queries read; see §4 note above) ──
  getSubscriptionModel(): Promise<SubscriptionSeed>;
  getServicesModel(): Promise<ServicesSeed>;
  getBalanceSheetModel(): Promise<BalanceSheetSeed>;
  getPersonnelModel(): Promise<PersonnelSeed>;
  getCostOfRevenueModel(): Promise<CostOfRevenueSeed>;
  getOpExModel(): Promise<OpExSeed>;
}
