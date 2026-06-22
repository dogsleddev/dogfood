/**
 * The canonical IA (CLAUDE.md §7 + diagrams/nav-rail-expanded.svg), resting state.
 * Rule: GROUPS = co-equal top-level surfaces; DROPDOWNS = variants of one surface.
 * This typed tree is the single source the sidebar renders from.
 *
 * (nav-rail-v16.svg is stale — Beacon Devices, Scout-at-top, standalone Bookings, no
 * Cost of Revenue, 3 Scenarios items. CLAUDE.md §7 wins; built from there.)
 */
import { SEED_EXPENSE_GROUPS } from "@/lib/target/placeholder";

export type IconName = string;

export interface NavLeaf {
  readonly kind: "leaf";
  readonly label: string;
  readonly href: string;
  readonly icon?: IconName;
}

export interface NavParent {
  readonly kind: "parent";
  readonly label: string;
  readonly icon: IconName;
  /** path prefix used to auto-expand the parent when a child route is active */
  readonly basePath: string;
  readonly children: readonly NavLeaf[];
  /** dropdown contents sourced from config (Account Mapping), not hardcoded (§7) */
  readonly configDriven?: boolean;
}

export type NavEntry = NavLeaf | NavParent;

export interface NavSubGroup {
  readonly label: string;
  readonly items: readonly NavEntry[];
}

export interface NavGroup {
  readonly label: string;
  readonly items?: readonly NavEntry[];
  readonly subGroups?: readonly NavSubGroup[];
  /** dashed break separating planning surfaces from config (§19) */
  readonly dividerAfter?: boolean;
}

const leaf = (label: string, href: string, icon?: IconName): NavLeaf => ({ kind: "leaf", label, href, icon });

// Expense Forecast children are config-driven from the live OpEx group set (§7).
const expenseChildren: readonly NavLeaf[] = SEED_EXPENSE_GROUPS.map((g) =>
  leaf(g.label, `/forecasts/expenses/${g.id}`),
);

// The seven user guides (§14 + the Flux Analysis guide).
const guideChildren: readonly NavLeaf[] = [
  leaf("Getting started", "/setup/guides/getting-started"),
  leaf("Budgets & forecasts", "/setup/guides/budgets-and-forecasts"),
  leaf("Updating actuals", "/setup/guides/updating-actuals"),
  leaf("Creating scenarios", "/setup/guides/creating-scenarios"),
  leaf("Reading the statements", "/setup/guides/reading-the-statements"),
  leaf("Creating a flux analysis", "/setup/guides/creating-a-flux-analysis"),
  leaf("Asking Scout", "/setup/guides/asking-scout"),
];

export const NAV: readonly NavGroup[] = [
  {
    label: "Overview",
    items: [
      leaf("Dashboard", "/dashboard", "LayoutDashboard"),
      leaf("Board Package", "/board-package", "ClipboardList"),
    ],
  },
  {
    label: "Financial Statements",
    items: [
      leaf("Forecasted P&L", "/statements/pnl", "FileText"),
      leaf("Balance Sheet", "/statements/balance-sheet", "Scale"),
      leaf("Cash Flow Forecast", "/statements/cash-flow", "Banknote"),
    ],
  },
  {
    label: "Reporting",
    items: [
      leaf("Projects", "/reporting/projects", "FolderKanban"),
      leaf("Staff", "/reporting/staff", "Users"),
      leaf("Expense Transactions", "/reporting/expense-transactions", "Receipt"),
    ],
  },
  {
    label: "Sales",
    items: [
      leaf("Pipeline", "/sales/pipeline", "Filter"),
      leaf("Contracts", "/sales/contracts", "FileSignature"),
      leaf("Customers", "/sales/customers", "Building2"),
      leaf("Renewals", "/sales/renewals", "RefreshCw"),
    ],
  },
  {
    label: "Forecasts",
    subGroups: [
      {
        label: "P&L drivers",
        items: [
          leaf("Revenue Forecast", "/forecasts/revenue", "TrendingUp"),
          leaf("Cost of Revenue", "/forecasts/cost-of-revenue", "Coins"),
          leaf("Personnel", "/forecasts/personnel", "UsersRound"),
          {
            kind: "parent",
            label: "Expense Forecast",
            icon: "Wallet",
            basePath: "/forecasts/expenses",
            configDriven: true,
            children: expenseChildren,
          },
        ],
      },
      {
        label: "Balance sheet drivers",
        items: [
          leaf("AR Forecast", "/forecasts/ar", "Clock"),
          leaf("Fixed Asset Budget", "/forecasts/fixed-assets", "Boxes"),
          leaf("Prepaids Budget", "/forecasts/prepaids", "CalendarClock"),
        ],
      },
    ],
  },
  {
    label: "Scenarios",
    items: [
      leaf("Scenario Manager", "/scenarios/manager", "GitBranch"),
      leaf("Scenario Drivers", "/scenarios/drivers", "SlidersHorizontal"),
      leaf("Scenario P&L", "/scenarios/pnl", "GitCompareArrows"),
      leaf("Scenario Dashboard", "/scenarios/dashboard", "LayoutGrid"),
    ],
    dividerAfter: true,
  },
  {
    label: "Setup",
    items: [
      leaf("Account Mapping", "/setup/account-mapping", "Map"),
      leaf("Settings", "/setup/settings", "Settings"),
      {
        kind: "parent",
        label: "User Guides",
        icon: "BookOpen",
        basePath: "/setup/guides",
        children: guideChildren,
      },
    ],
  },
];
