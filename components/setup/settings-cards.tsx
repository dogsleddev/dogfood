import { monthLabel, monthsInRange } from "@/lib/types/period";
import type { AppSettings, FirmProfile } from "@/lib/datastore";
import type { CostFunction } from "@/lib/types/common";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Human label for a function tag, shared by the department + expense-group tables. */
export const FUNCTION_LABELS: Record<CostFunction, string> = {
  direct: "Direct (CoR)",
  rnd: "R&D",
  sm: "S&M",
  ga: "G&A",
};

/** Tone per function tag — a quiet pill, keeps the read-only view scannable. */
const FUNCTION_TONE: Record<CostFunction, string> = {
  direct: "bg-amber/15 text-amber-deep",
  rnd: "bg-frost/20 text-steel",
  sm: "bg-ember/15 text-ember-deep",
  ga: "bg-sage/15 text-sage-deep",
};

export function FunctionPill({ fn }: { fn: CostFunction }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${FUNCTION_TONE[fn]}`}>
      {FUNCTION_LABELS[fn]}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-steel">{label}</div>
      <div className="mt-1 font-heading text-lg text-ink">{value}</div>
      {sub ? <div className="text-[11px] text-steel">{sub}</div> : null}
    </div>
  );
}

/**
 * The firm-profile + period/close-boundary header cards. Pure read-out of getFirm() + getSettings();
 * no editing — Settings owns this config, the read-only view just surfaces it (CLAUDE.md §7/§11).
 */
export function FirmCards({ firm, settings }: { firm: FirmProfile; settings: AppSettings }) {
  const fyStart = MONTH_NAMES[settings.fiscalYearStartMonth - 1] ?? "January";
  const fyType = settings.fiscalYearStartMonth === 1 ? "Calendar fiscal year" : "Fiscal year";
  const horizonMonths = monthsInRange(settings.forecastHorizon).length;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-parchment-line bg-surface p-5">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-ember-deep">Firm profile</div>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-ink font-heading text-sm font-semibold text-parchment">
            {firm.shortCode}
          </span>
          <div>
            <div className="font-heading text-xl text-ink">{firm.name}</div>
            <div className="text-xs text-steel">Reporting currency · {settings.currency}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-parchment-line bg-surface p-5">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-ember-deep">Fiscal year &amp; close</div>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Fiscal year" value={fyType} sub={`Starts ${fyStart}`} />
          <Stat label="Actual through" value={monthLabel(settings.closeThrough)} sub="last fully closed month" />
          <Stat
            label="In close"
            value={settings.inCloseMonth ? monthLabel(settings.inCloseMonth) : "—"}
            sub={settings.inCloseMonth ? "month currently closing" : undefined}
          />
          <Stat
            label="Forecast horizon"
            value={`${monthLabel(settings.forecastHorizon.start)} – ${monthLabel(settings.forecastHorizon.end)}`}
            sub={`${horizonMonths} months forecast`}
          />
        </div>
      </div>
    </div>
  );
}
