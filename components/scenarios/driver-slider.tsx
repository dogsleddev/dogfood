"use client";
import { useState, useTransition } from "react";
import { usd, formatMoney } from "@/lib/types/money";
import { setAdjustmentMagnitudeAction } from "@/app/scenarios/drivers/actions";

/**
 * A FreightClose-style driver slider for a scenario adjustment's magnitude (CLAUDE.md §9). Drag to
 * shape the value live; on release it commits via the Server Action (which validates + re-runs the
 * engine, so the Scenario P&L / Dashboard recompute). Range-bounded to the validator's lever rails,
 * so a drag never rejects. Read-only for Base/presets (shows the position, no commit).
 */
export type SliderKind = "rate" | "level" | "absolute";

interface SliderConfig {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly fmt: (uiValue: number) => string;
  /** UI units → stored magnitude value */
  readonly toStored: (uiValue: number) => number;
  /** stored magnitude value → UI units */
  readonly fromStored: (stored: number) => number;
  /** the "Base" reference shown below, or null if not meaningful (absolute targets) */
  readonly baseline: number | null;
  readonly tone: "signed" | "neutral";
}

const fmtPct = (p: number) => (p === 0 ? "0%" : `${p > 0 ? "+" : ""}${p}%`);
const fmtMoneyDelta = (d: number) =>
  d === 0 ? "$0/mo" : `${d > 0 ? "+" : "−"}${formatMoney(usd(Math.abs(d)), { compact: true })}/mo`;
const fmtDays = (d: number) => `${d} days`;

// Bounds mirror lib/scenario/validation.ts (RATE_LIMIT 0.5, LEVEL_LIMIT $5M, DAYS 0–180).
const CONFIG: Record<SliderKind, SliderConfig> = {
  rate: { min: -50, max: 50, step: 1, fmt: fmtPct, toStored: (n) => n / 100, fromStored: (s) => Math.round(s * 100), baseline: 0, tone: "signed" },
  level: { min: -5_000_000, max: 5_000_000, step: 25_000, fmt: fmtMoneyDelta, toStored: (n) => n, fromStored: (s) => s, baseline: 0, tone: "signed" },
  absolute: { min: 0, max: 180, step: 1, fmt: fmtDays, toStored: (n) => n, fromStored: (s) => s, baseline: null, tone: "neutral" },
};

const COMMIT_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

export function DriverSlider({
  scenarioId,
  adjId,
  kind,
  stored,
  label,
  disabled,
}: {
  scenarioId: string;
  adjId: string;
  kind: SliderKind;
  stored: number;
  label: string;
  disabled?: boolean;
}) {
  const cfg = CONFIG[kind];
  const [v, setV] = useState(() => cfg.fromStored(stored));
  const [pending, start] = useTransition();

  const commit = () => {
    if (disabled) return;
    start(async () => {
      await setAdjustmentMagnitudeAction({ scenarioId, adjId, value: cfg.toStored(v) });
    });
  };

  const toneClass =
    cfg.tone === "neutral" ? "text-ink" : v > 0 ? "text-sage-deep" : v < 0 ? "text-ember-deep" : "text-steel";

  return (
    <div className="min-w-[12rem]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-wider text-steel/70">{label}</span>
        <span className={`text-sm font-semibold tabular-nums ${toneClass}`}>
          {cfg.fmt(v)}
          {pending ? <span className="ml-1 font-normal text-steel/60">· saving…</span> : null}
        </span>
      </div>
      <input
        type="range"
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        value={v}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={(e) => {
          if (COMMIT_KEYS.has(e.key)) commit();
        }}
        className="mt-2 h-1.5 w-full cursor-pointer accent-[#EC6D3F] disabled:cursor-default disabled:opacity-60"
      />
      {cfg.baseline !== null ? (
        <div className="mt-1 text-xs text-steel/60">Base: {cfg.fmt(cfg.baseline)}</div>
      ) : (
        <div className="mt-1 text-xs text-steel/60">absolute target</div>
      )}
    </div>
  );
}
