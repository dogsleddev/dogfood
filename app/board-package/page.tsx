import { getBoardPackage, getPnL, getBalanceSheet, getCashFlow } from "@/lib/queries";
import { month, monthLabel } from "@/lib/types/period";
import { BoardHeadline } from "@/components/board-package/board-headline";
import { BoardStatementsSummary } from "@/components/board-package/board-statements-summary";
import { BoardKpiSection } from "@/components/board-package/board-kpi-grid";

const PERIOD = month(2026, 6);

/**
 * Board Package (CLAUDE.md §8, layer 5) — the exportable monthly/quarterly deliverable. COMPOSED, not
 * recomputed: getBoardPackage assembles the live Dashboard summary into metric-family sections (every
 * figure === its Dashboard tile), and the three-statements summary reads the live getPnL /
 * getBalanceSheet / getCashFlow series (the same tying-out source the statement pages render). Read-only.
 */
export default async function BoardPackagePage() {
  const [board, pnl, balanceSheet, cashFlow] = await Promise.all([
    getBoardPackage(PERIOD),
    getPnL(PERIOD),
    getBalanceSheet(PERIOD),
    getCashFlow(PERIOD),
  ]);

  const allTiles = board.sections.flatMap((s) => s.tiles);

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Overview · Summaries · Layer 5
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Board Package</h1>
          <span className="text-sm text-steel">FY2026 · as of {monthLabel(board.period)}</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          The exportable monthly board deliverable. Headline KPIs, the three-statements summary, and
          the full metric set by family. Every figure is composed from the live spine — the KPI tiles
          are the Dashboard&apos;s, and the statement lines read the same tying-out source as the
          statement pages, so the package reconciles by construction.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 font-heading text-xl text-ink">Headline</h2>
        <BoardHeadline tiles={allTiles} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-heading text-xl text-ink">Financial statements summary</h2>
        <BoardStatementsSummary pnl={pnl} balanceSheet={balanceSheet} cashFlow={cashFlow} />
      </section>

      {board.sections.map((s) => (
        <BoardKpiSection key={s.title} title={s.title} tiles={s.tiles} />
      ))}
    </div>
  );
}
