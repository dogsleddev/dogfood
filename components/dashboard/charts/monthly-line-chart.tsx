import { CHART, niceAxis } from "./palette";
import type { BarMonth } from "./monthly-bar-chart";

export interface LineSeries {
  readonly key: string;
  readonly label: string;
  readonly color: string;
  /** one value per month, in the chart's unit (dollars for money, fraction for percent) */
  readonly values: readonly number[];
}

/**
 * A month-across-columns line chart (one or more series), with the actual portion drawn solid and
 * the forecast portion dashed off the same boundary point. Optional area fill (single series).
 * Pure server-rendered SVG in the brand palette; `id` must be unique per instance (gradient/clip).
 */
export function MonthlyLineChart({
  id,
  months,
  series,
  height = 200,
  area = false,
  kind = "money",
  formatValue,
  formatAxis,
}: {
  id: string;
  months: readonly BarMonth[];
  series: readonly LineSeries[];
  height?: number;
  area?: boolean;
  kind?: "money" | "percent";
  formatValue: (n: number) => string;
  formatAxis: (n: number) => string;
}) {
  const W = 720;
  const H = height;
  const m = { top: 12, right: 16, bottom: 26, left: 50 };
  const pw = W - m.left - m.right;
  const ph = H - m.top - m.bottom;
  const n = months.length || 1;

  const all = series.flatMap((s) => s.values);
  const rawMax = all.length ? Math.max(...all) : 1;
  const rawMin = all.length ? Math.min(...all) : 0;
  // percent zooms to the data; money/area baselines at 0 (distance to zero is meaningful — runway)
  const ax = kind === "percent" ? niceAxis(rawMin, rawMax, 4) : niceAxis(Math.min(0, rawMin), rawMax, 4);
  const rMin = ax.min;
  const rMax = ax.max;
  const span = rMax - rMin || 1;
  const x = (i: number) => m.left + (pw * i) / Math.max(1, n - 1);
  const y = (v: number) => m.top + ph * (1 - (v - rMin) / span);

  const ticks = ax.ticks;
  const fcStart = months.findIndex((mo) => mo.status === "forecast");
  const fcX = fcStart >= 0 ? x(fcStart) : null;
  // boundary index where solid hands off to dashed (last actual/in-close point)
  const splitIdx = fcStart > 0 ? fcStart - 1 : fcStart === 0 ? 0 : n - 1;

  const pts = (vals: readonly number[]) => vals.map((v, i) => [x(i), y(v)] as const);
  const path = (p: readonly (readonly [number, number])[]) =>
    p.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
      <defs>
        {area && series[0] && (
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={series[0].color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={series[0].color} stopOpacity={0} />
          </linearGradient>
        )}
      </defs>

      {fcX !== null && <rect x={fcX} y={m.top} width={W - m.right - fcX} height={ph} fill={CHART.line} opacity={0.25} />}

      {ticks.map((t, i) => (
        <g key={`g-${i}`}>
          <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} stroke={CHART.line} strokeWidth={1} />
          <text x={m.left - 8} y={y(t) + 3} textAnchor="end" fontSize={10} fill={CHART.steel}>
            {formatAxis(t)}
          </text>
        </g>
      ))}

      {series.map((s) => {
        const p = pts(s.values);
        const actual = p.slice(0, splitIdx + 1);
        const forecast = p.slice(splitIdx);
        return (
          <g key={s.key}>
            {area && s === series[0] && actual.length > 1 && (
              <path
                d={`${path(actual)} L${actual[actual.length - 1][0].toFixed(1)},${y(rMin).toFixed(1)} L${actual[0][0].toFixed(1)},${y(rMin).toFixed(1)} Z`}
                fill={`url(#${id}-fill)`}
              />
            )}
            {actual.length > 1 && <path d={path(actual)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
            {forecast.length > 1 && (
              <path d={path(forecast)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" opacity={0.7} />
            )}
            {p.map(([px, py], i) => (
              <g key={i}>
                <title>{`${months[i]?.label ?? ""}${months[i]?.status === "forecast" ? " (forecast)" : ""} · ${s.label}: ${formatValue(s.values[i] ?? 0)}`}</title>
                <circle cx={px} cy={py} r={2.5} fill={s.color} opacity={months[i]?.status === "forecast" ? 0.7 : 1} />
              </g>
            ))}
          </g>
        );
      })}

      {months.map((mo, i) =>
        i % 2 === 0 || i === n - 1 ? (
          <text key={`x-${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill={CHART.steel}>
            {mo.label}
          </text>
        ) : null,
      )}

      {fcX !== null && (
        <line x1={fcX} x2={fcX} y1={m.top} y2={m.top + ph} stroke={CHART.steel} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
      )}
    </svg>
  );
}
