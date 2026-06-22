/**
 * Subscription seed — step 1 of the §12 generator (drivers → … → statements).
 * A deterministic cohort simulation: new logos, expansions, churn (with the Q3-2024 spike),
 * and the Jan-2026 price increase, driving 606 ratable recognition + the deferred waterfall.
 *
 * Tie-out: cumulative net bookings (ΔARR) === current ARR is the load-bearing INDEPENDENT
 * check; revenue is recognized ratably (= ARR ÷ 12).
 *
 * DEFERRED = a true billings roll-forward (step 5): each customer bills their annual ARR upfront
 * at every anniversary while active; a mid-term expansion / the Jan-2026 price increase bills the
 * incremental ARR prorated over the remaining months of the current term; churn refunds the unused
 * prepaid (a first-pass simplification — keeps deferred a clean roll-forward and preserves the
 * calibrated recognized series). deferred[t] = deferred[t-1] + billings[t] − recognized[t], so
 * the indirect-method `change_deferred_revenue` ties to cash BY CONSTRUCTION. The pre-existing base
 * carries an opening deferred (prepaid before the window). Recognized / ARR / MRR / bookings are
 * unchanged from the cohort sim.
 */
import { mulberry32, between, chance, roundTo, weightedIndex } from "./prng";
import { CUSTOMER_NAMES } from "./names";
import {
  SEED_RNG_SEED,
  SEED_MONTH_COUNT,
  SEED_MONTHS,
  indexToMonth,
  TIERS,
  INITIAL_BASE_COUNT,
  NEW_LOGOS_BY_MONTH,
  MONTHLY_CHURN,
  CHURN_SPIKE,
  MONTHLY_EXPANSION,
  EXPANSION_PCT,
  MONTHLY_CONTRACTION,
  CONTRACTION_PCT,
  EXPANSION_WAVE,
  PRICE_INCREASE,
  BILLING_MONTHS,
} from "./params";
import { usd, toMajor } from "@/lib/types/money";
import type { Month } from "@/lib/types/period";
import type { Customer, Contract, PlanTier } from "@/lib/types/source";
import type { CustomerId, ContractId } from "@/lib/types/common";

interface SimCustomer {
  id: string;
  name: string;
  tier: PlanTier;
  startIndex: number;
  arr: number;
  active: boolean;
  churnIndex?: number;
  /** prepaid-but-unrecognized balance (this customer's share of deferred revenue) */
  deferredBal: number;
}

export interface MonthlyBookings {
  readonly newBusiness: number;
  readonly expansion: number;
  readonly contraction: number;
  readonly net: number;
}

export interface SubscriptionSeries {
  readonly months: readonly Month[];
  readonly recognized: readonly number[];
  readonly deferred: readonly number[];
  /** annual upfront billings (anniversary + prorated mid-term increments − churn refunds) */
  readonly billings: readonly number[];
  readonly arr: readonly number[];
  readonly mrr: readonly number[];
  readonly bookings: readonly MonthlyBookings[];
  /** active logo count at month end (for logo retention) */
  readonly activeLogos: readonly number[];
  /** logos that churned this month (count) */
  readonly churnedLogos: readonly number[];
}

/** Per-contract monthly recognition + deferred + ARR — the drill source behind getRecognizedRevenue.
 *  Σ recognized over contracts in month i === series.recognized[i] BY CONSTRUCTION, so the revenue
 *  drill ties to the P&L line. (Mirrors the services seed's recByProject.) */
export interface RecognizedContractRow {
  readonly contractId: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly tier: PlanTier;
  readonly recognized: readonly number[];
  readonly deferred: readonly number[];
  readonly arr: readonly number[];
}

/**
 * Honest classification of what a check actually proves (tie-out audit, 2026-06-17):
 *  - independent: compares a quantity to a GENUINELY different derivation (a second data
 *    path / source). It CAN fail under a realistic bug — a true tie-out proof.
 *  - calibration: compares a generated total to a hand-set target band — falsifiable.
 *  - definitional: an `x === x` invariant / restatement of a definition. It cannot fail
 *    (a structural guard, NOT a reconciliation). Labeled so "all green" is not mistaken
 *    for "all reconciled".
 *  - sanity: a one-sided bound (>= 0, <= 100%). Honest, but not a tie-out.
 */
export type CheckKind = "independent" | "calibration" | "definitional" | "sanity";

export interface TieOutCheck {
  readonly label: string;
  readonly ok: boolean;
  readonly detail: string;
  readonly kind: CheckKind;
}

