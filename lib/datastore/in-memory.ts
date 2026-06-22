/**
 * InMemoryDataStore — the current DataStore implementation (CLAUDE.md §4).
 * Reads the seed; for Phase 0 the seed financials don't exist yet, so layer-1 record
 * collections are empty and only the LOCKED structural config (firm, settings,
 * departments, OpEx groups) is populated — from the single swappable placeholder file.
 * Swap this for SupabaseDataStore later behind the same interface.
 */
import type {
  DataStore,
  FirmProfile,
  AppSettings,
  ExpenseTransactionFilter,
  TimesheetFilter,
  PaycheckFilter,
  CustomerInvoiceFilter,
  CashReceiptFilter,
} from "./datastore";
import type { Month, PeriodRange } from "@/lib/types/period";
import { monthYear } from "@/lib/types/period";
import type { Department, ExpenseGroup, ScenarioId, MetricId } from "@/lib/types/common";
import type {
  Contract,
  Customer,
  Renewal,
  PipelineOpportunity,
  Project,
  StaffMember,
  ExpenseTransaction,
  GlAccount,
  AccountOverride,
  JournalEntry,
} from "@/lib/types/source";
import type { Scenario } from "@/lib/types/scenario";
import type {
  PnL,
  MonthlyPnL,
  MonthlyBalanceSheet,
  MonthlyCashFlow,
  BudgetSnapshot,
  BalanceSheet,
  CashFlow,
  Runway,
  NonGaapReconciliation,
} from "@/lib/types/statements";
import type { DashboardSummary, KpiTile } from "@/lib/types/dashboard";
import type { MetricValue } from "@/lib/types/metrics";
import type { FluxNote, NewFluxNote, FluxNoteFilter } from "@/lib/types/flux";
import { randomUUID } from "node:crypto";
import type { SubscriptionSeed } from "@/lib/seed/subscription";
import type { ServicesSeed } from "@/lib/seed/services";
import type { BalanceSheetSeed } from "@/lib/seed/balance-sheet";
import type { CustomerInvoice, CashReceipt, Paycheck, Timesheet } from "@/lib/types/transactions";
import {
  PLACEHOLDER_FIRM,
  PLACEHOLDER_SETTINGS,
  SEED_DEPARTMENTS,
  SEED_EXPENSE_GROUPS,
} from "@/lib/target/placeholder";
import { getSubscriptionSeed, getServicesSeed, getPersonnelSeed, getBalanceSheetSeed, getPipelineSeed, getRenewalsSeed, getCostOfRevenueSeed, getOpExSeed } from "@/lib/seed";
import type { PersonnelSeed } from "@/lib/seed/personnel";
import type { CostOfRevenueSeed } from "@/lib/seed/cost-of-revenue";
import type { OpExSeed } from "@/lib/seed/opex";
import {
  buildSeedPnL,
  buildSeedMonthlyPnL,
  buildSeedBudget,
  applyBudgetSnapshot,
  SEED_BUDGET_PERIOD,
  buildSeedBalanceSheet,
  buildSeedMonthlyBalanceSheet,
  buildSeedCashFlow,
  buildSeedMonthlyCashFlow,
  buildSeedRunway,
  buildSeedNonGaap,
} from "@/lib/seed/statements";
import { buildSeedDashboard, buildSeedKpiTile, buildSeedMetricValue } from "@/lib/seed/dashboard-metrics";
import { CHART_OF_ACCOUNTS, getLedger } from "@/lib/seed/gl";
import { composeGlAccounts } from "./account-overrides";
import { getTransactionsSeed } from "@/lib/seed/transactions";

export class InMemoryDataStore implements DataStore {
  private scenarios = new Map<ScenarioId, Scenario>();
  private budget: BudgetSnapshot | undefined;
  private fluxNotes: FluxNote[] = [];
  // The override layer (§17): a mutable delta list off the immutable chart. Starts EMPTY, so
  // listGlAccounts() returns CHART_OF_ACCOUNTS by reference (the byte-identical path). Persists across
  // requests via the globalThis store singleton, exactly like fluxNotes.
  private accountOverrides: AccountOverride[] = [];

