/**
 * Scout — shared types for the in-app agent (CLAUDE.md §10).
 * Tool-use over lib/queries (zero RAG for structured data). Every tool call produces a
 * RECEIPT (tool + args + a click-through to the surface) so an answer is auditable — the
 * trust mechanism the product sells.
 */

/** A click-through receipt for one tool call: what Scout read, and where to see it. */
export interface ScoutReceipt {
  /** the Anthropic tool name (matches SCOUT_REGISTRY.tool) */
  readonly tool: string;
  /** the resolved args (period, metricId, …) — shown on the chip */
  readonly args: Record<string, string>;
  /** short human label for the chip */
  readonly label: string;
  /** the working-surface route the chip links to (peek/inspect param included where relevant) */
  readonly href: string;
}

export type ScoutRole = "user" | "assistant";

export interface ScoutMessage {
  readonly role: ScoutRole;
  readonly content: string;
}

/** What the agent loop returns to the UI. */
export interface ScoutResponse {
  readonly reply: string;
  readonly receipts: readonly ScoutReceipt[];
  /** "live" = answered by the model loop; "deterministic" = the no-API-key intent-router fallback. */
  readonly mode: "live" | "deterministic";
}

/**
 * One streamed "calculation as it occurs" — emitted the moment Scout reaches for a tool, so the
 * panel can narrate the work live (with playful dog-pun commentary) instead of a static spinner.
 */
export interface ScoutStep {
  /** the tool being called (matches SCOUT_REGISTRY.tool) */
  readonly tool: string;
  /** the playful, human-readable commentary for this step */
  readonly label: string;
}
/** Callback the agent loop calls as each tool fires, so callers can stream the steps. */
export type ScoutOnStep = (step: ScoutStep) => void;

/** The NDJSON event stream the /api/scout endpoint emits: a run of steps, then one final answer. */
export type ScoutStreamEvent =
  | ({ readonly type: "step" } & ScoutStep)
  | ({ readonly type: "final" } & ScoutResponse);