/** A single subscription billing event (annual-upfront term, mid-term increment, or churn refund).
 *  Σ amount over a month === the subscription `billings` series for that month, BY CONSTRUCTION
 *  (emitted from the same billing points). The sub-ledger explodes these into customer invoices. */
export interface SubInvoiceEvent {
  readonly customerId: string;
  readonly contractId: string;
  readonly monthIndex: number;
  readonly kind: "new_term" | "increment" | "refund";
  readonly amount: number;
}

/** A new-logo event in the window — what the services step attaches implementation work to. */
export interface Acquisition {
  readonly customerId: CustomerId;
  readonly name: string;
  readonly tier: PlanTier;
  readonly startIndex: number;
  readonly arr: number;
}

export interface SubscriptionSeed {
  readonly customers: readonly Customer[];
  readonly contracts: readonly Contract[];
  readonly series: SubscriptionSeries;
  readonly acquisitions: readonly Acquisition[];
  /** per-customer billing events; Σ amount per month === series.billings (sub-ledger source) */
  readonly invoices: readonly SubInvoiceEvent[];
  /** per-contract monthly recognized + deferred + ARR (drill source for getRecognizedRevenue) */
  readonly recByContract: readonly RecognizedContractRow[];
  readonly fyRecognized: Readonly<Record<number, number>>;
  /** deferred-revenue balance carried into the window (pre-existing base prepaid before Jan 2024) */
  readonly openingDeferred: number;
  readonly checks: readonly TieOutCheck[];
}

const cid = (s: string): CustomerId => s as CustomerId;
const ctid = (s: string): ContractId => s as ContractId;