  // ── config / account mapping ──
  async getFirm(): Promise<FirmProfile> {
    return PLACEHOLDER_FIRM;
  }
  async getSettings(): Promise<AppSettings> {
    return PLACEHOLDER_SETTINGS;
  }
  async listDepartments(): Promise<readonly Department[]> {
    return SEED_DEPARTMENTS;
  }
  async listExpenseGroups(): Promise<readonly ExpenseGroup[]> {
    return [...SEED_EXPENSE_GROUPS].sort((a, b) => a.order - b.order);
  }
  async listGlAccounts(): Promise<readonly GlAccount[]> {
    // The EFFECTIVE map = immutable chart ⊕ overrides. Empty overrides ⇒ CHART_OF_ACCOUNTS by reference.
    return composeGlAccounts(CHART_OF_ACCOUNTS, this.accountOverrides);
  }

  // ── account-mapping override layer (mutable; read fresh, never cached) ──
  async listAccountOverrides(): Promise<readonly AccountOverride[]> {
    return [...this.accountOverrides]; // defensive copy (match the sibling getters; never hand out the live array)
  }
  async setAccountOverride(code: string, delta: Omit<AccountOverride, "code" | "updatedAt">): Promise<void> {
    const row: AccountOverride = { ...delta, code, updatedAt: new Date().toISOString() };
    const i = this.accountOverrides.findIndex((o) => o.code === code);
    if (i >= 0) this.accountOverrides[i] = row;
    else this.accountOverrides.push(row);
  }
  async clearAccountOverride(code: string): Promise<void> {
    this.accountOverrides = this.accountOverrides.filter((o) => o.code !== code);
  }

  // ── layer 1 · source records (from the seed) ──
  async listPipeline(): Promise<readonly PipelineOpportunity[]> {
    return getPipelineSeed().opportunities;
  }
  async listContracts(): Promise<readonly Contract[]> {
    return getSubscriptionSeed().contracts;
  }
  async getContract(id: string): Promise<Contract | undefined> {
    return getSubscriptionSeed().contracts.find((c) => c.id === id);
  }
  async listCustomers(): Promise<readonly Customer[]> {
    return getSubscriptionSeed().customers;
  }
  async getCustomer(id: string): Promise<Customer | undefined> {
    return getSubscriptionSeed().customers.find((c) => c.id === id);
  }
  async listRenewals(window?: PeriodRange): Promise<readonly Renewal[]> {
    const all = getRenewalsSeed().renewals;
    if (!window) return all;
    return all.filter((r) => r.dueMonth >= window.start && r.dueMonth <= window.end);
  }
  async listProjects(): Promise<readonly Project[]> {
    return getServicesSeed().projects;
  }
  async getProject(id: string): Promise<Project | undefined> {
    return getServicesSeed().projects.find((p) => p.id === id);
  }
  async listStaff(): Promise<readonly StaffMember[]> {
    return getPersonnelSeed().staff;
  }
  async listExpenseTransactions(filter?: ExpenseTransactionFilter): Promise<readonly ExpenseTransaction[]> {
    let bills = getTransactionsSeed().vendorBills;
    if (filter?.period) bills = bills.filter((b) => b.period === filter.period);
    if (filter?.groupId) bills = bills.filter((b) => b.groupId === filter.groupId);
    if (filter?.function) bills = bills.filter((b) => b.function === filter.function);
    return bills;
  }
  async listJournalEntries(period?: Month): Promise<readonly JournalEntry[]> {
    const entries = getLedger().journalEntries;
    return period ? entries.filter((e) => e.period === period) : entries;
  }

