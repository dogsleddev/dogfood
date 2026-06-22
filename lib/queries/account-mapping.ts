/** Setup · Account Mapping — the account→statement-line map (CLAUDE.md §7). Load-bearing:
 *  read by the statement engine and every drill-down. Reads the GL chart of accounts through
 *  the DataStore seam (step 6b). */
import type { GlAccount } from "@/lib/types/source";
import type { ExpenseGroup, ExpenseGroupId } from "@/lib/types/common";
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
