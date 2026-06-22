/**
 * Layer 1 — Source records: the atoms Scout points at (CLAUDE.md §5).
 * Shared & immutable; the single scenario branch point (§6, §9).
 */
import type { Money, Percent } from "./money";
import type { Month } from "./period";
import type {
  CustomerId,
  ContractId,
  DealId,
  RenewalId,
  ProjectId,
  StaffId,
  DepartmentId,
  GlAccountId,
  JournalEntryId,
  ExpenseGroupId,
  StatementLineId,
  Stream,
  CostFunction,
  StatementClassification,
  AccountType,
} from "./common";

// ── Sales funnel ────────────────────────────────────────────────────────────

export type PipelineStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export interface PipelineOpportunity {
  readonly id: DealId;
  readonly customerName: string;
  readonly stream: Stream;
  readonly stage: PipelineStage;
  readonly arr: Money;
  readonly owner: string;
  readonly expectedClose: Month;
  readonly probability: Percent;
  /** new logo (a prospect not in the book) vs an expansion opportunity on an existing active account */
  readonly kind: "new_logo" | "expansion";
}

export type ContractStatus = "active" | "pending" | "churned";
export type BookingType = "new" | "expansion" | "contraction";
export type PlanTier = "starter" | "growth" | "scale";

export interface Contract {
  readonly id: ContractId;
  readonly customerId: CustomerId;
  readonly customerName: string;
  readonly stream: Stream;
  readonly planTier?: PlanTier;
  readonly arr: Money;
  readonly startMonth: Month;
  readonly termMonths: number;
  readonly status: ContractStatus;
  readonly bookingType: BookingType;
}

export type CustomerStatus = "active" | "churned";

export interface Customer {
  readonly id: CustomerId;
  readonly name: string;
  readonly segment?: string;
  readonly startMonth: Month;
  readonly status: CustomerStatus;
  /** current run-rate ARR contribution — $0 once churned (the pre-churn peak lives on the contract) */
  readonly arr: Money;
  /** month the logo churned (set only when status === "churned") */
  readonly churnMonth?: Month;
}

export type RenewalStatus = "open" | "renewed" | "expanded" | "contracted" | "churned";

export interface Renewal {
  readonly id: RenewalId;
  readonly contractId: ContractId;
  readonly customerId: CustomerId;
  readonly dueMonth: Month;
  /** ARR at risk going into the renewal (the prior-term ARR) */
  readonly arrUpForRenewal: Money;
  /** ARR after the renewal resolves: flat (renewed), up (expanded), down (contracted), $0 (churned);
   *  undefined while the renewal is still open */
  readonly newArr?: Money;
  readonly status: RenewalStatus;
}

// ── Reporting (delivery + people + GL) ───────────────────────────────────────

export type ProjectStatus = "not_started" | "in_progress" | "complete" | "on_hold";

export interface Project {
  readonly id: ProjectId;
  readonly name: string;
  readonly customerId: CustomerId;
  readonly status: ProjectStatus;
  readonly pctComplete: Percent;
  readonly contractValue: Money;
  /** unbilled / work-in-progress (contract asset) */
  readonly wip: Money;
  readonly marginPct: Percent;
}

export interface StaffMember {
  readonly id: StaffId;
  readonly name: string;
  readonly departmentId: DepartmentId;
  readonly function: CostFunction;
  readonly title: string;
  readonly startMonth: Month;
  readonly endMonth?: Month;
  readonly fte: number;
  /** annual base compensation (burden lives in the Employee Expenses OpEx group — §8) */
  readonly baseComp: Money;
}

export interface ExpenseTransaction {
  readonly id: JournalEntryId;
  readonly period: Month;
  readonly glAccountId: GlAccountId;
  readonly groupId: ExpenseGroupId;
  readonly function: CostFunction;
  readonly vendor?: string;
  readonly memo?: string;
  readonly amount: Money;
}

export interface GlAccount {
  readonly id: GlAccountId;
  readonly code: string;
  readonly name: string;
  /** account nature → normal balance + statement section (§12 GL) */
  readonly accountType: AccountType;
  /** CoR vs OpEx — only on expense accounts (the Account Mapping classification, §7) */
  readonly classification?: StatementClassification;
  readonly function?: CostFunction;
  /** the Account Mapping seam: GL account → statement line (§7) */
  readonly statementLineId: StatementLineId;
}

export type JournalSource = "ap_bill" | "payroll" | "invoice" | "prepaid_amort" | "depreciation" | "manual";

export interface JournalLine {
  readonly glAccountId: GlAccountId;
  readonly debit: Money;
  readonly credit: Money;
}

export interface JournalEntry {
  readonly id: JournalEntryId;
  readonly period: Month;
  readonly memo: string;
  readonly docRef: string;
  readonly source: JournalSource;
  readonly lines: readonly JournalLine[];
}