  // ── layer 1 · transaction sub-ledger (reconciles to the monthly drivers — see lib/seed/transactions.ts) ──
  async listTimesheets(filter?: TimesheetFilter): Promise<readonly Timesheet[]> {
    let rows = getTransactionsSeed().timesheets;
    if (filter?.period) rows = rows.filter((t) => t.period === filter.period);
    if (filter?.projectId) rows = rows.filter((t) => t.projectId === filter.projectId);
    if (filter?.staffId) rows = rows.filter((t) => t.staffId === filter.staffId);
    return rows;
  }
  async listPaychecks(filter?: PaycheckFilter): Promise<readonly Paycheck[]> {
    let rows = getTransactionsSeed().paychecks;
    if (filter?.period) rows = rows.filter((p) => p.period === filter.period);
    if (filter?.staffId) rows = rows.filter((p) => p.staffId === filter.staffId);
    return rows;
  }
  async listCustomerInvoices(filter?: CustomerInvoiceFilter): Promise<readonly CustomerInvoice[]> {
    let rows = getTransactionsSeed().customerInvoices;
    if (filter?.period) rows = rows.filter((iv) => iv.period === filter.period);
    if (filter?.customerId) rows = rows.filter((iv) => iv.customerId === filter.customerId);
    if (filter?.stream) rows = rows.filter((iv) => iv.stream === filter.stream);
    return rows;
  }
  async listCashReceipts(filter?: CashReceiptFilter): Promise<readonly CashReceipt[]> {
    let rows = getTransactionsSeed().cashReceipts;
    if (filter?.period) rows = rows.filter((r) => r.period === filter.period);
    if (filter?.customerId) rows = rows.filter((r) => r.customerId === filter.customerId);
    return rows;
  }

  // ── scenarios (USER scenarios only — Base + presets are code-defined; see lib/scenario/registry) ──
  async listScenarios(): Promise<readonly Scenario[]> {
    return [...this.scenarios.values()];
  }
  async getScenario(id: ScenarioId): Promise<Scenario | undefined> {
    return this.scenarios.get(id);
  }
  async upsertScenario(scenario: Scenario): Promise<void> {
    this.scenarios.set(scenario.id, scenario);
  }
  async deleteScenario(id: ScenarioId): Promise<void> {
    this.scenarios.delete(id);
  }

  // ── flux notes (mutable in-memory thread; persists across requests via the globalThis store) ──
  async listFluxNotes(filter: FluxNoteFilter = {}): Promise<readonly FluxNote[]> {
    return this.fluxNotes.filter(
      (n) =>
        (filter.transactionId === undefined || n.transactionId === filter.transactionId) &&
        (filter.accountCode === undefined || n.accountCode === filter.accountCode) &&
        (filter.statementLine === undefined || n.statementLine === filter.statementLine) &&
        (filter.period === undefined || n.period === filter.period),
    );
  }
  async addFluxNote(note: NewFluxNote): Promise<FluxNote> {
    const now = new Date().toISOString();
    const saved: FluxNote = { ...note, id: randomUUID(), resolved: note.resolved ?? false, createdAt: now, updatedAt: now };
    this.fluxNotes.push(saved);
    return saved;
  }
  async setFluxNoteResolved(id: string, resolved: boolean): Promise<void> {
    const i = this.fluxNotes.findIndex((n) => n.id === id);
    if (i >= 0) this.fluxNotes[i] = { ...this.fluxNotes[i], resolved, updatedAt: new Date().toISOString() };
  }
  async deleteFluxNote(id: string): Promise<void> {
    this.fluxNotes = this.fluxNotes.filter((n) => n.id !== id);
  }

  // ── budget snapshot (§8: the seed starts with the FY26 Plan locked; lock/reset re-freeze it) ──
  async getBudgetSnapshot(): Promise<BudgetSnapshot | undefined> {
    if (!this.budget) this.budget = buildSeedBudget(SEED_BUDGET_PERIOD); // initial FY-Plan lock
    return this.budget;
  }
  async saveBudgetSnapshot(snapshot: BudgetSnapshot): Promise<void> {
    this.budget = snapshot;
  }
  async lockBudget(opts?: { asOf?: Month; sourcedFrom?: "base" | "scenario" }): Promise<BudgetSnapshot> {
    const snapshot: BudgetSnapshot = {
      ...buildSeedBudget(opts?.asOf ?? SEED_BUDGET_PERIOD),
      sourcedFrom: opts?.sourcedFrom ?? "base",
    };
    await this.saveBudgetSnapshot(snapshot);
    return snapshot;
  }
  async resetBudget(): Promise<BudgetSnapshot> {
    return this.lockBudget(); // re-freeze the default FY Plan
  }

