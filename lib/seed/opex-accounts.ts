/**
 * OpEx sub-account taxonomy — the GL "sub-account" dimension UNDER each of the 8 non-payroll OpEx
 * groups (§7/§8). This is a CONFIG layer, NOT new GlAccounts: CHART_OF_ACCOUNTS (lib/seed/gl.ts) keeps
 * exactly ONE real account per OpEx group (6100..6800), so the statement engine, the GL plSeries
 * tie-out, acctForLine, getFluxDetail, and the data-sweep Account-Mapping totality check are all
 * UNCHANGED. The `subCode` (6210/6220…) is a display string; it never enters CHART_OF_ACCOUNTS.
 *
 * Two tie-out-neutral splits sit under the unchanged group monthly total:
 *   group -> account : a fixed `share` vector per group (Σ shares === 1.0, asserted below); the seed
 *                      (opex.ts) splits group.monthly[i] by share, last sub-account absorbs the residual.
 *   account -> vendor: the existing transactions.ts anchor-share + rotating-remainder + renormalize
 *                      mechanism, now invoked PER SUB-ACCOUNT. `anchors` carry a within-account weight
 *                      (cosmetic — emit() renormalizes every bucket to its driver total); `rotating`
 *                      fill the remainder. This file is the single source for the vendor pools (the old
 *                      per-group VENDOR_POOLS for OpEx is derived from it via opexGroupPool()).
 *
 * Taxonomy + vendor placement vetted by a Series-B-CFO realism pass (2026-06-22): Employee-Expenses is
 * Medical-led (not PEO-led); Admin is Legal-led; Sales-Intel holds G2; Ground&Meals holds DoorDash;
 * IT Eng-tools holds Atlassian; Facilities is coworking-dominated (utilities incidental); Insurance D&O
 * near-co-equal with E&O.
 */
import type { ExpenseGroupId } from "@/lib/types/common";

export interface OpExSubAccount {
  /** stable slug id (used in URLs / the ?account= param) */
  readonly id: string;
  readonly groupId: ExpenseGroupId;
  readonly label: string;
  /** display GL code (NOT a CHART_OF_ACCOUNTS code) — e.g. "6210" */
  readonly subCode: string;
  /** fixed fraction of the GROUP monthly total; Σ per group === 1.0 (asserted at load) */
  readonly share: number;
  /** recurring vendors with a within-account weight (cosmetic; renormalized by emit) */
  readonly anchors: readonly (readonly [string, number])[];
  /** variable vendors that fill the remainder (forecast rolls them into one "Other —" line) */
  readonly rotating: readonly string[];
}

const g = (id: string): ExpenseGroupId => id as ExpenseGroupId;

