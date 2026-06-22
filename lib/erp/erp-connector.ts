/**
 * ErpConnector — THE one and only live integration (CLAUDE.md §4, §16).
 * Everything else is CSV/XLSX import templates or seed; no other live connectors.
 * Dogfood READS actuals from the ERP (plan-to-perform, downstream of a clean close).
 *
 * This is a stub: it defines the seam and throws until a real connector is wired.
 * It sits alongside the DataStore (actuals flow ERP → DataStore → lib/queries).
 */
import type { Month } from "@/lib/types/period";
import type { GlAccount, JournalEntry } from "@/lib/types/source";
import type { Money } from "@/lib/types/money";

export type ErpConnectionStatus = "disconnected" | "connected" | "error";

export interface TrialBalanceRow {
  readonly glAccountId: string;
  readonly period: Month;
  readonly debit: Money;
  readonly credit: Money;
}

export interface CloseStatus {
  readonly period: Month;
  readonly state: "open" | "in_close" | "closed";
}

export interface ErpConnector {
  status(): Promise<ErpConnectionStatus>;
  testConnection(): Promise<boolean>;
  pullChartOfAccounts(): Promise<readonly GlAccount[]>;
  pullTrialBalance(period: Month): Promise<readonly TrialBalanceRow[]>;
  pullJournalEntries(period: Month): Promise<readonly JournalEntry[]>;
  getCloseStatus(period: Month): Promise<CloseStatus>;
}

const NOT_WIRED = "ErpConnector is a stub — no live ERP is wired yet (Harness Phase 0).";

/** The default stub. Reports disconnected and throws on any data pull. */
export class StubErpConnector implements ErpConnector {
  async status(): Promise<ErpConnectionStatus> {
    return "disconnected";
  }
  async testConnection(): Promise<boolean> {
    return false;
  }
  async pullChartOfAccounts(): Promise<readonly GlAccount[]> {
    throw new Error(NOT_WIRED);
  }
  async pullTrialBalance(_period: Month): Promise<readonly TrialBalanceRow[]> {
    throw new Error(NOT_WIRED);
  }
  async pullJournalEntries(_period: Month): Promise<readonly JournalEntry[]> {
    throw new Error(NOT_WIRED);
  }
  async getCloseStatus(_period: Month): Promise<CloseStatus> {
    throw new Error(NOT_WIRED);
  }
}

let connector: ErpConnector | undefined;

export function getErpConnector(): ErpConnector {
  if (!connector) connector = new StubErpConnector();
  return connector;
}
