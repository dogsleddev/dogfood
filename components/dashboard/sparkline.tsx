/** A tiny inline-SVG trend line (no charting dependency). Colors via currentColor. */
export function Sparkline({
  points,
  className,
  width = 72,
  height = 22,
}: {
  points: readonly number[];
  className?: string;
  width?: number;
  height?: number;
}) {
  if (!points || points.length < 2) return null;
  const pad = 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = (width - pad * 2) / (points.length - 1);
  const coords = points
    .map((p, i) => {
      const x = pad + i * step;
      const y = pad + (height - pad * 2) * (1 - (p - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <polyline
        points={coords}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