export const OPEX_SUB_ACCOUNTS: Record<string, readonly OpExSubAccount[]> = {
  "employee-expenses": [
    { id: "ee-medical", groupId: g("employee-expenses"), label: "Medical & Health Benefits", subCode: "6130", share: 0.42, anchors: [["Anthem Health", 1.0]], rotating: [] },
    { id: "ee-payroll-taxes", groupId: g("employee-expenses"), label: "Payroll Taxes (employer)", subCode: "6110", share: 0.34, anchors: [["IRS — payroll taxes", 1.0]], rotating: [] },
    { id: "ee-retirement", groupId: g("employee-expenses"), label: "Retirement (401k Match)", subCode: "6140", share: 0.16, anchors: [["Guideline 401(k)", 1.0]], rotating: [] },
    { id: "ee-payroll-peo", groupId: g("employee-expenses"), label: "Payroll & PEO Services", subCode: "6120", share: 0.08, anchors: [["Rippling", 1.0]], rotating: [] },
  ],
  "sales-marketing": [
    { id: "sm-paid-advertising", groupId: g("sales-marketing"), label: "Paid Advertising", subCode: "6210", share: 0.4, anchors: [["Google Ads", 0.57], ["LinkedIn Ads", 0.43]], rotating: [] },
    { id: "sm-marketing-crm", groupId: g("sales-marketing"), label: "Marketing & CRM Software", subCode: "6220", share: 0.28, anchors: [["HubSpot", 0.55]], rotating: ["Salesforce", "Webflow"] },
    { id: "sm-sales-intel", groupId: g("sales-marketing"), label: "Sales Intelligence & Enablement", subCode: "6230", share: 0.22, anchors: [], rotating: ["Apollo.io", "Clearbit", "Gong", "ZoomInfo", "G2"] },
    { id: "sm-events-field", groupId: g("sales-marketing"), label: "Events & Field Marketing", subCode: "6240", share: 0.1, anchors: [], rotating: ["Goldcast", "Sponsorships & Events"] },
  ],
  "travel-entertainment": [
    { id: "te-card-mixed", groupId: g("travel-entertainment"), label: "Corporate Card / Mixed T&E", subCode: "6310", share: 0.34, anchors: [["Amex T&E", 1.0]], rotating: [] },
    { id: "te-airfare", groupId: g("travel-entertainment"), label: "Airfare", subCode: "6320", share: 0.3, anchors: [], rotating: ["United Airlines", "Delta Air Lines"] },
    { id: "te-lodging", groupId: g("travel-entertainment"), label: "Lodging", subCode: "6330", share: 0.22, anchors: [], rotating: ["Marriott", "Hilton", "Airbnb"] },
    { id: "te-ground-meals", groupId: g("travel-entertainment"), label: "Ground & Meals", subCode: "6340", share: 0.14, anchors: [], rotating: ["Uber", "Lyft", "DoorDash"] },
  ],
  it: [
    { id: "it-eng-devops", groupId: g("it"), label: "Engineering & DevOps Tools", subCode: "6410", share: 0.4, anchors: [["GitHub", 0.4], ["Vercel", 0.3], ["Atlassian", 0.3]], rotating: ["Linear", "Cursor", "Retool"] },
    { id: "it-productivity", groupId: g("it"), label: "Productivity & Collaboration", subCode: "6420", share: 0.3, anchors: [["Notion", 0.35], ["Figma", 0.33], ["Slack", 0.32]], rotating: ["Zoom"] },
    { id: "it-identity-security", groupId: g("it"), label: "Identity & Security", subCode: "6430", share: 0.18, anchors: [["Okta", 0.8]], rotating: ["1Password"] },
    { id: "it-observability", groupId: g("it"), label: "Observability & Monitoring", subCode: "6440", share: 0.12, anchors: [["Datadog", 0.8]], rotating: ["Sentry"] },
  ],
  hr: [
    { id: "hr-recruiting-ats", groupId: g("hr"), label: "Recruiting & ATS", subCode: "6510", share: 0.55, anchors: [["Greenhouse", 0.75]], rotating: ["Ashby"] },
    { id: "hr-people-ops", groupId: g("hr"), label: "Performance & People Ops", subCode: "6520", share: 0.3, anchors: [["Lattice", 1.0]], rotating: [] },
    { id: "hr-global-eor", groupId: g("hr"), label: "Global Payroll & EOR", subCode: "6530", share: 0.15, anchors: [], rotating: ["Deel"] },
  ],
  admin: [
    { id: "admin-legal", groupId: g("admin"), label: "Legal & Corporate", subCode: "6610", share: 0.42, anchors: [["Cooley LLP", 0.8]], rotating: ["DocuSign"] },
    { id: "admin-equity", groupId: g("admin"), label: "Equity Administration", subCode: "6630", share: 0.22, anchors: [["Carta", 1.0]], rotating: [] },
    { id: "admin-spend-banking", groupId: g("admin"), label: "Spend Management & Banking", subCode: "6620", share: 0.18, anchors: [["Ramp", 0.5], ["Mercury", 0.4]], rotating: ["Brex"] },
    { id: "admin-accounting", groupId: g("admin"), label: "Accounting & Other Services", subCode: "6640", share: 0.18, anchors: [], rotating: ["Bench Accounting"] },
  ],
  facilities: [
    { id: "fac-office-lease", groupId: g("facilities"), label: "Office Lease & Coworking", subCode: "6710", share: 0.82, anchors: [["WeWork", 0.85]], rotating: ["Industrious"] },
    { id: "fac-storage-logistics", groupId: g("facilities"), label: "Storage & Logistics", subCode: "6730", share: 0.1, anchors: [], rotating: ["Iron Mountain", "Flexport (office)"] },
    { id: "fac-utilities", groupId: g("facilities"), label: "Utilities", subCode: "6720", share: 0.08, anchors: [["PG&E", 1.0]], rotating: [] },
  ],
  insurance: [
    { id: "ins-eo", groupId: g("insurance"), label: "Business & Tech E&O", subCode: "6810", share: 0.42, anchors: [["Vouch Insurance", 0.8]], rotating: ["The Hartford"] },
    { id: "ins-do", groupId: g("insurance"), label: "Management Liability (D&O)", subCode: "6820", share: 0.4, anchors: [["Embroker", 1.0]], rotating: [] },
    { id: "ins-property-other", groupId: g("insurance"), label: "Property & Other Lines", subCode: "6830", share: 0.18, anchors: [], rotating: ["Chubb"] },
  ],
};

