/**
 * Sub-ledger transaction detail (CLAUDE.md §5 layer 1 / §16 — the synthetic ERP actuals
 * Dogfood reads). Each stream is an individual-transaction explosion of a monthly driver:
 * Σ(transactions in a month) === the driver for that month, so the GL/statements (built from
 * the drivers) are unchanged and every existing tie-out holds. Vendor bills reuse the existing
 * `ExpenseTransaction` type (lib/types/source.ts).
 */
import type { Money } from "./money";
import type { Month } from "./period";
import type { CustomerId, ContractId, ProjectId, StaffId } from "./common";
import type { ExpenseTransaction } from "./source";

export type CustomerInvoiceKind = "new_term" | "increment" | "refund" | "services_progress" | "opening_balance";

/** Whether a billed/payable document has been settled as of the close boundary. */
export type DocStatus = "open" | "paid";

/** A full calendar date, canonical form "YYYY-MM-DD" (e.g. "2026-06-14"). Always falls
 *  inside the transaction's `period` month, so no monthly roll-up moves. */
export type IsoDate = string;

export interface CustomerInvoice {
  readonly id: string;
  /** human document number, e.g. "INV-2026-0473" */
  readonly docNumber: string;
  readonly customerId: CustomerId;
  readonly contractId?: ContractId;
  readonly projectId?: ProjectId;
  readonly period: Month;
  /** invoice date (within `period`) — the contract anniversary day for subscription */
  readonly date: IsoDate;
  /** net-30 payment due date */
  readonly dueDate: IsoDate;
  /** open vs paid as of the close boundary (driven by whether the receipt has cleared) */
  readonly status: DocStatus;
  readonly stream: "subscription" | "services";
  readonly kind: CustomerInvoiceKind;
  readonly amount: Money;
}

export interface CashReceipt {
  readonly id: string;
  /** human document number, e.g. "RC-2026-0118" */
  readonly docNumber: string;
  readonly customerId: CustomerId;
  readonly period: Month;
  /** receipt date (within `period`), DSO-lagged off the applied invoice */
  readonly date: IsoDate;
  /** the (oldest open) invoice this receipt is applied against (true FIFO) */
  readonly appliedInvoiceId?: string;
  /** the human doc number of the applied invoice (for AR-aging views) */
  readonly appliedDocNumber?: string;
  readonly amount: Money;
}

export interface Paycheck {
  readonly id: string;
  /** human document number, e.g. "PAY-2026-1042" */
  readonly docNumber: string;
  readonly staffId: StaffId;
  readonly period: Month;
  readonly periodLabel: string;
  /** pay date (within `period`) — the 15th and the last day of the month */
  readonly date: IsoDate;
  readonly grossPay: Money;
  readonly employeeTaxes: Money;
  readonly benefits: Money;
  readonly netPay: Money;
}

export interface Timesheet {
  readonly id: string;
  /** human document number, e.g. "TS-2026-04122" */
  readonly docNumber: string;
  readonly staffId: StaffId;
  readonly projectId: ProjectId;
  readonly period: Month;
  /** week-ending date (within `period`) */
  readonly date: IsoDate;
  readonly weekLabel: string;
  readonly hours: number;
  readonly billRate: Money;
  readonly costRate: Money;
  /** hours × bill rate — drives recognized services revenue → WIP */
  readonly billableValue: Money;
  /** hours × (fully-loaded) cost rate — the job-costing cost side */
  readonly laborCost: Money;
}

/**
 * A vendor bill (AP sub-ledger). Widens the shared `ExpenseTransaction` (lib/types/source.ts)
 * with the document fields a finance-literate AP-aging/register view expects. It stays
 * assignable to `ExpenseTransaction`, so the statement engine and `listExpenseTransactions`
 * read it unchanged. Date/dueDate/status always fall within `period`, so no monthly total moves.
 */
export interface VendorBill extends ExpenseTransaction {
  /** human document number, e.g. "BILL-2026-0731" */
  readonly docNumber: string;
  /** bill date (within `period`) */
  readonly date: IsoDate;
  /** net-30 payment due date */
  readonly dueDate: IsoDate;
  /** open vs paid as of the close boundary (paid once the due date has passed the close) */
  readonly status: DocStatus;
}

/** Per-project job-cost roll-up from the timesheets (revenue, labor cost, margin). */
export interface ProjectJobCost {
  readonly projectId: ProjectId;
  readonly revenue: Money;
  readonly laborCost: Money;
  readonly marginPct: number;
  readonly hours: number;
}
