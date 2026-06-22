/**
 * Personnel seed — step 3 of the §12 generator. The PAYROLL axis of the two-axis cost
 * model (§8): heads by department, each carrying a function tag (Direct / R&D / S&M / G&A).
 * Base comp here; burden lives in the Employee Expenses OpEx group (step 4).
 *
 * Couples to services: PS headcount × delivery-per-head → the monthly services capacity
 * the services step is gated by (the §11 "implementation capacity gates go-lives" link).
 *
 * Tie-out BY CONSTRUCTION: payroll by function === payroll by department === total payroll;
 * Direct payroll === PS + Support payroll; headcount reaches the plan.
 */
import { mulberry32, between, roundTo } from "./prng";
import { personName } from "./names";
import { SEED_DEPARTMENTS, PLACEHOLDER_SETTINGS } from "@/lib/target/placeholder";
import { monthYear, monthIndex as monthNo } from "@/lib/types/period";
import {
  SEED_MONTH_COUNT,
  SEED_MONTHS,
  indexToMonth,
  PERSONNEL_RNG_SEED,
  DEPT_PLAN,
  COMP_VARIATION,
  HIRING_CURVE,
  DIRECT_DEPTS,
  DELIVERY_DEPTS,
  DELIVERY_PER_HEAD_PER_MONTH,
  MERIT_RAISE_PCT,
  DEC_BONUS_PCT,
  DEPT_TITLE_LADDER,
  ATTRITION_FRACTION,
  ATTRITION_TENURE,
} from "./params";

/**
 * Per-department seniority RUNG assignment: an array mapping within-dept hire rank → rung index
 * (0 = most senior). The dept gets its correct END-STATE org structure (the right count of CEO / VP /
 * manager / senior / IC from the title-ladder fractions), but seniority is SPREAD across the hire
 * timeline (a low-discrepancy golden-ratio order) rather than clustered in the founding cohort — real
 * orgs hire managers/VPs as they scale, not all on day one. Spreading keeps each hire cohort near the
 * dept's average comp, so realistic exec pay does NOT front-load payroll and break §11. The founding
 * Co-founder/CEO seat (rung 0) is pinned to rank 0 (a month-0 founder). Deterministic, any size.
 */
function rungAssignment(deptId: string, size: number): number[] {
  const ladder = DEPT_TITLE_LADDER[deptId];
  if (!ladder || ladder.length === 0 || size <= 0) return new Array(Math.max(0, size)).fill(-1);
  // target count per rung (senior→junior), guaranteeing the leadership rung is filled
  let acc = 0;
  let assigned = 0;
  const flat: number[] = [];
  for (let r = 0; r < ladder.length; r++) {
    acc += ladder[r].frac;
    const cutoff = r === ladder.length - 1 ? size : Math.max(r === 0 ? 1 : 0, Math.round(acc * size));
    for (let k = assigned; k < cutoff && flat.length < size; k++) flat.push(r);
    assigned = cutoff;
  }
  while (flat.length < size) flat.push(ladder.length - 1);
  // spread: order the ranks by a golden-ratio key, then lay the senior-first rung list onto that order
  const order = Array.from({ length: size }, (_, n) => n).sort((a, b) => ((a * 0.61803398875) % 1) - ((b * 0.61803398875) % 1));
  const out = new Array<number>(size).fill(ladder.length - 1);
  for (let i = 0; i < size; i++) out[order[i]] = flat[i];
  // pin the founding leader (rung 0 — the CEO seat) to rank 0 so they read as a month-0 founder
  const top = out.indexOf(0);
  if (top > 0) { out[top] = out[0]; out[0] = 0; }
  return out;
}

/** Job title by seniority rung (display only). Falls back to the department name if no ladder/rung. */
function titleForRung(deptId: string, deptName: string, rung: number): string {
  const ladder = DEPT_TITLE_LADDER[deptId];
  return !ladder || rung < 0 || rung >= ladder.length ? deptName : ladder[rung].title;
}

/**
 * RELATIVE compensation multiplier by seniority rung — leadership earns a real premium, ICs sit below
 * the band (audit #7: comp was a flat ±15% per dept, capping at $189K with no exec/leadership pay). The
 * dept's comps are RENORMALIZED to its target total afterward, so this sets the DISTRIBUTION only — the
 * per-function payroll envelope (CoR / indirect payroll / GM / runway / NI) is unchanged. Engineering's
 * rung-0 seat is the technical Co-founder & CEO (the top earner company-wide).
 */
