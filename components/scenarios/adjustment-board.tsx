import type { ReactNode } from "react";
import { formatMoney, formatPercent, usd } from "@/lib/types/money";
import { monthLabel } from "@/lib/types/period";
import type { Adjustment, LeverId } from "@/lib/types/scenario";
import type { ScenarioId } from "@/lib/types/common";
import { SEED_DEPARTMENTS, SEED_EXPENSE_GROUPS } from "@/lib/target/placeholder";
import { addAdjustmentAction, removeAdjustmentAction } from "@/app/scenarios/drivers/actions";

/**
 * The Scenario Drivers board (CLAUDE.md §9; diagrams/scenario-drivers.svg). Each adjustment is
 * rendered with its anatomy laid bare: lever + sub-dimension + magnitude + monthly window + shape.
 * USER scenarios get a per-card Remove and an Add-adjustment form (Server Actions, no client JS);
 * Base + presets are read-only (`readOnly` — duplicate a preset to author your own). Sub-dimension
 * ids are slugs from the closed typed lever set, formatted to a readable label here (display only).
 */

const LEVER_META: Record<LeverId, { label: string; blurb: string }> = {
  revenue: { label: "Revenue", blurb: "bookings / growth, by stream" },
  personnel: { label: "Personnel", blurb: "hiring pace / adds, by department" },
  expense: { label: "Expense", blurb: "opex level, by group" },
  direct_cost: { label: "Direct cost", blurb: "non-employee Cost-of-Revenue rate" },
  ar_dso: { label: "AR · DSO", blurb: "collection speed (days sales outstanding)" },
  ap_dpo: { label: "AP · DPO", blurb: "payment timing (days payable outstanding)" },
};

const INPUT =
  "rounded-md border border-parchment-line bg-white px-3 py-1.5 text-sm text-ink focus:border-ember focus:outline-none";

