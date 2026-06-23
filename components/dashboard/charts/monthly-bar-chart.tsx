import type { MonthStatus } from "@/lib/types/statements";
import { CHART, niceAxis } from "./palette";

export interface BarSeries {
  readonly key: string;
  readonly label: string;
  readonly color: string;
  /** one value per month, in major units (dollars) */
  readonly values: readonly number[];
}

export interface BarMonth {
  readonly label: string;
  readonly status: MonthStatus;
}

/**
 * A month-across-columns bar chart (stacked when given >1 series), sign-aware (negatives drop below
 * the zero baseline), with the actual → forecast split banded: actual months render solid, the
 * in-close month gets a dashed cap, and forecast months are lightened. Pure server-rendered SVG in
 * the brand palette — no charting dependency. Hover shows native tooltips via <title>.
 */
export function MonthlyBarChart({
  months,
  series,
  height = 220,
  formatValue,
  formatAxis,
}: {
  months: readonly BarMonth[];
  series: readonly BarSeries[];
  height?: number;
  formatValue: (n: number) => string;
  formatAxis: (n: number) => string;
}) {
  const W = 720;
  const H = height;
  const m = { top: 10, right: 14, bottom: 26, left: 50 };
  const pw = W - m.left - m.right;
  const ph = H - m.top - m.bottom;
  const n = months.length || 1;
  const band = pw / n;
  const barW = Math.min(36, band * 0.62);

  // stacked extents (positives stack up, negatives down)
  let posMax = 0;
  let negMin = 0;
  months.forEach((_, i) => {
    let pos = 0;
    let neg = 0;
    for (const s of series) {
      const v = s.values[i] ?? 0;
      if (v >= 0) pos += v;
      else neg += v;
    }
    posMax = Math.max(posMax, pos);
    negMin = Math.min(negMin, neg);
  });
  const ax = niceAxis(Math.min(0, negMin), Math.max(0, posMax), 4);
  const rMin = ax.min;
  const rMax = ax.max;
  const span = rMax - rMin || 1;
  const y = (v: number) => m.top + ph * (1 - (v - rMin) / span);
  const xCenter = (i: number) => m.left + band * i + band / 2;
  const y0 = y(0);

  const ticks = ax.ticks;
  const fcStart = months.findIndex((mo) => mo.status === "forecast");
  const fcX = fcStart >= 0 ? m.left + band * fcStart : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
      {/* forecast region shade */}
      {fcX !== null && (
        <rect x={fcX} y={m.top} width={W - m.right - fcX} height={ph} fill={CHART.line} opacity={0.25} />
      )}
      {/* gridlines + y labels */}
      {ticks.map((t, i) => (
        <g key={`g-${i}`}>
          <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} stroke={CHART.line} strokeWidth={1} />
          <text x={m.left - 8} y={y(t) + 3} textAnchor="end" fontSize={10} fill={CHART.steel}>
            {formatAxis(t)}
          </text>
        </g>
      ))}
      {/* zero baseline emphasized when there are negatives */}
      {rMin < 0 && <line x1={m.left} x2={W - m.right} y1={y0} y2={y0} stroke={CHART.steel} strokeWidth={1.25} />}

      {/* bars */}
      {months.map((mo, i) => {
        const cx = xCenter(i);
        const x = cx - barW / 2;
        const isForecast = mo.status === "forecast";
        const isInClose = mo.status === "in_close";
        let posTop = 0; // running stacked positive height
        let negTop = 0;
        return (
          <g key={`m-${i}`} opacity={isForecast ? 0.45 : 1}>
            {series.map((s) => {
              const v = s.values[i] ?? 0;
              if (v === 0) return null;
              let yTop: number;
              let h: number;
              if (v >= 0) {
                const base = y(posTop);
                const top = y(posTop + v);
                yTop = top;
                h = base - top;
                posTop += v;
              } else {
                const base = y(negTop);
                const bottom = y(negTop + v);
                yTop = base;
                h = bottom - base;
                negTop += v;
              }
              return (
                <g key={s.key}>
                  <title>{`${mo.label}${isForecast ? " (forecast)" : isInClose ? " (in close)" : ""} · ${s.label}: ${formatValue(v)}`}</title>
                  <rect x={x} y={yTop} width={barW} height={Math.max(0, h)} rx={2} fill={s.color} />
                </g>
              );
            })}
            {isInClose && (
              <rect
                x={x}
                y={Math.min(y(posTop), y0) - 0}
                width={barW}
                height={Math.max(2, Math.abs(y(posTop) - y0))}
                rx={2}
                fill="none"
                stroke={CHART.ink}
                strokeWidth={1}
                strokeDasharray="2 2"
                opacity={0.5}
              />
            )}
            <text x={cx} y={H - 8} textAnchor="middle" fontSize={10} fill={CHART.steel}>
              {mo.label}
            </text>
          </g>
        );
      })}

      {/* forecast boundary marker */}
      {fcX !== null && (
        <line x1={fcX} x2={fcX} y1={m.top} y2={m.top + ph} stroke={CHART.steel} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
      )}
    </svg>
  );
}