  // ── derived financial statements (delegate to the seed's tying-out reference impl) ──
  async getPnL(period: Month): Promise<PnL> {
    // The ACTUAL column rolls up through the EFFECTIVE Account Mapping (chart ⊕ overrides, §17), so a
    // re-point moves it. The locked Budget snapshot (default-plan map, no `accounts`) is overlaid onto
    // the immutable forecast/actual (the budget is a write surface off immutable source, §4); falls back
    // to the default plan for prior FYs / pre-lock.
    const accounts = await this.listGlAccounts();
    return applyBudgetSnapshot(buildSeedPnL(period, accounts), await this.getBudgetSnapshot(), period);
  }
  async getMonthlyPnL(period: Month): Promise<MonthlyPnL> {
    return buildSeedMonthlyPnL(period, await this.listGlAccounts());
  }
  async getBudgetView(period: Month): Promise<BudgetSnapshot> {
    const snap = await this.getBudgetSnapshot();
    if (snap && monthYear(snap.horizon.start) === monthYear(period)) return snap;
    return buildSeedBudget(period); // default plan for prior fiscal years
  }
  async getBalanceSheet(period: Month): Promise<BalanceSheet> {
    // ACTUAL rolls up through the EFFECTIVE Account Mapping (chart ⊕ overrides, §17); empty ⇒ generator chart.
    return buildSeedBalanceSheet(period, await this.listGlAccounts());
  }
  async getMonthlyBalanceSheet(period: Month): Promise<MonthlyBalanceSheet> {
    return buildSeedMonthlyBalanceSheet(period, await this.listGlAccounts());
  }
  async getCashFlow(period: Month): Promise<CashFlow> {
    // working-capital + NI Actual roll up through the EFFECTIVE Account Mapping (§17); empty ⇒ generator chart.
    return buildSeedCashFlow(period, await this.listGlAccounts());
  }
  async getMonthlyCashFlow(period: Month): Promise<MonthlyCashFlow> {
    return buildSeedMonthlyCashFlow(period, await this.listGlAccounts());
  }
  async getRunway(asOf: Month): Promise<Runway> {
    return buildSeedRunway(asOf);
  }
  async getNonGaapReconciliation(period: Month): Promise<NonGaapReconciliation> {
    return buildSeedNonGaap(period);
  }

  // ── dashboard + metrics ──
  async getDashboardSummary(period: Month): Promise<DashboardSummary> {
    return buildSeedDashboard(period);
  }
  async getKpiTile(metricId: MetricId, period: Month): Promise<KpiTile | undefined> {
    return buildSeedKpiTile(metricId, period);
  }
  async getMetricValue(metricId: MetricId, period: Month): Promise<MetricValue | undefined> {
    return buildSeedMetricValue(metricId, period);
  }

  // ── raw financial model (the composer queries read the driver series off these) ──
  async getSubscriptionModel(): Promise<SubscriptionSeed> {
    return getSubscriptionSeed();
  }
  async getServicesModel(): Promise<ServicesSeed> {
    return getServicesSeed();
  }
  async getBalanceSheetModel(): Promise<BalanceSheetSeed> {
    return getBalanceSheetSeed();
  }
  async getPersonnelModel(): Promise<PersonnelSeed> {
    return getPersonnelSeed();
  }
  async getCostOfRevenueModel(): Promise<CostOfRevenueSeed> {
    return getCostOfRevenueSeed();
  }
  async getOpExModel(): Promise<OpExSeed> {
    return getOpExSeed();
  }
}
