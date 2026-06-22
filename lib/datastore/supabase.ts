/**
 * SupabaseDataStore — the persistent record layer (CLAUDE.md §4 "Swap Don't Rewrite").
 *
 * The DECISIVE architecture fact: the statement/metric builders (lib/seed/statements.ts,
 * dashboard-metrics.ts) read the deterministic generator DIRECTLY (getSubscriptionSeed() …),
 * not through getDataStore(). So "statements stay computed in TS" (§3) literally means the
 * builders are unchanged and generator-backed. What genuinely MOVES to Supabase is the
 * persistent record layer — every layer-1 record, the config, the GL, and the sub-ledger —
 * i.e. exactly the CFO's importable/mutable data.
 *
 * Therefore this class EXTENDS InMemoryDataStore and OVERRIDES only the record/config reads (plus the
 * flux-note writes) to hit Supabase; statements, metrics, and the raw driver models are INHERITED
 * (generator-backed), so they stay identical by construction. Scenario writes persist to Supabase
 * (the scenarios.adjustments JSONB column, overridden below); the budget-snapshot write store is
 * still inherited in-memory (its persistence is a later step). The seed loads into
 * Supabase once (scripts/seed-supabase.ts); a round-trip is then byte-faithful to the generator
 * (proven by scripts/supabase-parity.ts), so swapping the store changes storage, not numbers.
 *
 * Reads are lazily fetched once per collection and cached (the seed is immutable for reads), then
 * filtered in TS with the SAME predicates InMemoryDataStore uses — so behavior is identical.
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { InMemoryDataStore } from "./in-memory";
import type {
  FirmProfile,
  AppSettings,
  ExpenseTransactionFilter,
  TimesheetFilter,
  PaycheckFilter,
  CustomerInvoiceFilter,
  CashReceiptFilter,
} from "./datastore";
import type { Month, PeriodRange } from "@/lib/types/period";
import { usd, percent, type Money, type Percent } from "@/lib/types/money";
import type {
  Department,
  ExpenseGroup,
  DepartmentId,
  ExpenseGroupId,
  FirmId,
  CostFunction,
  GlAccountId,
  JournalEntryId,
  StatementClassification,
  StatementLineId,
  AccountType,
  Stream,
  CustomerId,
  ContractId,
  DealId,
  RenewalId,
  ProjectId,
  StaffId,
  ScenarioId,
} from "@/lib/types/common";
import type {
  Contract,
  Customer,
  Renewal,
  PipelineOpportunity,
  Project,
  StaffMember,
  GlAccount,
  JournalEntry,
  JournalLine,
  ContractStatus,
  CustomerStatus,
  PlanTier,
  BookingType,
  PipelineStage,
  RenewalStatus,
  ProjectStatus,
} from "@/lib/types/source";
import type { CustomerInvoice, CashReceipt, Paycheck, Timesheet, VendorBill, DocStatus, CustomerInvoiceKind } from "@/lib/types/transactions";
import type { FluxNote, NewFluxNote, FluxNoteFilter, FluxNoteSource } from "@/lib/types/flux";
import type { Scenario, Adjustment, Magnitude, ScenarioBaseline, AdjustmentShape } from "@/lib/types/scenario";
import { parseMonth } from "@/lib/types/period";

// ── env + client (server-only: the service-role key never reaches the browser) ──
function makeClient(): SupabaseClient {
  // Next loads .env.local automatically; tsx-run scripts (gates, loaders) do not — so if the keys
  // aren't already present, read .env.local once as a fallback. No-op in the Next app (keys set).
  if ((!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) && existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const mt = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (mt && !process.env[mt[1]]) process.env[mt[1]] = mt[2];
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SupabaseDataStore: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local).",
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ── scalar coercers (DB numeric dollars → Money minor cents; text → branded scalars) ──
const s = (v: unknown): string => (v == null ? "" : String(v));
const opt = (v: unknown): string | undefined => (v == null || v === "" ? undefined : String(v));
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const mny = (v: unknown): Money => usd(v == null ? 0 : Number(v));
const optMny = (v: unknown): Money | undefined => (v == null ? undefined : usd(Number(v)));
const pct = (v: unknown): Percent => percent(v == null ? 0 : Number(v));
const mo = (v: unknown): Month => String(v) as Month;
const optMo = (v: unknown): Month | undefined => (v == null || v === "" ? undefined : (String(v) as Month));

type Row = Record<string, unknown>;

// ── row → typed record mappers (column names match supabase/migrations/0001_init.sql) ──
const rowToCustomer = (r: Row): Customer => ({
  id: s(r.id) as CustomerId, name: s(r.name), segment: opt(r.segment), startMonth: mo(r.start_month),
  status: s(r.status) as CustomerStatus, arr: mny(r.arr), churnMonth: optMo(r.churn_month),
});
const rowToContract = (r: Row): Contract => ({
  id: s(r.id) as ContractId, customerId: s(r.customer_id) as CustomerId, customerName: s(r.customer_name), stream: s(r.stream) as Stream,
  planTier: opt(r.plan_tier) as PlanTier | undefined, arr: mny(r.arr), startMonth: mo(r.start_month),
  termMonths: num(r.term_months), status: s(r.status) as ContractStatus, bookingType: s(r.booking_type) as BookingType,
});
const rowToPipeline = (r: Row): PipelineOpportunity => ({
  id: s(r.id) as DealId, customerName: s(r.customer_name), stream: s(r.stream) as Stream, stage: s(r.stage) as PipelineStage,
  arr: mny(r.arr), owner: s(r.owner), expectedClose: mo(r.expected_close), probability: pct(r.probability),
  kind: s(r.kind) as "new_logo" | "expansion",
});
const rowToRenewal = (r: Row): Renewal => ({
  id: s(r.id) as RenewalId, contractId: s(r.contract_id) as ContractId, customerId: s(r.customer_id) as CustomerId, dueMonth: mo(r.due_month),
  arrUpForRenewal: mny(r.arr_up_for_renewal), newArr: optMny(r.new_arr), status: s(r.status) as RenewalStatus,
});
const rowToProject = (r: Row): Project => ({
  id: s(r.id) as ProjectId, name: s(r.name), customerId: s(r.customer_id) as CustomerId, status: s(r.status) as ProjectStatus,
  pctComplete: pct(r.pct_complete), contractValue: mny(r.contract_value), wip: mny(r.wip), marginPct: pct(r.margin_pct),
});
const rowToStaff = (r: Row): StaffMember => ({
  id: s(r.id) as StaffId, name: s(r.name), departmentId: s(r.department_id) as DepartmentId, function: s(r.function) as CostFunction,
  title: s(r.title), startMonth: mo(r.start_month), endMonth: optMo(r.end_month), fte: num(r.fte), baseComp: mny(r.annual_base_comp),
});
const rowToGlAccount = (r: Row): GlAccount => ({
  // The generator sets id === code (lib/seed/gl.ts), so map id from the code PK.
  id: s(r.code) as GlAccountId, code: s(r.code), name: s(r.name), accountType: s(r.account_type) as AccountType,
  classification: opt(r.classification) as StatementClassification | undefined, function: opt(r.function) as CostFunction | undefined,
  statementLineId: s(r.statement_line) as StatementLineId,
});
const rowToVendorBill = (r: Row): VendorBill => ({
  id: s(r.id) as JournalEntryId, period: mo(r.period), glAccountId: s(r.account_id) as GlAccountId,
  groupId: s(r.group_id) as ExpenseGroupId, function: s(r.function) as CostFunction, vendor: opt(r.vendor), memo: opt(r.memo),
  amount: mny(r.amount), docNumber: s(r.doc_number), date: s(r.date), dueDate: s(r.due_date), status: s(r.status) as DocStatus,
});
const rowToPaycheck = (r: Row): Paycheck => ({
  id: s(r.id), docNumber: s(r.doc_number), staffId: s(r.staff_id) as StaffId, period: mo(r.period), periodLabel: s(r.period_label),
  date: s(r.date), grossPay: mny(r.gross_pay), employeeTaxes: mny(r.employee_taxes), benefits: mny(r.benefits), netPay: mny(r.net_pay),
});
const rowToTimesheet = (r: Row): Timesheet => ({
  id: s(r.id), docNumber: s(r.doc_number), staffId: s(r.staff_id) as StaffId, projectId: s(r.project_id) as ProjectId, period: mo(r.period),
  date: s(r.date), weekLabel: s(r.week_label), hours: num(r.hours), billRate: mny(r.bill_rate), costRate: mny(r.cost_rate),
  billableValue: mny(r.billable_value), laborCost: mny(r.labor_cost),
});
const rowToInvoice = (r: Row): CustomerInvoice => ({
  id: s(r.id), docNumber: s(r.doc_number), customerId: s(r.customer_id) as CustomerId, contractId: opt(r.contract_id) as ContractId | undefined,
  projectId: opt(r.project_id) as ProjectId | undefined, period: mo(r.period), date: s(r.date), dueDate: s(r.due_date),
  status: s(r.status) as DocStatus, stream: s(r.stream) as "subscription" | "services", kind: s(r.kind) as CustomerInvoiceKind, amount: mny(r.amount),
});
const rowToReceipt = (r: Row): CashReceipt => ({
  id: s(r.id), docNumber: s(r.doc_number), customerId: s(r.customer_id) as CustomerId, period: mo(r.period), date: s(r.date),
  appliedInvoiceId: opt(r.applied_invoice_id), appliedDocNumber: opt(r.applied_doc_number), amount: mny(r.amount),
});
const rowToFluxNote = (r: Row): FluxNote => ({
  id: s(r.id), transactionId: opt(r.transaction_id), accountCode: opt(r.account_code), statementLine: opt(r.statement_line),
  period: optMo(r.period), author: s(r.author), body: s(r.body), amountAtNote: optMny(r.amount_at_note),
  resolved: r.resolved === true, source: s(r.source) as FluxNoteSource, createdAt: s(r.created_at), updatedAt: s(r.updated_at),
});

// ── scenario serializers — the JSONB adjustments array round-trips the full discriminated union ──
// WRITE is verbatim (branded Percent/Month erase to number/string at runtime; supabase-js serializes
// the array to JSONB — do NOT JSON.stringify, that double-encodes). READ reconstructs + re-brands:
// the JSONB is hand-editable in Supabase, so treat it as untrusted and fail loud on a bad shape
// rather than feed the engine an un-branded Month or a magnitude missing its kind.
const scenarioToRow = (sc: Scenario): Row => ({
  id: sc.id,
  name: sc.name,
  baseline: sc.baseline,
  adjustments: sc.adjustments, // supabase-js → JSONB; Base/presets never reach here (registry guards)
});

const finiteNum = (v: unknown, field: string): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`SupabaseDataStore: non-finite magnitude.${field} in scenario adjustments`);
  return n;
};
const parseShape = (v: unknown): AdjustmentShape => {
  if (v === "step" || v === "ramp") return v;
  throw new Error(`SupabaseDataStore: unknown shape "${String(v)}" in scenario adjustments`);
};
const parseMagnitude = (m: Record<string, unknown>): Magnitude => {
  switch (m.kind) {
    case "rate": return { kind: "rate", value: percent(finiteNum(m.value, "value")) };
    case "level": return { kind: "level", delta: finiteNum(m.delta, "delta") };
    case "absolute": return { kind: "absolute", value: finiteNum(m.value, "value"), unit: "days" };
    case "categorical": return { kind: "categorical", value: "freeze" };
    default: throw new Error(`SupabaseDataStore: unknown magnitude kind "${String(m.kind)}" in scenario adjustments`);
  }
};

const parseAdjustment = (raw: Record<string, unknown>): Adjustment => {
  const w = (raw.window ?? {}) as Record<string, unknown>;
  const base = {
    id: String(raw.id),
    window: { start: parseMonth(String(w.start)), ...(w.end ? { end: parseMonth(String(w.end)) } : {}) },
    shape: parseShape(raw.shape),
    magnitude: parseMagnitude((raw.magnitude ?? {}) as Record<string, unknown>),
  };
  switch (raw.lever) {
    case "revenue": return { ...base, lever: "revenue", stream: raw.stream as Stream };
    case "personnel": return { ...base, lever: "personnel", ...(raw.departmentId ? { departmentId: raw.departmentId as DepartmentId } : {}) };
    case "expense": return { ...base, lever: "expense", groupId: raw.groupId as ExpenseGroupId };
    case "direct_cost": return { ...base, lever: "direct_cost" };
    case "ar_dso": return { ...base, lever: "ar_dso" };
    case "ap_dpo": return { ...base, lever: "ap_dpo" };
    default: throw new Error(`SupabaseDataStore: unknown lever "${String(raw.lever)}" in scenario adjustments`);
  }
};

const parseBaseline = (v: unknown): ScenarioBaseline => {
  if (v === "base" || v === "budget") return v;
  throw new Error(`SupabaseDataStore: unknown baseline "${String(v)}" in scenario`);
};
const rowToScenario = (r: Row): Scenario => ({
  id: s(r.id) as ScenarioId,
  name: s(r.name),
  baseline: parseBaseline(r.baseline),
  adjustments: ((r.adjustments ?? []) as Record<string, unknown>[]).map(parseAdjustment),
});

export class SupabaseDataStore extends InMemoryDataStore {
  private readonly client: SupabaseClient;
  private readonly cache = new Map<string, readonly unknown[]>();

  constructor(client?: SupabaseClient) {
    super();
    this.client = client ?? makeClient();
  }

  /** Fetch every row of a table (paginating past PostgREST's 1000-row cap), ordered for determinism. */
  private async fetchAll(table: string, orderBy = "id"): Promise<Row[]> {
    const PAGE = 1000;
    const all: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.client.from(table).select("*").order(orderBy, { ascending: true }).range(from, from + PAGE - 1);
      if (error) throw new Error(`SupabaseDataStore: select ${table}: ${error.message}`);
      const rows = (data ?? []) as Row[];
      all.push(...rows);
      if (rows.length < PAGE) break;
    }
    return all;
  }

  /** Lazily fetch + map a whole collection once, then cache (reads are immutable). */
  private async collection<T>(table: string, map: (r: Row) => T, orderBy = "id"): Promise<readonly T[]> {
    const hit = this.cache.get(table);
    if (hit) return hit as readonly T[];
    const mapped = (await this.fetchAll(table, orderBy)).map(map);
    this.cache.set(table, mapped);
    return mapped;
  }

  // ── config / account mapping (overridden: read from Supabase) ──
  override async getFirm(): Promise<FirmProfile> {
    const rows = await this.fetchAll("firm");
    const r = rows[0] ?? {};
    return { id: s(r.id) as FirmId, name: s(r.name), shortCode: s(r.short_code) };
  }
  override async getSettings(): Promise<AppSettings> {
    const { data, error } = await this.client.from("settings").select("*").eq("id", 1).single();
    if (error) throw new Error(`SupabaseDataStore: select settings: ${error.message}`);
    const r = (data ?? {}) as Row;
    return {
      currency: s(r.currency) as AppSettings["currency"],
      fiscalYearStartMonth: num(r.fiscal_year_start_month),
      closeThrough: mo(r.close_through),
      inCloseMonth: optMo(r.in_close_month),
      forecastHorizon: { start: mo(r.forecast_horizon_start), end: mo(r.forecast_horizon_end) },
    };
  }
  override async listDepartments(): Promise<readonly Department[]> {
    return this.collection<Department>("departments", (r) => ({ id: s(r.id) as DepartmentId, name: s(r.name), function: s(r.function) as CostFunction }));
  }
  override async listExpenseGroups(): Promise<readonly ExpenseGroup[]> {
    const groups = await this.collection<ExpenseGroup>("expense_groups", (r) => ({
      id: s(r.id) as ExpenseGroupId, label: s(r.label), classification: s(r.classification) as ExpenseGroup["classification"],
      function: s(r.function) as CostFunction, order: num(r.sort_order),
    }));
    return [...groups].sort((a, b) => a.order - b.order);
  }
  override async listGlAccounts(): Promise<readonly GlAccount[]> {
    return this.collection("gl_accounts", rowToGlAccount, "code");
  }

  // ── layer 1 · source records (overridden: read from Supabase) ──
  override async listPipeline(): Promise<readonly PipelineOpportunity[]> {
    return this.collection("pipeline", rowToPipeline);
  }
  override async listContracts(): Promise<readonly Contract[]> {
    return this.collection("contracts", rowToContract);
  }
  override async getContract(id: string): Promise<Contract | undefined> {
    return (await this.listContracts()).find((c) => c.id === id);
  }
  override async listCustomers(): Promise<readonly Customer[]> {
    return this.collection("customers", rowToCustomer);
  }
  override async getCustomer(id: string): Promise<Customer | undefined> {
    return (await this.listCustomers()).find((c) => c.id === id);
  }
  override async listRenewals(window?: PeriodRange): Promise<readonly Renewal[]> {
    const all = await this.collection("renewals", rowToRenewal);
    if (!window) return all;
    return all.filter((r) => r.dueMonth >= window.start && r.dueMonth <= window.end);
  }
  override async listProjects(): Promise<readonly Project[]> {
    return this.collection("projects", rowToProject);
  }
  override async getProject(id: string): Promise<Project | undefined> {
    return (await this.listProjects()).find((p) => p.id === id);
  }
  override async listStaff(): Promise<readonly StaffMember[]> {
    return this.collection("staff", rowToStaff);
  }
  override async listExpenseTransactions(filter?: ExpenseTransactionFilter): Promise<readonly VendorBill[]> {
    let bills = await this.collection("vendor_bills", rowToVendorBill);
    if (filter?.period) bills = bills.filter((b) => b.period === filter.period);
    if (filter?.groupId) bills = bills.filter((b) => b.groupId === filter.groupId);
    if (filter?.function) bills = bills.filter((b) => b.function === filter.function);
    return bills;
  }
  override async listJournalEntries(period?: Month): Promise<readonly JournalEntry[]> {
    const entries = await this.collection<JournalEntry>("journal_entries", (r) => ({
      id: s(r.id) as JournalEntryId, period: mo(r.period), memo: s(r.memo), docRef: s(r.doc_ref),
      source: s(r.source) as JournalEntry["source"], lines: [] as JournalLine[],
    }));
    // Lines are stored separately; group by entry, preserving the loader's insertion (= generator) order.
    if (!this.cache.has("__je_assembled")) {
      const lineRows = await this.fetchAll("journal_lines", "id");
      const byEntry = new Map<string, JournalLine[]>();
      for (const lr of lineRows) {
        const eid = s(lr.entry_id);
        const line: JournalLine = { glAccountId: s(lr.account_id) as GlAccountId, debit: mny(lr.debit), credit: mny(lr.credit) };
        (byEntry.get(eid) ?? byEntry.set(eid, []).get(eid)!).push(line);
      }
      const assembled = entries.map((e) => ({ ...e, lines: byEntry.get(e.id) ?? [] }));
      this.cache.set("__je_assembled", assembled);
    }
    const full = this.cache.get("__je_assembled") as readonly JournalEntry[];
    return period ? full.filter((e) => e.period === period) : full;
  }

  // ── layer 1 · transaction sub-ledger (overridden: read from Supabase) ──
  override async listTimesheets(filter?: TimesheetFilter): Promise<readonly Timesheet[]> {
    let rows = await this.collection("timesheets", rowToTimesheet);
    if (filter?.period) rows = rows.filter((t) => t.period === filter.period);
    if (filter?.projectId) rows = rows.filter((t) => t.projectId === filter.projectId);
    if (filter?.staffId) rows = rows.filter((t) => t.staffId === filter.staffId);
    return rows;
  }
  override async listPaychecks(filter?: PaycheckFilter): Promise<readonly Paycheck[]> {
    let rows = await this.collection("paychecks", rowToPaycheck);
    if (filter?.period) rows = rows.filter((p) => p.period === filter.period);
    if (filter?.staffId) rows = rows.filter((p) => p.staffId === filter.staffId);
    return rows;
  }
  override async listCustomerInvoices(filter?: CustomerInvoiceFilter): Promise<readonly CustomerInvoice[]> {
    let rows = await this.collection("customer_invoices", rowToInvoice);
    if (filter?.period) rows = rows.filter((iv) => iv.period === filter.period);
    if (filter?.customerId) rows = rows.filter((iv) => iv.customerId === filter.customerId);
    if (filter?.stream) rows = rows.filter((iv) => iv.stream === filter.stream);
    return rows;
  }
  override async listCashReceipts(filter?: CashReceiptFilter): Promise<readonly CashReceipt[]> {
    let rows = await this.collection("cash_receipts", rowToReceipt);
    if (filter?.period) rows = rows.filter((r) => r.period === filter.period);
    if (filter?.customerId) rows = rows.filter((r) => r.customerId === filter.customerId);
    return rows;
  }

  // ── flux notes (the user-WRITE surface) — never cached: they're mutable, so always read fresh ──
  override async listFluxNotes(filter: FluxNoteFilter = {}): Promise<readonly FluxNote[]> {
    let q = this.client.from("flux_notes").select("*").order("created_at", { ascending: true });
    if (filter.transactionId) q = q.eq("transaction_id", filter.transactionId);
    if (filter.accountCode) q = q.eq("account_code", filter.accountCode);
    if (filter.statementLine) q = q.eq("statement_line", filter.statementLine);
    if (filter.period) q = q.eq("period", filter.period);
    const { data, error } = await q;
    if (error) throw new Error(`SupabaseDataStore: select flux_notes: ${error.message}`);
    return (data as Row[]).map(rowToFluxNote);
  }
  override async addFluxNote(note: NewFluxNote): Promise<FluxNote> {
    const row = {
      transaction_id: note.transactionId ?? null,
      account_code: note.accountCode ?? null,
      statement_line: note.statementLine ?? null,
      period: note.period ?? null,
      author: note.author,
      body: note.body,
      amount_at_note: note.amountAtNote ? note.amountAtNote.minor / 100 : null,
      resolved: note.resolved ?? false,
      source: note.source,
    };
    const { data, error } = await this.client.from("flux_notes").insert(row).select("*").single();
    if (error) throw new Error(`SupabaseDataStore: insert flux_notes: ${error.message}`);
    return rowToFluxNote(data as Row);
  }
  override async setFluxNoteResolved(id: string, resolved: boolean): Promise<void> {
    const { error } = await this.client.from("flux_notes").update({ resolved }).eq("id", id);
    if (error) throw new Error(`SupabaseDataStore: update flux_notes: ${error.message}`);
  }
  override async deleteFluxNote(id: string): Promise<void> {
    const { error } = await this.client.from("flux_notes").delete().eq("id", id);
    if (error) throw new Error(`SupabaseDataStore: delete flux_notes: ${error.message}`);
  }

  // ── scenarios (USER scenarios only) — never cached: mutable, so always read fresh ──
  override async listScenarios(): Promise<readonly Scenario[]> {
    const { data, error } = await this.client.from("scenarios").select("*").order("created_at", { ascending: true });
    if (error) throw new Error(`SupabaseDataStore: select scenarios: ${error.message}`);
    return (data as Row[]).map(rowToScenario);
  }
  override async getScenario(id: ScenarioId): Promise<Scenario | undefined> {
    const { data, error } = await this.client.from("scenarios").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`SupabaseDataStore: select scenario: ${error.message}`);
    return data ? rowToScenario(data as Row) : undefined;
  }
  override async upsertScenario(scenario: Scenario): Promise<void> {
    // upsert on the PK (id) → create-or-replace, matching the in-memory Map.set() semantics
    const { error } = await this.client.from("scenarios").upsert(scenarioToRow(scenario));
    if (error) throw new Error(`SupabaseDataStore: upsert scenarios: ${error.message}`);
  }
  override async deleteScenario(id: ScenarioId): Promise<void> {
    const { error } = await this.client.from("scenarios").delete().eq("id", id);
    if (error) throw new Error(`SupabaseDataStore: delete scenarios: ${error.message}`);
  }
}