/** A slug id ("professional-services") → a readable label ("Professional Services"). Display only. */
function slugLabel(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** The sub-dimension target, as a readable string (or null for whole-lever adjustments). */
function subDimensionOf(adj: Adjustment): string | null {
  switch (adj.lever) {
    case "revenue":
      return slugLabel(adj.stream);
    case "personnel":
      return adj.departmentId ? slugLabel(adj.departmentId) : "All departments";
    case "expense":
      return slugLabel(adj.groupId);
    default:
      return null;
  }
}

/** The magnitude, rendered per its kind (rate / level / absolute / categorical). */
function magnitudeOf(adj: Adjustment): { text: string; tone: "pos" | "neg" | "muted" } {
  const m = adj.magnitude;
  switch (m.kind) {
    case "rate": {
      const text = `${m.value >= 0 ? "+" : ""}${formatPercent(m.value, 0)}`;
      return { text, tone: m.value >= 0 ? "pos" : "neg" };
    }
    case "level": {
      const money = formatMoney(usd(Math.abs(m.delta)), { compact: true });
      const text = `${m.delta >= 0 ? "+" : "−"}${money}/mo`;
      return { text, tone: m.delta >= 0 ? "pos" : "neg" };
    }
    case "absolute":
      return { text: `${m.value} ${m.unit}`, tone: "muted" };
    case "categorical":
      return { text: slugLabel(m.value), tone: "neg" };
  }
}

function windowOf(adj: Adjustment): string {
  const start = monthLabel(adj.window.start);
  return adj.window.end ? `${start} – ${monthLabel(adj.window.end)}` : `${start} – horizon`;
}

function Chip({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" | "muted" }) {
  const valueClass =
    tone === "pos" ? "text-sage-deep" : tone === "neg" ? "text-ember-deep" : "text-ink";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wider text-steel/70">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-steel/70">{label}</span>
      {children}
    </div>
  );
}

/** The Add-adjustment form: native controls reconstructing the discriminated union (no client JS). */
function AddAdjustmentForm({ scenarioId }: { scenarioId: ScenarioId }) {
  return (
    <form action={addAdjustmentAction} className="rounded-xl border border-dashed border-parchment-line bg-surface p-5">
      <input type="hidden" name="scenarioId" value={scenarioId} />
      <div className="mb-4 font-heading text-base text-ink">Add adjustment</div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormField label="Lever">
          <select name="lever" className={INPUT} defaultValue="revenue">
            <option value="revenue">Revenue (by stream)</option>
            <option value="personnel">Personnel (by department)</option>
            <option value="expense">Expense (by group)</option>
            <option value="direct_cost">Direct cost (CoR rate)</option>
            <option value="ar_dso">AR · DSO (days)</option>
          </select>
        </FormField>
        <FormField label="Magnitude kind">
          <select name="magnitudeKind" className={INPUT} defaultValue="rate">
            <option value="rate">Rate — % (revenue / direct cost)</option>
            <option value="level">Level — $/mo (personnel / expense)</option>
            <option value="absolute">Absolute — days (DSO)</option>
            <option value="categorical">Freeze (personnel)</option>
          </select>
        </FormField>
        <FormField label="Value (% / $ per mo / days)">
          <input name="magnitudeValue" type="number" step="any" defaultValue="0" className={INPUT} />
        </FormField>
        <FormField label="Revenue stream — if Lever = Revenue">
          <select name="stream" className={INPUT} defaultValue="subscription">
            <option value="subscription">Subscription</option>
            <option value="services">Services</option>
          </select>
        </FormField>
        <FormField label="Department — if Lever = Personnel">
          <select name="departmentId" className={INPUT} defaultValue="">
            <option value="">All departments</option>
            {SEED_DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Group — if Lever = Expense">
          <select name="groupId" className={INPUT} defaultValue={SEED_EXPENSE_GROUPS[1]?.id}>
            {SEED_EXPENSE_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Start month">
          <input name="start" type="month" required defaultValue="2026-07" min="2026-07" max="2026-12" className={INPUT} />
        </FormField>
        <FormField label="End month (optional)">
          <input name="end" type="month" min="2026-07" max="2026-12" className={INPUT} />
        </FormField>
        <FormField label="Shape">
          <div className="flex items-center gap-4 pt-1.5 text-sm text-ink">
            <label className="flex items-center gap-1.5"><input type="radio" name="shape" value="step" defaultChecked /> Step</label>
            <label className="flex items-center gap-1.5"><input type="radio" name="shape" value="ramp" /> Ramp</label>
          </div>
        </FormField>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className="rounded-md bg-ember px-3.5 py-1.5 text-sm font-medium text-white hover:bg-ember-deep">
          Add adjustment
        </button>
        <p className="text-xs text-steel">
          Window must sit inside Jul–Dec 2026. Only the sub-dimension matching the chosen lever is used.
        </p>
      </div>
    </form>
  );
}

export function AdjustmentBoard({
  adjustments,
  scenarioId,
  readOnly,
}: {
  adjustments: readonly Adjustment[];
  scenarioId: ScenarioId;
  readOnly: boolean;
}) {
  return (
    <div className="space-y-3">
      {adjustments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-parchment-line bg-surface p-8 text-center">
          <div className="font-heading text-lg text-ink">No adjustments</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-steel">
            {readOnly
              ? "This is the working forecast with no levers applied. Every surface outside the Scenarios group reads Base plus actuals."
              : "No levers yet. Add your first adjustment below to start shaping the forecast tail."}
          </p>
        </div>
      ) : (
        adjustments.map((adj) => {
          const meta = LEVER_META[adj.lever];
          const sub = subDimensionOf(adj);
          const mag = magnitudeOf(adj);
          return (
            <div key={adj.id} className="rounded-xl border border-parchment-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
                <div className="min-w-[14rem]">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-lg text-ink">{meta.label}</span>
                    {sub ? (
                      <span className="rounded-full bg-ember/10 px-2.5 py-0.5 text-xs font-medium text-ember-deep">
                        {sub}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-steel">{meta.blurb}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
                  <Chip label="Magnitude" value={mag.text} tone={mag.tone} />
                  <Chip label="Window" value={windowOf(adj)} tone="muted" />
                  <Chip label="Shape" value={adj.shape === "ramp" ? "Ramp" : "Step"} tone="muted" />
                  <Chip label="Granularity" value="Monthly" tone="muted" />
                </div>
                {!readOnly ? (
                  <form action={removeAdjustmentAction}>
                    <input type="hidden" name="scenarioId" value={scenarioId} />
                    <input type="hidden" name="adjId" value={adj.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-parchment-line px-2.5 py-1 text-xs font-medium text-ember-deep hover:bg-secondary"
                    >
                      Remove
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })
      )}

      {!readOnly ? <AddAdjustmentForm scenarioId={scenarioId} /> : null}
    </div>
  );
}