export function generateSubscriptionSeed(): SubscriptionSeed {
  const rng = mulberry32(SEED_RNG_SEED);
  const sims: SimCustomer[] = [];
  const weights = TIERS.map((t) => t.weight);
  let nameCursor = 0;

  const newSim = (idPrefix: string, startIndex: number): SimCustomer => {
    const spec = TIERS[weightedIndex(rng, weights)];
    // Grain $50 (not $1,000): real contracts land on seat-math values, not exact round thousands —
    // every ARR ending in 000 was a synthetic tell (audit #4/#12/#24). Unbiased (same rng draw, finer
    // rounding), so aggregate revenue and all tie-outs are unmoved; only the digits read real.
    const arr = roundTo(between(rng, spec.arrLo, spec.arrHi), 50);
    const base = CUSTOMER_NAMES[nameCursor % CUSTOMER_NAMES.length];
    const suffix = Math.floor(nameCursor / CUSTOMER_NAMES.length);
    const name = suffix === 0 ? base : `${base} ${suffix + 1}`;
    nameCursor++;
    return { id: idPrefix, name, tier: spec.tier, startIndex, arr, active: true, deferredBal: 0 };
  };

  // Pre-existing book as of Jan 2024, with staggered billing cycles (negative start index).
  // Counted as month-0 bookings so the cumulative-ΔARR === ARR reconciliation holds. Each carries
  // an OPENING deferred = the unrecognized portion of its current annual term (prepaid pre-window):
  // arr × (BILLING_MONTHS + startIndex) / BILLING_MONTHS, for startIndex ∈ [−12, −1].
  let initialBaseArr = 0;
  let openingDeferred = 0;
  for (let k = 0; k < INITIAL_BASE_COUNT; k++) {
    const c = newSim(`sub-init-${k}`, -((k % 12) + 1));
    c.deferredBal = (c.arr * (BILLING_MONTHS + c.startIndex)) / BILLING_MONTHS;
    openingDeferred += c.deferredBal;
    sims.push(c);
    initialBaseArr += c.arr;
  }

  const acquisitions: Acquisition[] = [];
  const invoices: SubInvoiceEvent[] = [];
  const inv = (c: SimCustomer, i: number, kind: SubInvoiceEvent["kind"], amount: number) => {
    if (amount === 0) return;
    invoices.push({ customerId: c.id, contractId: `C-${c.id}`, monthIndex: i, kind, amount });
  };
  const recognized: number[] = [];
  const deferred: number[] = [];
  const billingsSeries: number[] = [];
  const arrSeries: number[] = [];
  const mrrSeries: number[] = [];
  const bookings: MonthlyBookings[] = [];
  const activeLogos: number[] = [];
  const churnedLogos: number[] = [];
  // per-contract monthly recognition drill (keyed by sim id; contractId === `C-${id}`)
  const recByContract = new Map<
    string,
    { customerId: string; customerName: string; tier: PlanTier; recognized: number[]; deferred: number[]; arr: number[] }
  >();

  // Bill the incremental ARR for the remainder of the current term (mid-term only — at an
  // anniversary the full-ARR re-bill below already covers it). Funds the higher recognition
  // rate from this month through the next anniversary, so the per-customer deferred stays ≥ 0.
  const billIncrement = (c: SimCustomer, delta: number, i: number): number => {
    const monthsIntoYear = (i - c.startIndex) % BILLING_MONTHS;
    if (monthsIntoYear === 0) return 0; // anniversary re-bill handles it
    const inc = (delta * (BILLING_MONTHS - monthsIntoYear)) / BILLING_MONTHS;
    c.deferredBal += inc;
    return inc;
  };

  // Partial contraction (downsell): refund the prorated unused portion of the reduced ARR — a
  // negative billing event mirroring billIncrement. Keeps the per-customer deferred ≥ 0 and the
  // billings roll-forward clean, so deferredRollsForward still ties.
  const billDecrement = (c: SimCustomer, delta: number, i: number): number => {
    const monthsIntoYear = (i - c.startIndex) % BILLING_MONTHS;
    const refund = (delta * (BILLING_MONTHS - monthsIntoYear)) / BILLING_MONTHS;
    c.deferredBal -= refund;
    return -refund;
  };

  for (let i = 0; i < SEED_MONTH_COUNT; i++) {
    let bNew = 0;
    let bExp = 0;
    let bContraction = 0;
    let billed = 0;
    let churnCount = 0;

    // 1) churn (elevated during the Q3-2024 spike); never in month 0 (so the pre-existing
    //    base can't churn the same month it is booked) nor on a customer's first month.
    //    On churn, refund the unused prepaid (deferred → 0) — keeps the roll-forward clean.
    const churnRate = i >= CHURN_SPIKE.fromIndex && i <= CHURN_SPIKE.toIndex ? CHURN_SPIKE.rate : MONTHLY_CHURN;
    for (const c of sims) {
      if (c.active && i > 0 && i > c.startIndex && chance(rng, churnRate)) {
        c.active = false;
        c.churnIndex = i;
        bContraction += c.arr;
        billed -= c.deferredBal;
        inv(c, i, "refund", -c.deferredBal);
        c.deferredBal = 0;
        churnCount += 1;
      }
    }

    // 2) price increase on the active base (story event) — bills the prorated increment
    if (i === PRICE_INCREASE.monthIndex) {
      for (const c of sims) {
        if (c.active) {
          const delta = roundTo(c.arr * PRICE_INCREASE.pct, 50);
          c.arr += delta;
          bExp += delta;
          const incP = billIncrement(c, delta, i);
          billed += incP;
          inv(c, i, "increment", incP);
        }
      }
    }

    // 3) expansions — also bill the prorated increment. The mid-2025 module-launch wave (story
    //    beat) lifts the expansion rate inside its window, then reverts to Base.
    const expRate =
      i >= EXPANSION_WAVE.fromIndex && i <= EXPANSION_WAVE.toIndex ? MONTHLY_EXPANSION * EXPANSION_WAVE.multiplier : MONTHLY_EXPANSION;
    for (const c of sims) {
      if (c.active && i > c.startIndex && chance(rng, expRate)) {
        const delta = roundTo(c.arr * between(rng, EXPANSION_PCT.lo, EXPANSION_PCT.hi), 50);
        c.arr += delta;
        bExp += delta;
        const incE = billIncrement(c, delta, i);
        billed += incE;
        inv(c, i, "increment", incE);
      }
    }

    // 3b) partial contractions / downsells — reduce ARR but keep the logo ACTIVE (seat reduction /
    //     module drop), refunding the prorated unused prepaid. Books to contraction so the NRR/GRR
    //     bridge shows real downsell, not only binary churn-to-zero (realism audit 2026-06-18).
    for (const c of sims) {
      if (c.active && i > c.startIndex && chance(rng, MONTHLY_CONTRACTION)) {
        const raw = roundTo(c.arr * between(rng, CONTRACTION_PCT.lo, CONTRACTION_PCT.hi), 50);
        const delta = Math.min(raw, c.arr - 1000); // floor at $1K ARR (a full drop is churn, handled above)
        if (delta <= 0) continue;
        c.arr -= delta;
        bContraction += delta;
        const refund = billDecrement(c, delta, i);
        billed += refund;
        inv(c, i, "refund", refund);
      }
    }

    // 4) new logos (month 0 also books the pre-existing base)
    if (i === 0) bNew += initialBaseArr;
    const n = NEW_LOGOS_BY_MONTH[i] ?? 0;
    for (let k = 0; k < n; k++) {
      const c = newSim(`sub-${i}-${k}`, i);
      sims.push(c);
      bNew += c.arr;
      acquisitions.push({ customerId: cid(c.id), name: c.name, tier: c.tier, startIndex: i, arr: c.arr });
    }

    // 4b) anniversary billing — every active customer re-bills its full current ARR upfront on its
    //     term boundary (a new logo's first month is its anniversary, so it bills its annual ARR).
    for (const c of sims) {
      if (c.active && (i - c.startIndex) % BILLING_MONTHS === 0) {
        billed += c.arr;
        c.deferredBal += c.arr;
        inv(c, i, "new_term", c.arr);
      }
    }

    // 5) month-end recognition over the active base (ratable, = ARR ÷ 12), drawing down deferred
    let rec = 0;
    let def = 0;
    let arrTot = 0;
    let activeCount = 0;
    for (const c of sims) {
      if (!c.active) continue;
      const monthlyRate = c.arr / BILLING_MONTHS;
      rec += monthlyRate;
      c.deferredBal -= monthlyRate;
      def += c.deferredBal;
      arrTot += c.arr;
      activeCount += 1;
      let rc = recByContract.get(c.id);
      if (!rc) {
        rc = { customerId: c.id, customerName: c.name, tier: c.tier, recognized: new Array<number>(SEED_MONTH_COUNT).fill(0), deferred: new Array<number>(SEED_MONTH_COUNT).fill(0), arr: new Array<number>(SEED_MONTH_COUNT).fill(0) };
        recByContract.set(c.id, rc);
      }
      rc.recognized[i] = monthlyRate;
      rc.deferred[i] = c.deferredBal;
      rc.arr[i] = c.arr;
    }
    recognized.push(rec);
    deferred.push(def);
    billingsSeries.push(billed);
    arrSeries.push(arrTot);
    mrrSeries.push(arrTot / BILLING_MONTHS);
    bookings.push({ newBusiness: bNew, expansion: bExp, contraction: bContraction, net: bNew + bExp - bContraction });
    activeLogos.push(activeCount);
    churnedLogos.push(churnCount);
  }

  // ── records ──
  const customers: Customer[] = sims.map((c) => ({
    id: cid(c.id),
    name: c.name,
    segment: c.tier,
    startMonth: indexToMonth(c.startIndex),
    status: c.active ? "active" : "churned",
    // A churned logo contributes $0 to the current book — the record carries 0, not its stale pre-churn
    // ARR (audit #9/#14); the pre-churn figure still lives on the contract. churnMonth set when churned.
    arr: c.active ? usd(c.arr) : usd(0),
    churnMonth: c.active || c.churnIndex === undefined ? undefined : indexToMonth(c.churnIndex),
  }));

  // Contract commitment term varies (audit #11): bigger deals commit longer — scale tiers sign 2–3yr,
  // some growth deals 2yr, starters annual. Billing + 606 recognition stay ANNUAL (BILLING_MONTHS), so
  // this is a display/renewal-cadence attribute only — derived deterministically (no rng), tie-out-neutral.
  const termFor = (tier: PlanTier, k: number): number =>
    tier === "scale" ? (k % 2 === 0 ? 24 : 36) : tier === "growth" ? (k % 3 === 0 ? 24 : 12) : 12;
  const contracts: Contract[] = sims.map((c, k) => ({
    id: ctid(`C-${c.id}`),
    customerId: cid(c.id),
    customerName: c.name,
    stream: "subscription",
    planTier: c.tier,
    arr: usd(c.arr),
    startMonth: indexToMonth(c.startIndex),
    termMonths: termFor(c.tier, k),
    status: c.active ? "active" : "churned",
    bookingType: "new",
  }));

  // ── FY recognized ──
  const fyRecognized: Record<number, number> = { 2024: 0, 2025: 0, 2026: 0 };
  recognized.forEach((r, i) => {
    fyRecognized[2024 + Math.floor(i / 12)] += r;
  });

  // ── tie-out checks ──
  const last = SEED_MONTH_COUNT - 1;
  const sumNet = bookings.reduce((a, b) => a + b.net, 0);
  // INDEPENDENT check: rebuild ARR from the bookings ledger (new/expansion/contraction)
  // and compare to the ARR summed from the active base — every month. This is NOT a
  // self-comparison: it would catch recognizing a churned contract, a dropped expansion,
  // or recognizing before start, which a recognized-vs-MRR identity cannot.
  let cum = 0;
  const arrTracksBookings = bookings.every((b, i) => {
    cum += b.net;
    return Math.abs(cum - arrSeries[i]) < 1;
  });
  // Third independent path: the SHIPPED Customer[] records (not the sim loop, not the
  // bookings ledger) — Σ active Customer.arr must equal the exit-ARR stock.
  const arrFromActiveRecords = customers
    .filter((c) => c.status === "active")
    .reduce((s, c) => s + toMajor(c.arr), 0);
  const recordsTieArr = Math.abs(arrFromActiveRecords - arrSeries[last]) < 1;
  // Definitional: recognized[i] = Σ(c.arr/12) and arrSeries[i]/12 = (Σc.arr)/12 are summed
  // in the SAME loop over the SAME active guard — algebraically identical (Σx/12 = (Σx)/12).
  // It pins the recognition DIVISOR (a `/24` bug would trip it) but does NOT independently
  // verify the recognized amounts; arrTracksBookings is the real tie.
  const recDivisorOk = recognized.every((r, i) => Math.abs(r - arrSeries[i] / BILLING_MONTHS) < 1);
  const deferredNonNeg = deferred.every((d) => d >= -1);
  // INDEPENDENT roll-forward: the deferred BALANCE (Σ per-customer prepaid) must reconcile to the
  // FLOW (opening + Σbillings − Σrecognized) every month — two different accumulators. A dropped
  // billing event or a recognition that doesn't draw down deferred trips it.
  let cumBilled = 0;
  let cumRec = 0;
  const deferredRollsForward = deferred.every((d, i) => {
    cumBilled += billingsSeries[i];
    cumRec += recognized[i];
    return Math.abs(openingDeferred + cumBilled - cumRec - d) < 1;
  });

  const checks: TieOutCheck[] = [
    {
      label: "ARR ties to cumulative bookings, every month",
      ok: arrTracksBookings,
      detail: `Σ ΔARR ${Math.round(sumNet).toLocaleString()} === active-base ARR ${Math.round(arrSeries[last]).toLocaleString()} (flow ledger vs active-base stock — different paths)`,
      kind: "independent",
    },
    {
      label: "Active-customer records reconcile to exit ARR",
      ok: recordsTieArr,
      detail: `Σ active Customer.arr ${Math.round(arrFromActiveRecords).toLocaleString()} === exit ARR ${Math.round(arrSeries[last]).toLocaleString()} (reads the shipped records, a third path)`,
      kind: "independent",
    },
    {
      label: "Recognition uses the ratable divisor (ARR ÷ 12)",
      ok: recDivisorOk,
      detail: "definitional within the aggregation loop — pins the 606 straight-line divisor, not an independent recognition tie",
      kind: "definitional",
    },
    {
      label: "Deferred ties to the billings roll-forward",
      ok: deferredRollsForward,
      detail: `deferred[t] === opening ${Math.round(openingDeferred).toLocaleString()} + Σbillings − Σrecognized, every month (balance vs flow)`,
      kind: "independent",
    },
    {
      label: "Deferred balance non-negative",
      ok: deferredNonNeg,
      detail: "no negative contract liability (annual prepay, ratable draw-down); one-sided bound",
      kind: "sanity",
    },
    {
      label: "Per-contract recognition drill sums to the recognized series",
      ok: recognized.every((r, i) => {
        let s = 0;
        for (const v of recByContract.values()) s += v.recognized[i];
        return Math.abs(s - r) < 1;
      }),
      detail: "Σ per-contract recognized[i] === series.recognized[i] every month (the getRecognizedRevenue drill ties to the P&L revenue line)",
      kind: "definitional",
    },
  ];

  return {
    customers,
    contracts,
    series: { months: SEED_MONTHS, recognized, deferred, billings: billingsSeries, arr: arrSeries, mrr: mrrSeries, bookings, activeLogos, churnedLogos },
    acquisitions,
    invoices,
    recByContract: Array.from(recByContract, ([id, v]) => ({
      contractId: `C-${id}`,
      customerId: v.customerId,
      customerName: v.customerName,
      tier: v.tier,
      recognized: v.recognized,
      deferred: v.deferred,
      arr: v.arr,
    })),
    fyRecognized,
    openingDeferred,
    checks,
  };
}