function compMultForRung(deptId: string, rung: number): number {
  const ladder = DEPT_TITLE_LADDER[deptId];
  if (!ladder || ladder.length === 0 || rung < 0) return 1;
  // Engineering — an explicit comp shape so the org reads right (review 2026-06-21): a VP Eng (senior
  // hired leader) can out-earn the cash-discounted founder-CEO, who in turn stays ABOVE the line
  // Engineering Managers. Was: founder-CEO at 1.65 below the generic 2.2 manager rung, so line managers
  // out-earned the founder by ~$50K and the 39-person R&D org had no head. Rungs: CEO, VP Eng, EM, Staff,
  // Senior, SWE. (Renormalized to the dept envelope, so §11 is unmoved.)
  if (deptId === "engineering") {
    const ENG = [1.4, 1.75, 1.28, 1.15, 0.95, 0.78];
    return ENG[rung] ?? ENG[ENG.length - 1];
  }
  // Sales carries commission/OTE: a STEEPER spread (vs the default 2.2 / 0.82) so VP Sales and top reps
  // out-earn non-sales VPs while SDRs sit low — the realistic shape where a top seller can be the
  // highest-paid non-founder (RepVue/Bridge Group; VP Sales OTE $300–380K).
  const SENIOR = deptId === "sales" ? 3.5 : 2.2; // VP / CFO / Director / Head — leadership outlier (VP Sales OTE band)
  const JUNIOR = deptId === "sales" ? 0.62 : 0.82; // most-junior IC / SDR sits below the band (SDR base ~$55-60K)
  const t = ladder.length === 1 ? 0 : rung / (ladder.length - 1);
  return SENIOR + (JUNIOR - SENIOR) * t;
}

/** Per-employee monthly cash comp: annual base ÷ 12, grown by a merit raise at each hire
 *  anniversary, plus a December target bonus. Shared by the payroll series AND the paycheck
 *  sub-ledger so the two reconcile by construction (a flat baseComp/12 made every paycheck
 *  byte-identical for 36 months — realism audit 2026-06-18). */
export function monthlyCompFor(baseComp: number, hireIndex: number, monthIndex: number): number {
  if (monthIndex < hireIndex) return 0;
  const tenureYears = Math.floor((monthIndex - hireIndex) / 12);
  const annual = baseComp * Math.pow(1 + MERIT_RAISE_PCT, tenureYears);
  const bonus = monthIndex % 12 === 11 ? annual * DEC_BONUS_PCT : 0;
  return annual / 12 + bonus;
}
import { usd } from "@/lib/types/money";
import type { Month } from "@/lib/types/period";
import type { StaffMember } from "@/lib/types/source";
import type { DepartmentId, CostFunction } from "@/lib/types/common";
import type { TieOutCheck } from "./subscription";

interface SimStaff {
  id: string;
  name: string;
  departmentId: string;
  function: CostFunction;
  title: string;
  hireIndex: number;
  /** month index the employee departs (attrition); undefined = still active at horizon */
  endIndex?: number;
  baseComp: number;
}

export type FunctionBuckets = Record<CostFunction, number>;
const zeroBuckets = (): FunctionBuckets => ({ direct: 0, rnd: 0, sm: 0, ga: 0 });

export interface PersonnelSeries {
  readonly months: readonly Month[];
  readonly totalHeadcount: readonly number[];
  readonly headcountByFunction: readonly FunctionBuckets[];
  readonly totalPayroll: readonly number[];
  readonly payrollByFunction: readonly FunctionBuckets[];
  readonly directPayroll: readonly number[];
  /** total − direct (= R&D + S&M + G&A). The P&L Indirect Payroll line MUST read this,
   *  never totalPayroll, or direct labor would be double-counted (it is already in CoR). */
  readonly indirectPayroll: readonly number[];
  readonly servicesCapacity: readonly number[];
}

export interface PersonnelSeed {
  readonly staff: readonly StaffMember[];
  readonly series: PersonnelSeries;
  readonly fyPayroll: Readonly<Record<number, number>>;
  readonly fyDirectPayroll: Readonly<Record<number, number>>;
  readonly endHeadcount: number;
  readonly checks: readonly TieOutCheck[];
}

