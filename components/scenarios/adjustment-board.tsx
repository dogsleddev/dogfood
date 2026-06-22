import { formatMoney, formatPercent, usd } from "@/lib/types/money";
import { monthLabel } from "@/lib/types/period";
import type { Adjustment, LeverId } from "@/lib/types/scenario";

/**
 * The Scenario Drivers board, READ-ONLY (CLAUDE.md §9; diagrams/scenario-drivers.svg).
 * Each adjustment is rendered with its anatomy laid bare: lever + sub-dimension + magnitude +
 * monthly window (Start / End) + shape (Step | Ramp). No sliders, no editing — this surface reads
 * the scenario's stacked levers from the contained read API. Sub-dimension ids are slugs from the
 * closed typed lever set, formatted to a readable label here (display only; never a key).
 */

const LEVER_META: Record<LeverId, { label: string; blurb: string }> = {
  revenue: { label: "Revenue", blurb: "bookings / growth, by stream" },
  personnel: { label: "Personnel", blurb: "hiring pace / adds, by department" },
  expense: { label: "Expense", blurb: "opex level, by group" },
  direct_cost: { label: "Direct cost", blurb: "non-employee Cost-of-Revenue rate" },
  ar_dso: { label: "AR · DSO", blurb: "collection speed (days sales outstanding)" },
  ap_dpo: { label: "AP · DPO", blurb: "payment timing (days payable outstanding)" },
};

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

export function AdjustmentBoard({ adjustments }: { adjustments: readonly Adjustment[] }) {
  if (adjustments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-parchment-line bg-surface p-8 text-center">
        <div className="font-heading text-lg text-ink">No adjustments</div>
        <p className="mx-auto mt-1 max-w-md text-sm text-steel">
          Base is the working forecast with no levers applied. Every surface outside the Scenarios
          group reads Base plus actuals. Pick a preset above to see a stacked adjustment board.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {adjustments.map((adj) => {
        const meta = LEVER_META[adj.lever];
        const sub = subDimensionOf(adj);
        const mag = magnitudeOf(adj);
        return (
          <div
            key={adj.id}
            className="rounded-xl border border-parchment-line bg-surface p-5"
          >
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