// Load-time invariant: shares per group sum to EXACTLY 1.0 (the only hard numeric constraint — the
// group->account split is otherwise tie-out-neutral). Fail LOUD at import so a mis-typed share vector
// can never silently mis-total the forecast. Also guard every share > 0 and unique subCodes.
const seenSubCodes = new Set<string>();
for (const [groupId, leaves] of Object.entries(OPEX_SUB_ACCOUNTS)) {
  const sum = leaves.reduce((s, l) => s + l.share, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`OPEX_SUB_ACCOUNTS["${groupId}"] shares sum to ${sum}, expected 1.0`);
  }
  for (const l of leaves) {
    if (l.share <= 0) throw new Error(`OPEX_SUB_ACCOUNTS["${groupId}"].${l.id} has non-positive share ${l.share}`);
    if (seenSubCodes.has(l.subCode)) throw new Error(`duplicate OpEx subCode ${l.subCode}`);
    seenSubCodes.add(l.subCode);
  }
}

/** Lookup a group's ordered sub-accounts (empty for non-vendor-bill groups). */
export const opexSubAccounts = (groupId: string): readonly OpExSubAccount[] => OPEX_SUB_ACCOUNTS[groupId] ?? [];

/** Resolve a sub-account by its slug id (across all groups). */
export const opexSubAccountById = (id: string): OpExSubAccount | undefined => {
  for (const leaves of Object.values(OPEX_SUB_ACCOUNTS)) {
    const found = leaves.find((l) => l.id === id);
    if (found) return found;
  }
  return undefined;
};

/** Resolve a sub-account by its display subCode (e.g. "6210") — used to label real closed-month bills. */
export const opexSubAccountByCode = (subCode: string): OpExSubAccount | undefined => {
  for (const leaves of Object.values(OPEX_SUB_ACCOUNTS)) {
    const found = leaves.find((l) => l.subCode === subCode);
    if (found) return found;
  }
  return undefined;
};

/**
 * Derive the old per-GROUP vendor pool (anchors + rotating) from the sub-account taxonomy, so the
 * sub-ledger has ONE source of truth for which vendors bill a group. Anchor weights are scaled by the
 * sub-account's share so a group-level pool (if ever needed) stays proportional; emit() renormalizes
 * anyway, so the absolute weights are cosmetic.
 */
export function opexGroupPool(groupId: string): { anchors: readonly (readonly [string, number])[]; rotating: readonly string[] } {
  const leaves = opexSubAccounts(groupId);
  const anchors: (readonly [string, number])[] = [];
  const rotating: string[] = [];
  for (const l of leaves) {
    for (const [v, w] of l.anchors) anchors.push([v, w * l.share]);
    rotating.push(...l.rotating);
  }
  return { anchors, rotating };
}