export function generatePersonnelSeed(): PersonnelSeed {
  const rng = mulberry32(PERSONNEL_RNG_SEED);
  const sims: SimStaff[] = [];
  let cursor = 0;
  // Attrition departures land only in the CLOSED (actuals) window — you don't model specific future
  // terminations, and as-of the current period a departed employee has already left (no future end date).
  const closeIdx = (monthYear(PLACEHOLDER_SETTINGS.closeThrough) - 2024) * 12 + (monthNo(PLACEHOLDER_SETTINGS.closeThrough) - 1);

  for (const dept of SEED_DEPARTMENTS) {
    const plan = DEPT_PLAN[dept.id];
    if (!plan) continue;
    const growth = plan.end - plan.start;
    const hireIndexFor = (k: number): number => {
      for (let i = 0; i < SEED_MONTH_COUNT; i++) {
        if (Math.round(growth * HIRING_CURVE[i]) >= k) return i;
      }
      return SEED_MONTH_COUNT - 1;
    };
    const total = plan.end;
    const deptStart = sims.length;
    const rungs = rungAssignment(dept.id, total);
    for (let n = 0; n < total; n++) {
      const isFounder = n < plan.start;
      const hireIndex = isFounder ? 0 : hireIndexFor(n - plan.start + 1);
      // Provisional comp = planned dept base × seniority multiplier × small within-rung variation;
      // renormalized to the dept envelope below so the per-function payroll is unchanged (§11-neutral).
      const rawComp = plan.baseComp * compMultForRung(dept.id, rungs[n]) * between(rng, 1 - COMP_VARIATION, 1 + COMP_VARIATION);
      sims.push({
        id: `staff-${dept.id}-${n}`,
        name: personName(cursor++),
        departmentId: dept.id,
        function: dept.function,
        title: titleForRung(dept.id, dept.name, rungs[n]),
        hireIndex,
        baseComp: rawComp,
      });
    }
    // Renormalize this department's comps so Σ === the planned envelope (plan.baseComp × headcount):
    // the seniority ladder redistributes WHO earns what, but the dept (and thus per-function) total
    // payroll is held, so CoR / indirect payroll / gross margin / runway / NI are unmoved (audit #7).
    const deptSims = sims.slice(deptStart);
    const rawTotal = deptSims.reduce((sum, s) => sum + s.baseComp, 0);
    const scale = rawTotal > 0 ? (plan.baseComp * total) / rawTotal : 1;
    for (const s of deptSims) s.baseComp = roundTo(s.baseComp * scale, 100);

    // Attrition + backfill (audit #23): churn a few slots — the incumbent departs after a realistic
    // tenure and a backfill fills the SAME slot (same comp/rung) when they leave. The slot stays filled
    // continuously, so the headcount trajectory and per-function payroll envelope are preserved; only
    // the backfill's merit tenure resets (a small effect). Slot 0 (the founding lead) never churns.
    // eligible = slots (excluding slot 0, the founding lead) hired early enough to depart with a real
    // tenure before the horizon; pick leaverCount of them spread across the eligible set.
    const eligible: number[] = [];
    for (let n = 1; n < total; n++) {
      if (sims[deptStart + n].hireIndex + ATTRITION_TENURE.lo <= closeIdx) eligible.push(n);
    }
    const leaverCount = Math.min(eligible.length, Math.round(total * ATTRITION_FRACTION));
    let bf = 0;
    for (let j = 0; j < leaverCount; j++) {
      const slot = sims[deptStart + eligible[Math.floor((j * eligible.length) / leaverCount)]];
      if (slot.endIndex !== undefined) continue;
      const tenure = ATTRITION_TENURE.lo + Math.floor(rng() * (ATTRITION_TENURE.hi - ATTRITION_TENURE.lo + 1));
      const endIdx = Math.min(slot.hireIndex + tenure, closeIdx); // depart within the closed window
      slot.endIndex = endIdx;
      sims.push({
        id: `staff-${dept.id}-bf${bf++}`,
        name: personName(cursor++),
        departmentId: dept.id,
        function: dept.function,
        title: slot.title,
        hireIndex: endIdx, // backfill starts when the incumbent leaves
        baseComp: slot.baseComp, // same slot comp → active payroll per month is unchanged
      });
    }
  }

  const totalHeadcount: number[] = [];
  const headcountByFunction: FunctionBuckets[] = [];
  const totalPayroll: number[] = [];
  const payrollByFunction: FunctionBuckets[] = [];
  const directPayroll: number[] = [];
  const indirectPayroll: number[] = [];
  const servicesCapacity: number[] = [];

  for (let i = 0; i < SEED_MONTH_COUNT; i++) {
    const heads = zeroBuckets();
    const pay = zeroBuckets();
    let headTot = 0;
    let payTot = 0;
    let directPay = 0;
    let psHeads = 0;

    for (const s of sims) {
      if (s.hireIndex > i) continue;
      if (s.endIndex !== undefined && i >= s.endIndex) continue; // departed (attrition)
      const monthly = monthlyCompFor(s.baseComp, s.hireIndex, i);
      heads[s.function] += 1;
      pay[s.function] += monthly;
      headTot += 1;
      payTot += monthly;
      if ((DIRECT_DEPTS as readonly string[]).includes(s.departmentId)) directPay += monthly;
      if ((DELIVERY_DEPTS as readonly string[]).includes(s.departmentId)) psHeads += 1;
    }

    totalHeadcount.push(headTot);
    headcountByFunction.push(heads);
    totalPayroll.push(payTot);
    payrollByFunction.push(pay);
    directPayroll.push(directPay);
    indirectPayroll.push(payTot - directPay);
    servicesCapacity.push(psHeads * DELIVERY_PER_HEAD_PER_MONTH);
  }

  const staff: StaffMember[] = sims.map((s) => ({
    id: s.id as StaffMember["id"],
    name: s.name,
    departmentId: s.departmentId as DepartmentId,
    function: s.function,
    title: s.title,
    startMonth: indexToMonth(s.hireIndex),
    endMonth: s.endIndex !== undefined ? indexToMonth(s.endIndex) : undefined,
    fte: 1,
    baseComp: usd(s.baseComp),
  }));

  const fyPayroll: Record<number, number> = { 2024: 0, 2025: 0, 2026: 0 };
  const fyDirectPayroll: Record<number, number> = { 2024: 0, 2025: 0, 2026: 0 };
  totalPayroll.forEach((p, i) => {
    fyPayroll[2024 + Math.floor(i / 12)] += p;
  });
  directPayroll.forEach((p, i) => {
    fyDirectPayroll[2024 + Math.floor(i / 12)] += p;
  });

  const endHeadcount = totalHeadcount[SEED_MONTH_COUNT - 1];
  const planEnd = Object.values(DEPT_PLAN).reduce((a, p) => a + p.end, 0);

  const last = SEED_MONTH_COUNT - 1;
  // Closed-form recompute (Σ baseComp/12 × months active) vs the month-by-month accumulation —
  // a different code path, so dropping a department from the loop or a hireIndex>horizon trips it.
  // NOTE: both sides read s.hireIndex, so it does NOT catch a hireIndex-formula off-by-one; it is a
  // loop-vs-record STRUCTURAL drift guard, not a per-person verification.
  const payrollFromRecords = sims.reduce((sum, s) => {
    let t = 0;
    const end = Math.min(SEED_MONTH_COUNT, s.endIndex ?? SEED_MONTH_COUNT);
    for (let i = Math.max(0, s.hireIndex); i < end; i++) t += monthlyCompFor(s.baseComp, s.hireIndex, i);
    return sum + t;
  }, 0);
  const totalPayrollSum = totalPayroll.reduce((a, b) => a + b, 0);
  const recordsTie = Math.abs(payrollFromRecords - totalPayrollSum) < 1;
  // Definitional: indirectPayroll := totalPayroll − directPayroll (line 132), so this can never fail.
  const splitOk = totalPayroll.every((t, i) => Math.abs(directPayroll[i] + indirectPayroll[i] - t) < 1);
  const directIsFunctionDirect = directPayroll.every((d, i) => Math.abs(d - payrollByFunction[i].direct) < 1);
  const perDeptOk = SEED_DEPARTMENTS.every((d) => {
    const plan = DEPT_PLAN[d.id];
    if (!plan) return true;
    // count slots ACTIVE at horizon (departed incumbents excluded, backfills included) — not raw records
    const activeAtHorizon = sims.filter((s) => s.departmentId === d.id && (s.endIndex === undefined || s.endIndex > last)).length;
    return activeAtHorizon === plan.end;
  });

  const checks: TieOutCheck[] = [
    { label: "Payroll loop ties to the staff list", ok: recordsTie, detail: "Σ month-by-month payroll === Σ (baseComp ÷ 12 × months active) — catches loop-vs-record structural drift", kind: "independent" },
    { label: "Direct + Indirect === Total payroll", ok: splitOk, detail: "definitional — indirect := total − direct; a structural invariant, not a reconciliation", kind: "definitional" },
    { label: "Direct payroll === PS + Support (Direct function)", ok: directIsFunctionDirect, detail: "config-consistency — DIRECT_DEPTS list vs the function-tag partition (adding a direct dept to one only trips it)", kind: "independent" },
    { label: "Every department reaches its hiring plan", ok: perDeptOk && endHeadcount === planEnd, detail: `${endHeadcount} of ${planEnd} heads across ${SEED_DEPARTMENTS.length} depts — endHeadcount===planEnd is the falsifiable part`, kind: "independent" },
    { label: "Services capacity is positive at horizon", ok: servicesCapacity[last] > 0, detail: `end capacity ${Math.round(servicesCapacity[last]).toLocaleString()}/mo (positivity bound; capacity IS psHeads×rate by construction)`, kind: "sanity" },
  ];

  return {
    staff,
    series: {
      months: SEED_MONTHS,
      totalHeadcount,
      headcountByFunction,
      totalPayroll,
      payrollByFunction,
      directPayroll,
      indirectPayroll,
      servicesCapacity,
    },
    fyPayroll,
    fyDirectPayroll,
    endHeadcount,
    checks,
  };
}
