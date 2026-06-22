/**
 * LOCKED structural config (CLAUDE.md §11/§8): firm identity, period/close boundary, the seed
 * departments + function tags, and the 8 OpEx groups. Read by the seed (`lib/seed`) and the
 * statement assemblers. The financial NUMBERS now come from the seed (step 6) — the former
 * `PLACEHOLDER_TARGET` financials stub is retired along with `lib/target/model.ts`.
 */
import { month } from "@/lib/types/period";
import type { AppSettings, FirmProfile } from "@/lib/datastore/datastore";
import type { Department, ExpenseGroup, DepartmentId, ExpenseGroupId } from "@/lib/types/common";

const dept = (id: string): DepartmentId => id as DepartmentId;
const grp = (id: string): ExpenseGroupId => id as ExpenseGroupId;

// ── LOCKED firm identity (CLAUDE.md §11; chip per nav-rail-expanded.svg) ──
export const PLACEHOLDER_FIRM: FirmProfile = {
  id: "bearing" as FirmProfile["id"],
  name: "Bearing",
  shortCode: "BR",
};

/** The period label shown on the company chip. */
export const PLACEHOLDER_PERIOD_LABEL = "FY26 · Jun";

/**
 * Period config. Boundary follows §11 (calendar FY; through May 2026 closed, June 2026
 * in close, Jul–Dec 2026 forecast). ⚠️ The PRECISE close state is a pending seed
 * parameter (§17) — confirm before generating the seed.
 */
export const PLACEHOLDER_SETTINGS: AppSettings = {
  currency: "USD",
  fiscalYearStartMonth: 1,
  closeThrough: month(2026, 5),
  inCloseMonth: month(2026, 6),
  forecastHorizon: { start: month(2026, 7), end: month(2026, 12) },
};

// ── LOCKED seed departments + function tags (CLAUDE.md §8; editable in Settings) ──
export const SEED_DEPARTMENTS: readonly Department[] = [
  { id: dept("professional-services"), name: "Professional Services", function: "direct" },
  { id: dept("support"), name: "Support", function: "direct" },
  { id: dept("engineering"), name: "Engineering", function: "rnd" },
  { id: dept("product-design"), name: "Product & Design", function: "rnd" },
  { id: dept("sales"), name: "Sales", function: "sm" },
  { id: dept("marketing"), name: "Marketing", function: "sm" },
  { id: dept("customer-success"), name: "Customer Success", function: "sm" },
  { id: dept("finance"), name: "Finance", function: "ga" },
  { id: dept("people"), name: "People", function: "ga" },
  { id: dept("ops"), name: "Ops", function: "ga" },
];

// ── LOCKED seed OpEx groups (CLAUDE.md §7/§8; config-driven via Account Mapping) ──
// Cost of Revenue is NOT here — it is assembled, not an expense group (§8).
export const SEED_EXPENSE_GROUPS: readonly ExpenseGroup[] = [
  { id: grp("employee-expenses"), label: "Employee Expenses", classification: "operating_expense", function: "ga", order: 1 },
  { id: grp("sales-marketing"), label: "Sales & Marketing", classification: "operating_expense", function: "sm", order: 2 },
  { id: grp("travel-entertainment"), label: "Travel & Entertainment", classification: "operating_expense", function: "ga", order: 3 },
  { id: grp("it"), label: "IT", classification: "operating_expense", function: "ga", order: 4 },
  { id: grp("hr"), label: "HR", classification: "operating_expense", function: "ga", order: 5 },
  { id: grp("admin"), label: "Admin", classification: "operating_expense", function: "ga", order: 6 },
  { id: grp("facilities"), label: "Facilities", classification: "operating_expense", function: "ga", order: 7 },
  { id: grp("insurance"), label: "Insurance", classification: "operating_expense", function: "ga", order: 8 },
];

