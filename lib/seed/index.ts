/**
 * The seed generator (CLAUDE.md §12). Steps 1–4 of: drivers → … → statements.
 *   1 subscription (606 + deferred) · 2 services (% complete + WIP) · 3 personnel + CoR ·
 *   4 non-payroll OpEx (8 groups).
 * DAG: personnel → services capacity → services; CoR = direct payroll + rate × revenue;
 * OpEx = payroll burden / revenue % / per-head. Later steps (5: balance sheet + cash flow;
 * 6: JEs → GL + wire the live queries to the generated records) extend this.
 */
import { generateSubscriptionSeed, type SubscriptionSeed } from "./subscription";
import { generateServicesSeed, type ServicesSeed } from "./services";
import { generatePersonnelSeed, type PersonnelSeed } from "./personnel";
import { assembleCostOfRevenue, type CostOfRevenueSeed } from "./cost-of-revenue";
import { generateOpExSeed, type OpExSeed } from "./opex";
import { assembleBalanceSheet, type BalanceSheetSeed } from "./balance-sheet";
import { generateSbcSeed, type SbcSeed } from "./sbc";
import { generateLeaseSeed, type LeaseSeed } from "./leases";
import { generatePipelineSeed, type PipelineSeed } from "./pipeline";
import { generateRenewalsSeed, type RenewalsSeed } from "./renewals";

export * from "./subscription";
export * from "./services";
export * from "./personnel";
export * from "./cost-of-revenue";
export * from "./opex";
export * from "./balance-sheet";
export * from "./sbc";
export * from "./leases";
export * from "./pipeline";
export * from "./renewals";

let cachedSubscription: SubscriptionSeed | undefined;
let cachedServices: ServicesSeed | undefined;
let cachedPersonnel: PersonnelSeed | undefined;
let cachedCoR: CostOfRevenueSeed | undefined;
let cachedOpEx: OpExSeed | undefined;
let cachedBalanceSheet: BalanceSheetSeed | undefined;
let cachedSbc: SbcSeed | undefined;
let cachedLease: LeaseSeed | undefined;
let cachedPipeline: PipelineSeed | undefined;
let cachedRenewals: RenewalsSeed | undefined;

/** Memoized so a render doesn't re-run the simulations (they are deterministic). */
export function getSubscriptionSeed(): SubscriptionSeed {
  if (!cachedSubscription) cachedSubscription = generateSubscriptionSeed();
  return cachedSubscription;
}

export function getPersonnelSeed(): PersonnelSeed {
  if (!cachedPersonnel) cachedPersonnel = generatePersonnelSeed();
  return cachedPersonnel;
}

/** Step 2 — services, gated by the personnel step's PS-headcount-derived capacity. */
export function getServicesSeed(): ServicesSeed {
  if (!cachedServices) {
    cachedServices = generateServicesSeed(getSubscriptionSeed().acquisitions, getPersonnelSeed().series.servicesCapacity);
  }
  return cachedServices;
}

/** Step 3 — Cost of Revenue assembled from direct payroll + rate × revenue per stream. */
export function getCostOfRevenueSeed(): CostOfRevenueSeed {
  if (!cachedCoR) {
    cachedCoR = assembleCostOfRevenue(
      getSubscriptionSeed().series.recognized,
      getServicesSeed().series.recognized,
      getPersonnelSeed().series.directPayroll,
    );
  }
  return cachedCoR;
}

/** Step 4 — non-payroll OpEx (the 8 groups), driven by payroll / revenue / headcount. */
export function getOpExSeed(): OpExSeed {
  if (!cachedOpEx) {
    const per = getPersonnelSeed();
    cachedOpEx = generateOpExSeed(per.series.totalPayroll, per.series.totalHeadcount, getCostOfRevenueSeed().series.totalRevenue);
  }
  return cachedOpEx;
}

/** Step 5a — stock-based compensation (ASC 718), derived from the staff records (no new RNG). */
export function getSbcSeed(): SbcSeed {
  if (!cachedSbc) cachedSbc = generateSbcSeed(getPersonnelSeed().staff);
  return cachedSbc;
}

/** Step 5b — operating leases (ASC 842), derived from the headcount series (no new RNG). */
export function getLeaseSeed(): LeaseSeed {
  if (!cachedLease) cachedLease = generateLeaseSeed(getPersonnelSeed().series.totalHeadcount);
  return cachedLease;
}

/** Sales texture — open pipeline (forward funnel; net-new, moves no tie-out). */
export function getPipelineSeed(): PipelineSeed {
  if (!cachedPipeline) cachedPipeline = generatePipelineSeed(getSubscriptionSeed().customers);
  return cachedPipeline;
}

/** Sales texture — the renewal worklist, derived from the subscription contracts (moves no tie-out). */
export function getRenewalsSeed(): RenewalsSeed {
  if (!cachedRenewals) cachedRenewals = generateRenewalsSeed(getSubscriptionSeed().contracts);
  return cachedRenewals;
}

/** Step 5 — balance sheet + cash flow, assembled from all the drivers; ties out by construction. */
export function getBalanceSheetSeed(): BalanceSheetSeed {
  if (!cachedBalanceSheet) {
    const sub = getSubscriptionSeed();
    const svc = getServicesSeed();
    const per = getPersonnelSeed();
    const cor = getCostOfRevenueSeed();
    const opx = getOpExSeed();
    cachedBalanceSheet = assembleBalanceSheet({
      subBillings: sub.series.billings,
      subRecognized: sub.series.recognized,
      subDeferred: sub.series.deferred,
      subOpeningDeferred: sub.openingDeferred,
      svcBilled: svc.series.billed,
      svcWip: svc.series.wip,
      grossProfit: cor.series.grossProfit,
      indirectPayroll: per.series.indirectPayroll,
      nonEmployeeCoR: cor.series.nonEmployee,
      nonPayrollOpEx: opx.series.total,
      totalHeadcount: per.series.totalHeadcount,
      sbc: getSbcSeed().series.monthly,
      rouAsset: getLeaseSeed().series.rouAsset,
      leaseLiability: getLeaseSeed().series.leaseLiability,
      leaseOpening: getLeaseSeed().opening,
    });
  }
  return cachedBalanceSheet;
}
