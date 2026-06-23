/**
 * The seven User Guides (CLAUDE.md §14). ONE source, two callers: the Setup > User Guides route renders
 * these, and Scout's product-knowledge lane (getProductMap / describeModule) reads them to answer
 * "how do I X" / "what does X do" (no RAG — held in context). Prose drafted in the Run; refine as modules ship.
 */

/**
 * A diagram embedded in a guide. Rendered ONLY by the guides route (app/setup/guides), anchored after
 * an h2 in the body. Scout never sees these — getProductMap / describeModule select only
 * {slug,title,summary,body}, so figures are invisible to the agent (the body stays the single text
 * corpus). Author `svg` as an inline SVG string in the diagrams/ ember/parchment language.
 */
export interface GuideFigure {
  readonly id: string;
  /** the h2 text (without "## ") this figure renders after; matched by slug, case-insensitive */
  readonly afterHeading: string;
  readonly title: string;
  /** one-line caption shown under the figure */
  readonly alt: string;
  /** inline SVG markup (trusted, authored here) */
  readonly svg: string;
}

/** A row in a guide's foot "quick reference" card — a labelled deep-link to a surface. */
export interface GuideQuickRefRow {
  readonly surface: string;
  readonly href: string;
  readonly purpose: string;
}

export interface Guide {
  readonly slug: string;
  readonly title: string;
  /** One sentence Scout can use as a quick answer to "what is this guide about". */
  readonly summary: string;
  /** Markdown body (## headings, lists, bold, inline code). The single source Scout reads. */
  readonly body: string;
  /** Diagrams interleaved into the rendered guide (UI only; never read by Scout). */
  readonly figures?: readonly GuideFigure[];
  /** Optional foot "quick reference" deep-links (UI only). */
  readonly quickRef?: readonly GuideQuickRefRow[];
}

// ── Guide figures (UI-only diagrams in the §19 ember/parchment language; never read by Scout) ──

const GETTING_STARTED_FIGURES: readonly GuideFigure[] = [
  {
    id: "five-layer-model",
    afterHeading: "The five-layer model",
    title: "The five layers — drill down, roll up",
    alt: "Every surface sits in exactly one layer. Reading bottom to top is how a number is built; top to bottom is how you drill into it.",
    svg: `<svg width='100%' viewBox='0 0 720 372' xmlns='http://www.w3.org/2000/svg' font-family='Geist, ui-sans-serif, system-ui, sans-serif'>
  <defs>
    <marker id='fl-down' markerWidth='10' markerHeight='10' refX='5' refY='8' orient='auto'><path d='M1.5,1 L5,8 L8.5,1' fill='none' stroke='#5A6B7A' stroke-width='1.6'/></marker>
    <marker id='fl-up' markerWidth='10' markerHeight='10' refX='5' refY='1' orient='auto'><path d='M1.5,8 L5,1 L8.5,8' fill='none' stroke='#2FA37D' stroke-width='1.6'/></marker>
  </defs>
  <text x='34' y='38' fill='#5A6B7A' font-size='11' text-anchor='middle'>drill</text>
  <line x1='34' y1='52' x2='34' y2='320' stroke='#5A6B7A' stroke-width='1.6' marker-end='url(#fl-down)'/>
  <text x='686' y='38' fill='#2FA37D' font-size='11' text-anchor='middle'>roll up</text>
  <line x1='686' y1='320' x2='686' y2='52' stroke='#2FA37D' stroke-width='1.6' marker-end='url(#fl-up)'/>
  <rect x='70' y='44' width='560' height='52' rx='9' fill='#FBE9E1' stroke='#EC6D3F'/>
  <text x='88' y='70' font-size='14' font-weight='600' fill='#1c2530'>Layer 5 · Summaries</text>
  <text x='88' y='88' font-size='11.5' fill='#5A6B7A'>Dashboard · Board Package</text>
  <rect x='70' y='108' width='560' height='52' rx='9' fill='#FAF0D6' stroke='#B9852A'/>
  <text x='88' y='134' font-size='14' font-weight='600' fill='#1c2530'>Layer 4 · Metrics</text>
  <text x='88' y='152' font-size='11.5' fill='#5A6B7A'>ARR · NRR · Rule of 40 · burn · runway · CAC payback</text>
  <rect x='70' y='172' width='560' height='52' rx='9' fill='#E2F4EC' stroke='#2FA37D'/>
  <text x='88' y='198' font-size='14' font-weight='600' fill='#1c2530'>Layer 3 · Statements</text>
  <text x='88' y='216' font-size='11.5' fill='#5A6B7A'>Forecasted P&amp;L · Balance Sheet · Cash Flow</text>
  <rect x='70' y='236' width='560' height='52' rx='9' fill='#E8F0F6' stroke='#6F93AC'/>
  <text x='88' y='262' font-size='14' font-weight='600' fill='#1c2530'>Layer 2 · Drivers</text>
  <text x='88' y='280' font-size='11.5' fill='#5A6B7A'>Revenue · Cost of Revenue · Personnel · Expense · AR · Fixed · Prepaids</text>
  <rect x='70' y='300' width='560' height='52' rx='9' fill='#EAEDF0' stroke='#5A6B7A'/>
  <text x='88' y='326' font-size='14' font-weight='600' fill='#1c2530'>Layer 1 · Source records</text>
  <text x='88' y='344' font-size='11.5' fill='#5A6B7A'>Pipeline · Contracts · Customers · Renewals · Projects · Staff · Expenses</text>
</svg>`,
  },
  {
    id: "peek-vs-place",
    afterHeading: "Navigating: drill-downs and peek-vs-place",
    title: "Peek where you read, navigate where you work",
    alt: "On the Dashboard and the statements, the first tap peeks the lineage in a side pane. On registers and drivers, a tap navigates straight to detail.",
    svg: `<svg width='100%' viewBox='0 0 720 250' xmlns='http://www.w3.org/2000/svg' font-family='Geist, ui-sans-serif, system-ui, sans-serif'>
  <defs>
    <marker id='pp-a' markerWidth='10' markerHeight='10' refX='8' refY='5' orient='auto'><path d='M1,1 L8,5 L1,9' fill='none' stroke='#C9582E' stroke-width='1.6'/></marker>
    <marker id='pp-b' markerWidth='10' markerHeight='10' refX='8' refY='5' orient='auto'><path d='M1,1 L8,5 L1,9' fill='none' stroke='#5A6B7A' stroke-width='1.6'/></marker>
  </defs>
  <rect x='28' y='34' width='214' height='78' rx='9' fill='#FBFAF6' stroke='#ECE6DB'/>
  <text x='42' y='58' font-size='13' font-weight='600' fill='#1c2530'>Reading surface</text>
  <text x='42' y='76' font-size='11' fill='#5A6B7A'>Dashboard · P&amp;L · BS · CF</text>
  <rect x='42' y='84' width='78' height='20' rx='5' fill='#FBE9E1' stroke='#EC6D3F'/>
  <text x='81' y='98' font-size='11' fill='#C9582E' text-anchor='middle' font-weight='600'>$23.4M</text>
  <line x1='250' y1='73' x2='372' y2='73' stroke='#C9582E' stroke-width='1.6' marker-end='url(#pp-a)'/>
  <text x='311' y='66' font-size='10.5' fill='#C9582E' text-anchor='middle'>first tap = peek</text>
  <rect x='380' y='34' width='312' height='78' rx='9' fill='#FBE9E1' stroke='#EC6D3F'/>
  <text x='396' y='58' font-size='13' font-weight='600' fill='#1c2530'>Right-side peek pane</text>
  <text x='396' y='77' font-size='11' fill='#5A6B7A'>shows the lineage in place</text>
  <text x='396' y='95' font-size='11' fill='#C9582E' font-weight='600'>carries Open full ↗ to the working surface</text>
  <rect x='28' y='140' width='214' height='72' rx='9' fill='#FBFAF6' stroke='#ECE6DB'/>
  <text x='42' y='164' font-size='13' font-weight='600' fill='#1c2530'>Working surface</text>
  <text x='42' y='182' font-size='11' fill='#5A6B7A'>registers · drivers</text>
  <text x='42' y='199' font-size='11' fill='#5A6B7A'>a row of detail</text>
  <line x1='250' y1='176' x2='372' y2='176' stroke='#5A6B7A' stroke-width='1.6' marker-end='url(#pp-b)'/>
  <text x='311' y='169' font-size='10.5' fill='#5A6B7A' text-anchor='middle'>tap a row = navigate</text>
  <rect x='380' y='140' width='312' height='72' rx='9' fill='#EAEDF0' stroke='#5A6B7A'/>
  <text x='396' y='164' font-size='13' font-weight='600' fill='#1c2530'>Detail</text>
  <text x='396' y='185' font-size='11' fill='#5A6B7A'>the row's full record — no pane</text>
  <text x='28' y='234' font-size='10.5' fill='#5A6B7A'>Pure metrics (gross margin, Rule of 40) are pane-only — the pane decomposes them into their component lines.</text>
</svg>`,
  },
  {
    id: "bearing-snapshot",
    afterHeading: "The demo company: Bearing",
    title: "Bearing at a glance · FY2026",
    alt: "An AI-native FP&A SaaS peer: ~$23M revenue, 61% growth, ~140 staff, 85/15 subscription/services, ~49-month runway. Jan 2024–May 2026 closed, June in close, Jul–Dec forecast.",
    svg: `<svg width='100%' viewBox='0 0 720 218' xmlns='http://www.w3.org/2000/svg' font-family='Geist, ui-sans-serif, system-ui, sans-serif'>
  <text x='24' y='30' font-size='12' font-weight='600' fill='#5A6B7A'>The fiscal year (calendar FY)</text>
  <rect x='24' y='42' width='400' height='26' rx='5' fill='#E2F4EC' stroke='#2FA37D'/>
  <text x='224' y='59' font-size='11' fill='#2A8A66' text-anchor='middle'>Actual · closed (Jan 2024 – May 2026)</text>
  <rect x='428' y='42' width='70' height='26' rx='5' fill='#FAF0D6' stroke='#B9852A'/>
  <text x='463' y='59' font-size='10.5' fill='#B9852A' text-anchor='middle'>Jun · close</text>
  <rect x='502' y='42' width='194' height='26' rx='5' fill='#E8F0F6' stroke='#6F93AC'/>
  <text x='599' y='59' font-size='11' fill='#5A6B7A' text-anchor='middle'>Forecast (Jul – Dec 2026)</text>
  <g font-family='Geist, ui-sans-serif, system-ui, sans-serif'>
    <rect x='24' y='96' width='128' height='96' rx='9' fill='#FBFAF6' stroke='#ECE6DB'/>
    <text x='40' y='122' font-size='22' font-weight='600' fill='#1c2530'>~$23M</text>
    <text x='40' y='142' font-size='11' fill='#5A6B7A'>FY26 revenue</text>
    <text x='40' y='172' font-size='13' font-weight='600' fill='#2FA37D'>+61%</text>
    <text x='40' y='186' font-size='10.5' fill='#5A6B7A'>growth</text>
    <rect x='164' y='96' width='128' height='96' rx='9' fill='#FBFAF6' stroke='#ECE6DB'/>
    <text x='180' y='122' font-size='22' font-weight='600' fill='#1c2530'>~140</text>
    <text x='180' y='142' font-size='11' fill='#5A6B7A'>staff (from ~40)</text>
    <text x='180' y='172' font-size='13' font-weight='600' fill='#1c2530'>R&amp;D-heavy</text>
    <text x='180' y='186' font-size='10.5' fill='#5A6B7A'>software org</text>
    <rect x='304' y='96' width='128' height='96' rx='9' fill='#FBFAF6' stroke='#ECE6DB'/>
    <text x='320' y='122' font-size='22' font-weight='600' fill='#1c2530'>85 / 15</text>
    <text x='320' y='142' font-size='11' fill='#5A6B7A'>subscription / services</text>
    <text x='320' y='172' font-size='13' font-weight='600' fill='#1c2530'>606 + WIP</text>
    <text x='320' y='186' font-size='10.5' fill='#5A6B7A'>two revenue models</text>
    <rect x='444' y='96' width='128' height='96' rx='9' fill='#FBFAF6' stroke='#ECE6DB'/>
    <text x='460' y='122' font-size='22' font-weight='600' fill='#1c2530'>~49 mo</text>
    <text x='460' y='142' font-size='11' fill='#5A6B7A'>runway</text>
    <text x='460' y='172' font-size='13' font-weight='600' fill='#2FA37D'>prepay</text>
    <text x='460' y='186' font-size='10.5' fill='#5A6B7A'>funds growth</text>
    <rect x='584' y='96' width='112' height='96' rx='9' fill='#FBE9E1' stroke='#EC6D3F'/>
    <text x='600' y='122' font-size='18' font-weight='600' fill='#C9582E'>Series B</text>
    <text x='600' y='142' font-size='11' fill='#5A6B7A'>~$20M raised</text>
    <text x='600' y='172' font-size='13' font-weight='600' fill='#1c2530'>capital-</text>
    <text x='600' y='186' font-size='10.5' fill='#5A6B7A'>efficient</text>
  </g>
</svg>`,
  },
];

const UPDATING_ACTUALS_FIGURES: readonly GuideFigure[] = [
  {
    id: "control-total",
    afterHeading: "The reconciliation control total",
    title: "How a closed month ties out: detail → trial balance → statements",
    alt: "Each account's sub-ledger detail must sum to its trial-balance total within a small threshold; the trial balance rolls up to the statements. A gap is a blocking flag, never a plug.",
    svg: `<svg width='100%' viewBox='0 0 720 282' xmlns='http://www.w3.org/2000/svg' font-family='Geist, ui-sans-serif, system-ui, sans-serif'>
  <defs>
    <marker id='ct-a' markerWidth='10' markerHeight='10' refX='8' refY='5' orient='auto'><path d='M1,1 L8,5 L1,9' fill='none' stroke='#5A6B7A' stroke-width='1.6'/></marker>
  </defs>
  <text x='24' y='28' font-size='12' font-weight='600' fill='#5A6B7A'>Sub-ledger detail</text>
  <rect x='24' y='38' width='150' height='30' rx='6' fill='#FBFAF6' stroke='#ECE6DB'/><text x='38' y='57' font-size='11.5' fill='#1c2530'>Vendor bills</text>
  <rect x='24' y='74' width='150' height='30' rx='6' fill='#FBFAF6' stroke='#ECE6DB'/><text x='38' y='93' font-size='11.5' fill='#1c2530'>Invoices · receipts</text>
  <rect x='24' y='110' width='150' height='30' rx='6' fill='#FBFAF6' stroke='#ECE6DB'/><text x='38' y='129' font-size='11.5' fill='#1c2530'>Paychecks</text>
  <rect x='24' y='146' width='150' height='30' rx='6' fill='#FBFAF6' stroke='#ECE6DB'/><text x='38' y='165' font-size='11.5' fill='#1c2530'>Timesheets</text>
  <line x1='180' y1='107' x2='250' y2='107' stroke='#5A6B7A' stroke-width='1.6' marker-end='url(#ct-a)'/>
  <text x='215' y='100' font-size='10' fill='#5A6B7A' text-anchor='middle'>Σ per</text>
  <text x='215' y='122' font-size='10' fill='#5A6B7A' text-anchor='middle'>account</text>
  <rect x='256' y='66' width='168' height='84' rx='9' fill='#E8F0F6' stroke='#6F93AC'/>
  <text x='340' y='92' font-size='13' font-weight='600' fill='#1c2530' text-anchor='middle'>Trial balance</text>
  <text x='340' y='112' font-size='11' fill='#5A6B7A' text-anchor='middle'>the account total</text>
  <text x='340' y='132' font-size='11' fill='#5A6B7A' text-anchor='middle'>(the source of truth)</text>
  <g transform='translate(430,92)'>
    <rect x='0' y='0' width='86' height='32' rx='6' fill='#E2F4EC' stroke='#2FA37D'/>
    <text x='43' y='14' font-size='11' fill='#2A8A66' text-anchor='middle' font-weight='600'>= ✓ ties</text>
    <text x='43' y='27' font-size='9' fill='#2A8A66' text-anchor='middle'>within $1 / 0.1%</text>
  </g>
  <line x1='424' y1='108' x2='540' y2='108' stroke='#5A6B7A' stroke-width='1.6' marker-end='url(#ct-a)'/>
  <text x='482' y='130' font-size='10' fill='#5A6B7A' text-anchor='middle'>rolls up</text>
  <rect x='546' y='66' width='150' height='84' rx='9' fill='#FBE9E1' stroke='#EC6D3F'/>
  <text x='621' y='92' font-size='13' font-weight='600' fill='#1c2530' text-anchor='middle'>Statement line</text>
  <text x='621' y='112' font-size='11' fill='#5A6B7A' text-anchor='middle'>P&amp;L · Balance</text>
  <text x='621' y='128' font-size='11' fill='#5A6B7A' text-anchor='middle'>Sheet · Cash Flow</text>
  <rect x='24' y='206' width='672' height='54' rx='9' fill='#FCEFE9' stroke='#EC6D3F'/>
  <text x='40' y='228' font-size='12' font-weight='600' fill='#C9582E'>A gap over the threshold → blocking "needs attention"</text>
  <text x='40' y='248' font-size='11' fill='#5A6B7A'>Never a plug. The one honest fix is upstream: pull the missing entry or correct the mapping, then re-import.</text>
</svg>`,
  },
  {
    id: "close-boundary",
    afterHeading: "The close boundary: Actual, In close, Forecast",
    title: "The close boundary — and how an import moves it",
    alt: "One global as-of date splits every month into Actual, In close, or Forecast. Importing a clean trial balance for the in-close month advances the boundary one month forward.",
    svg: `<svg width='100%' viewBox='0 0 720 218' xmlns='http://www.w3.org/2000/svg' font-family='Geist, ui-sans-serif, system-ui, sans-serif'>
  <defs>
    <marker id='cb-a' markerWidth='10' markerHeight='10' refX='8' refY='5' orient='auto'><path d='M1,1 L8,5 L1,9' fill='none' stroke='#C9582E' stroke-width='1.6'/></marker>
  </defs>
  <text x='24' y='30' font-size='12' font-weight='600' fill='#5A6B7A'>Today</text>
  <rect x='24' y='42' width='372' height='40' rx='6' fill='#E2F4EC' stroke='#2FA37D'/>
  <text x='210' y='66' font-size='12' fill='#2A8A66' text-anchor='middle'>Actual · closed — final, loaded from the ERP</text>
  <rect x='400' y='42' width='80' height='40' rx='6' fill='#FAF0D6' stroke='#B9852A'/>
  <text x='440' y='62' font-size='11' fill='#B9852A' text-anchor='middle'>In close</text>
  <text x='440' y='75' font-size='9' fill='#B9852A' text-anchor='middle'>provisional</text>
  <rect x='484' y='42' width='212' height='40' rx='6' fill='#E8F0F6' stroke='#6F93AC'/>
  <text x='590' y='66' font-size='12' fill='#5A6B7A' text-anchor='middle'>Forecast — your driver assumptions</text>
  <line x1='480' y1='92' x2='480' y2='108' stroke='#C9582E' stroke-width='1.4'/>
  <text x='480' y='104' font-size='9' fill='#C9582E' text-anchor='middle'>↑ the as-of boundary</text>
  <rect x='24' y='120' width='672' height='44' rx='9' fill='#FBFAF6' stroke='#ECE6DB'/>
  <text x='40' y='142' font-size='12' font-weight='600' fill='#1c2530'>Import a clean trial balance for the in-close month</text>
  <text x='40' y='160' font-size='11' fill='#5A6B7A'>It validates (foots), reconciles (control total), then commits — and the boundary rolls forward one month.</text>
  <text x='24' y='190' font-size='11' fill='#5A6B7A'>After June commits</text>
  <rect x='150' y='178' width='90' height='24' rx='5' fill='#E2F4EC' stroke='#2FA37D'/>
  <text x='195' y='194' font-size='10.5' fill='#2A8A66' text-anchor='middle'>Jun → Actual</text>
  <line x1='244' y1='190' x2='286' y2='190' stroke='#C9582E' stroke-width='1.6' marker-end='url(#cb-a)'/>
  <rect x='292' y='178' width='110' height='24' rx='5' fill='#FAF0D6' stroke='#B9852A'/>
  <text x='347' y='194' font-size='10.5' fill='#B9852A' text-anchor='middle'>Jul → in close</text>
</svg>`,
  },
];

const BUDGETS_FORECASTS_FIGURES: readonly GuideFigure[] = [
  {
    id: "drivers-to-statements",
    afterHeading: "What a forecast is in Dogfood",
    title: "How the drivers generate the statements",
    alt: "Set a driver and balanced journal entries post to the GL, which rolls up into the three statements — the same path the seed is generated by, so it ties out by construction.",
    svg: `<svg width='100%' viewBox='0 0 720 168' xmlns='http://www.w3.org/2000/svg' font-family='Geist, ui-sans-serif, system-ui, sans-serif'>
  <defs><marker id='ds-a' markerWidth='10' markerHeight='10' refX='8' refY='5' orient='auto'><path d='M1,1 L8,5 L1,9' fill='none' stroke='#5A6B7A' stroke-width='1.6'/></marker></defs>
  <rect x='16' y='52' width='150' height='62' rx='9' fill='#E8F0F6' stroke='#6F93AC'/>
  <text x='91' y='80' font-size='13' font-weight='600' fill='#1c2530' text-anchor='middle'>Drivers</text>
  <text x='91' y='99' font-size='10.5' fill='#5A6B7A' text-anchor='middle'>your assumptions (L2)</text>
  <line x1='170' y1='83' x2='196' y2='83' stroke='#5A6B7A' stroke-width='1.6' marker-end='url(#ds-a)'/>
  <rect x='200' y='52' width='150' height='62' rx='9' fill='#FBFAF6' stroke='#ECE6DB'/>
  <text x='275' y='80' font-size='13' font-weight='600' fill='#1c2530' text-anchor='middle'>Balanced JEs</text>
  <text x='275' y='99' font-size='10.5' fill='#5A6B7A' text-anchor='middle'>debits = credits</text>
  <line x1='354' y1='83' x2='380' y2='83' stroke='#5A6B7A' stroke-width='1.6' marker-end='url(#ds-a)'/>
  <rect x='384' y='52' width='150' height='62' rx='9' fill='#FBFAF6' stroke='#ECE6DB'/>
  <text x='459' y='80' font-size='13' font-weight='600' fill='#1c2530' text-anchor='middle'>General ledger</text>
  <text x='459' y='99' font-size='10.5' fill='#5A6B7A' text-anchor='middle'>the trial balance</text>
  <line x1='538' y1='83' x2='564' y2='83' stroke='#5A6B7A' stroke-width='1.6' marker-end='url(#ds-a)'/>
  <rect x='568' y='52' width='138' height='62' rx='9' fill='#E2F4EC' stroke='#2FA37D'/>
  <text x='637' y='80' font-size='13' font-weight='600' fill='#1c2530' text-anchor='middle'>Statements</text>
  <text x='637' y='99' font-size='10.5' fill='#5A6B7A' text-anchor='middle'>P&amp;L · BS · CF (L3)</text>
  <text x='16' y='32' font-size='12' font-weight='600' fill='#C9582E'>You edit the driver — never a statement line directly</text>
  <text x='16' y='146' font-size='10.5' fill='#5A6B7A'>The same path the seed itself is generated by, so the forecast ties out by construction.</text>
</svg>`,
  },
  {
    id: "two-axis-cost",
    afterHeading: "The two-axis cost model",
    title: "Two axes: nature (how you input) × function (how you measure)",
    alt: "You enter costs by nature — payroll in Personnel, non-payroll in Expense Forecast — and read them by function. Cost of Revenue is assembled, never typed.",
    svg: `<svg width='100%' viewBox='0 0 720 250' xmlns='http://www.w3.org/2000/svg' font-family='Geist, ui-sans-serif, system-ui, sans-serif'>
  <text x='150' y='30' font-size='11' font-weight='600' fill='#5A6B7A' text-anchor='middle'>Function (how you present &amp; measure) →</text>
  <text x='300' y='52' font-size='11' fill='#2A8A66' text-anchor='middle'>Direct / CoR</text>
  <text x='410' y='52' font-size='11' fill='#5A6B7A' text-anchor='middle'>R&amp;D</text>
  <text x='510' y='52' font-size='11' fill='#5A6B7A' text-anchor='middle'>S&amp;M</text>
  <text x='610' y='52' font-size='11' fill='#5A6B7A' text-anchor='middle'>G&amp;A</text>
  <text x='40' y='100' font-size='11' font-weight='600' fill='#1c2530'>Payroll</text>
  <text x='40' y='116' font-size='10' fill='#5A6B7A'>(Personnel)</text>
  <text x='40' y='170' font-size='11' font-weight='600' fill='#1c2530'>Non-payroll</text>
  <text x='40' y='186' font-size='10' fill='#5A6B7A'>(Expense Fcst)</text>
  <rect x='250' y='72' width='446' height='56' rx='7' fill='#FBFAF6' stroke='#ECE6DB'/>
  <rect x='250' y='72' width='110' height='56' rx='7' fill='#E2F4EC' stroke='#2FA37D'/>
  <text x='305' y='96' font-size='10.5' fill='#2A8A66' text-anchor='middle'>Direct payroll</text>
  <text x='305' y='112' font-size='9.5' fill='#5A6B7A' text-anchor='middle'>→ Cost of Revenue</text>
  <text x='528' y='104' font-size='10.5' fill='#5A6B7A' text-anchor='middle'>Indirect payroll → Operating expenses</text>
  <rect x='250' y='150' width='446' height='56' rx='7' fill='#FBFAF6' stroke='#ECE6DB'/>
  <rect x='250' y='150' width='110' height='56' rx='7' fill='#FCEFE9' stroke='#EC6D3F'/>
  <text x='305' y='174' font-size='10' fill='#C9582E' text-anchor='middle'>rate × revenue</text>
  <text x='305' y='190' font-size='9.5' fill='#5A6B7A' text-anchor='middle'>→ Cost of Revenue</text>
  <text x='528' y='182' font-size='10.5' fill='#5A6B7A' text-anchor='middle'>OpEx groups (S&amp;M, IT, Facilities, …)</text>
  <text x='40' y='234' font-size='10.5' fill='#C9582E'>Cost of Revenue = Direct payroll + rate × revenue — assembled from the green cells, never entered as its own line.</text>
</svg>`,
  },
  {
    id: "base-vs-budget",
    afterHeading: "Base vs Budget",
    title: "Base keeps moving · Budget stays frozen",
    alt: "Budget is a snapshot of the drivers locked at plan time. Base reforecasts every close. Variance is the gap between the moving Base and the frozen Budget.",
    svg: `<svg width='100%' viewBox='0 0 720 220' xmlns='http://www.w3.org/2000/svg' font-family='Geist, ui-sans-serif, system-ui, sans-serif'>
  <line x1='70' y1='30' x2='70' y2='168' stroke='#ECE6DB' stroke-width='1'/>
  <line x1='70' y1='168' x2='690' y2='168' stroke='#ECE6DB' stroke-width='1'/>
  <line x1='70' y1='96' x2='690' y2='96' stroke='#B9852A' stroke-width='2' stroke-dasharray='6 4'/>
  <text x='680' y='90' font-size='11' fill='#B9852A' text-anchor='end' font-weight='600'>Budget — frozen at lock</text>
  <polyline points='70,150 174,140 278,120 382,128 486,104 590,84 690,60' fill='none' stroke='#C9582E' stroke-width='2.5'/>
  <text x='680' y='52' font-size='11' fill='#C9582E' text-anchor='end' font-weight='600'>Base — reforecasts each close</text>
  <line x1='486' y1='96' x2='486' y2='104' stroke='#5A6B7A' stroke-width='6' opacity='0.35'/>
  <text x='486' y='126' font-size='10' fill='#5A6B7A' text-anchor='middle'>variance</text>
  <text x='70' y='190' font-size='10.5' fill='#5A6B7A'>plan time (lock)</text>
  <text x='690' y='190' font-size='10.5' fill='#5A6B7A' text-anchor='end'>horizon</text>
  <text x='70' y='208' font-size='10.5' fill='#5A6B7A'>The Forecasted P&amp;L shows both side by side: Budget · Actual · Variance · Forecast.</text>
</svg>`,
  },
];

const CREATING_SCENARIOS_FIGURES: readonly GuideFigure[] = [
  {
    id: "adjustment-anatomy",
    afterHeading: "The adjustment, the building block",
    title: "Anatomy of one adjustment",
    alt: "Lever (+ sub-dimension) + magnitude + a monthly window + a Step or Ramp shape. Step lands fully at the start; Ramp phases in across the window.",
    svg: `<svg width='100%' viewBox='0 0 720 230' xmlns='http://www.w3.org/2000/svg' font-family='Geist, ui-sans-serif, system-ui, sans-serif'>
  <rect x='16' y='30' width='160' height='58' rx='9' fill='#FBE9E1' stroke='#EC6D3F'/>
  <text x='96' y='54' font-size='12' font-weight='600' fill='#1c2530' text-anchor='middle'>Lever</text>
  <text x='96' y='72' font-size='10' fill='#5A6B7A' text-anchor='middle'>Revenue ▸ subscription</text>
  <rect x='192' y='30' width='150' height='58' rx='9' fill='#FBFAF6' stroke='#ECE6DB'/>
  <text x='267' y='54' font-size='12' font-weight='600' fill='#1c2530' text-anchor='middle'>Magnitude</text>
  <text x='267' y='72' font-size='10' fill='#2A8A66' text-anchor='middle'>+25% (slider)</text>
  <rect x='358' y='30' width='150' height='58' rx='9' fill='#FBFAF6' stroke='#ECE6DB'/>
  <text x='433' y='54' font-size='12' font-weight='600' fill='#1c2530' text-anchor='middle'>Window</text>
  <text x='433' y='72' font-size='10' fill='#5A6B7A' text-anchor='middle'>Aug → Dec (monthly)</text>
  <rect x='524' y='30' width='182' height='58' rx='9' fill='#FBFAF6' stroke='#ECE6DB'/>
  <text x='615' y='54' font-size='12' font-weight='600' fill='#1c2530' text-anchor='middle'>Shape</text>
  <text x='615' y='72' font-size='10' fill='#5A6B7A' text-anchor='middle'>Step or Ramp</text>
  <text x='16' y='124' font-size='11' font-weight='600' fill='#5A6B7A'>Over the forecast window:</text>
  <line x1='60' y1='200' x2='350' y2='200' stroke='#ECE6DB'/>
  <polyline points='60,196 150,196 150,150 350,150' fill='none' stroke='#2FA37D' stroke-width='2.5'/>
  <text x='205' y='142' font-size='10.5' fill='#2A8A66' text-anchor='middle'>Step — full at start</text>
  <line x1='400' y1='200' x2='690' y2='200' stroke='#ECE6DB'/>
  <polyline points='400,196 450,196 690,150' fill='none' stroke='#EC6D3F' stroke-width='2.5'/>
  <text x='545' y='142' font-size='10.5' fill='#C9582E' text-anchor='middle'>Ramp — phases in</text>
</svg>`,
  },
  {
    id: "scenario-contained",
    afterHeading: "Scenarios are contained",
    title: "What a scenario branches — and what it never touches",
    alt: "A scenario only re-derives the forecast months, inside the Scenarios group. Actuals are shared and immutable; the Dashboard and statements always show Base plus actuals.",
    svg: `<svg width='100%' viewBox='0 0 720 210' xmlns='http://www.w3.org/2000/svg' font-family='Geist, ui-sans-serif, system-ui, sans-serif'>
  <rect x='16' y='28' width='340' height='150' rx='10' fill='#FCEFE9' stroke='#EC6D3F'/>
  <text x='32' y='52' font-size='13' font-weight='600' fill='#C9582E'>Inside the Scenarios group</text>
  <text x='32' y='74' font-size='11' fill='#5A6B7A'>The engine re-derives the forecast tail only:</text>
  <rect x='32' y='86' width='150' height='30' rx='6' fill='#fff' stroke='#EC6D3F'/><text x='107' y='105' font-size='11' fill='#1c2530' text-anchor='middle'>Scenario P&amp;L</text>
  <rect x='190' y='86' width='150' height='30' rx='6' fill='#fff' stroke='#EC6D3F'/><text x='265' y='105' font-size='11' fill='#1c2530' text-anchor='middle'>Scenario Dashboard</text>
  <text x='32' y='140' font-size='10.5' fill='#5A6B7A'>Branches the forecast months from your</text>
  <text x='32' y='156' font-size='10.5' fill='#5A6B7A'>stacked adjustments. Create / duplicate / reset.</text>
  <rect x='372' y='28' width='332' height='150' rx='10' fill='#EAEDF0' stroke='#5A6B7A'/>
  <text x='388' y='52' font-size='13' font-weight='600' fill='#1c2530'>Everywhere else — never touched</text>
  <text x='388' y='76' font-size='11' fill='#5A6B7A'>Dashboard · P&amp;L · Balance Sheet · Cash Flow ·</text>
  <text x='388' y='92' font-size='11' fill='#5A6B7A'>Reporting · Sales · Forecasts</text>
  <rect x='388' y='104' width='300' height='30' rx='6' fill='#E2F4EC' stroke='#2FA37D'/>
  <text x='538' y='123' font-size='11' fill='#2A8A66' text-anchor='middle' font-weight='600'>always Base + actuals</text>
  <text x='388' y='156' font-size='10.5' fill='#5A6B7A'>Actuals are shared &amp; immutable — no global switcher.</text>
</svg>`,
  },
];

const READING_STATEMENTS_FIGURES: readonly GuideFigure[] = [
  {
    id: "pnl-two-views",
    afterHeading: "Forecasted P&L",
    title: "Two views of the same lines",
    alt: "A header toggle switches the P&L between FY columns (Budget · Actual · Variance · Forecast) and a Monthly spread; each line's monthly Total reconciles to the FY column.",
    svg: `<svg width='100%' viewBox='0 0 720 210' xmlns='http://www.w3.org/2000/svg' font-family='Geist, ui-sans-serif, system-ui, sans-serif'>
  <text x='20' y='28' font-size='12' font-weight='600' fill='#1c2530'>FY columns (default)</text>
  <rect x='20' y='40' width='320' height='150' rx='9' fill='#FBFAF6' stroke='#ECE6DB'/>
  <text x='36' y='62' font-size='9.5' fill='#5A6B7A'>Line</text>
  <text x='150' y='62' font-size='9.5' fill='#B9852A' text-anchor='middle'>Budget</text>
  <text x='215' y='62' font-size='9.5' fill='#2A8A66' text-anchor='middle'>Actual</text>
  <text x='278' y='62' font-size='9.5' fill='#5A6B7A' text-anchor='middle'>Var</text>
  <text x='325' y='62' font-size='9.5' fill='#C9582E' text-anchor='end'>Fcst</text>
  <line x1='30' y1='70' x2='330' y2='70' stroke='#ECE6DB'/>
  <text x='36' y='90' font-size='10' fill='#1c2530'>Revenue</text><text x='325' y='90' font-size='10' fill='#1c2530' text-anchor='end'>$23.4M</text>
  <text x='36' y='112' font-size='10' fill='#1c2530'>Gross profit</text><text x='325' y='112' font-size='10' fill='#1c2530' text-anchor='end'>$16.6M</text>
  <text x='36' y='134' font-size='10' fill='#1c2530'>Operating inc.</text><text x='325' y='134' font-size='10' fill='#1c2530' text-anchor='end'>−$11.9M</text>
  <text x='36' y='156' font-size='10' fill='#1c2530'>Net income</text><text x='325' y='156' font-size='10' fill='#1c2530' text-anchor='end'>−$11.9M</text>
  <text x='36' y='180' font-size='9' fill='#5A6B7A'>Variance = Forecast − Budget</text>
  <text x='380' y='28' font-size='12' font-weight='600' fill='#1c2530'>Monthly spread</text>
  <rect x='380' y='40' width='320' height='150' rx='9' fill='#FBFAF6' stroke='#ECE6DB'/>
  <rect x='392' y='150' width='150' height='30' fill='#E2F4EC' opacity='0.5'/>
  <text x='467' y='168' font-size='8.5' fill='#2A8A66' text-anchor='middle'>actual (Jan–May)</text>
  <rect x='542' y='150' width='146' height='30' fill='#E8F0F6' opacity='0.6'/>
  <text x='615' y='168' font-size='8.5' fill='#5A6B7A' text-anchor='middle'>forecast (Jun–Dec)</text>
  <polyline points='400,150 425,144 450,138 475,132 500,128 525,120 550,112 575,104 600,96 625,90 650,82 675,72' fill='none' stroke='#EC6D3F' stroke-width='2'/>
  <text x='396' y='60' font-size='10' fill='#5A6B7A'>Revenue, by month →</text>
  <text x='540' y='204' font-size='10' fill='#5A6B7A' text-anchor='middle'>Σ months ties to the FY column</text>
</svg>`,
  },
  {
    id: "statements-tie-out",
    afterHeading: "They tie out by construction",
    title: "Why the three statements reconcile",
    alt: "Net income flows from the P&L to the top of the Cash Flow; the cash-flow net change ties to the Balance Sheet cash line; the Balance Sheet balances. No manual adjustment.",
    svg: `<svg width='100%' viewBox='0 0 720 200' xmlns='http://www.w3.org/2000/svg' font-family='Geist, ui-sans-serif, system-ui, sans-serif'>
  <defs><marker id='ti-a' markerWidth='10' markerHeight='10' refX='8' refY='5' orient='auto'><path d='M1,1 L8,5 L1,9' fill='none' stroke='#2FA37D' stroke-width='1.7'/></marker></defs>
  <rect x='24' y='62' width='180' height='76' rx='10' fill='#FBFAF6' stroke='#ECE6DB'/>
  <text x='114' y='92' font-size='13' font-weight='600' fill='#1c2530' text-anchor='middle'>Forecasted P&amp;L</text>
  <text x='114' y='114' font-size='10.5' fill='#5A6B7A' text-anchor='middle'>… Net income</text>
  <line x1='206' y1='100' x2='266' y2='100' stroke='#2FA37D' stroke-width='1.7' marker-end='url(#ti-a)'/>
  <text x='236' y='92' font-size='9.5' fill='#2A8A66' text-anchor='middle'>NI</text>
  <rect x='270' y='62' width='180' height='76' rx='10' fill='#FBFAF6' stroke='#ECE6DB'/>
  <text x='360' y='88' font-size='13' font-weight='600' fill='#1c2530' text-anchor='middle'>Cash Flow</text>
  <text x='360' y='108' font-size='10.5' fill='#5A6B7A' text-anchor='middle'>NI at top →</text>
  <text x='360' y='124' font-size='10.5' fill='#5A6B7A' text-anchor='middle'>net change in cash</text>
  <line x1='452' y1='100' x2='512' y2='100' stroke='#2FA37D' stroke-width='1.7' marker-end='url(#ti-a)'/>
  <text x='482' y='92' font-size='9.5' fill='#2A8A66' text-anchor='middle'>Δcash</text>
  <rect x='516' y='62' width='180' height='76' rx='10' fill='#E2F4EC' stroke='#2FA37D'/>
  <text x='606' y='88' font-size='13' font-weight='600' fill='#1c2530' text-anchor='middle'>Balance Sheet</text>
  <text x='606' y='108' font-size='10.5' fill='#5A6B7A' text-anchor='middle'>cash line ✓</text>
  <text x='606' y='124' font-size='10' fill='#2A8A66' text-anchor='middle'>Assets = Liab + Equity</text>
  <text x='24' y='40' font-size='12' font-weight='600' fill='#5A6B7A'>One spine, no plugs — every arrow is a query, not a copy</text>
  <text x='24' y='176' font-size='10.5' fill='#5A6B7A'>If a number ever looks off, peek it: the pane shows the same value the working surface holds.</text>
</svg>`,
  },
];

const ASKING_SCOUT_FIGURES: readonly GuideFigure[] = [
  {
    id: "scout-flow",
    afterHeading: "How Scout gets numbers (and why it cannot make one up)",
    title: "How Scout answers — and clicks through",
    alt: "You ask; Scout routes to a typed tool; the tool reads the same query spine the screens call; you get the value plus a clickable receipt to the exact surface. No math, no RAG for numbers.",
    svg: `<svg width='100%' viewBox='0 0 720 168' xmlns='http://www.w3.org/2000/svg' font-family='Geist, ui-sans-serif, system-ui, sans-serif'>
  <defs><marker id='sc-a' markerWidth='10' markerHeight='10' refX='8' refY='5' orient='auto'><path d='M1,1 L8,5 L1,9' fill='none' stroke='#5A6B7A' stroke-width='1.6'/></marker></defs>
  <rect x='14' y='54' width='128' height='60' rx='9' fill='#FBFAF6' stroke='#ECE6DB'/>
  <text x='78' y='80' font-size='12' font-weight='600' fill='#1c2530' text-anchor='middle'>You ask</text>
  <text x='78' y='98' font-size='9.5' fill='#5A6B7A' text-anchor='middle'>"what's our runway?"</text>
  <line x1='146' y1='84' x2='170' y2='84' stroke='#5A6B7A' stroke-width='1.6' marker-end='url(#sc-a)'/>
  <rect x='174' y='54' width='128' height='60' rx='9' fill='#FBE9E1' stroke='#EC6D3F'/>
  <text x='238' y='80' font-size='12' font-weight='600' fill='#1c2530' text-anchor='middle'>Scout routes</text>
  <text x='238' y='98' font-size='9.5' fill='#C9582E' text-anchor='middle'>picks a typed tool</text>
  <line x1='306' y1='84' x2='330' y2='84' stroke='#5A6B7A' stroke-width='1.6' marker-end='url(#sc-a)'/>
  <rect x='334' y='54' width='150' height='60' rx='9' fill='#E8F0F6' stroke='#6F93AC'/>
  <text x='409' y='80' font-size='12' font-weight='600' fill='#1c2530' text-anchor='middle'>The query spine</text>
  <text x='409' y='98' font-size='9.5' fill='#5A6B7A' text-anchor='middle'>same fns the screens call</text>
  <line x1='488' y1='84' x2='512' y2='84' stroke='#5A6B7A' stroke-width='1.6' marker-end='url(#sc-a)'/>
  <rect x='516' y='54' width='190' height='60' rx='9' fill='#E2F4EC' stroke='#2FA37D'/>
  <text x='611' y='80' font-size='12' font-weight='600' fill='#1c2530' text-anchor='middle'>Answer + receipt ↗</text>
  <text x='611' y='98' font-size='9.5' fill='#2A8A66' text-anchor='middle'>clicks through to the surface</text>
  <text x='14' y='34' font-size='12' font-weight='600' fill='#C9582E'>No math, no RAG for numbers — one source, two callers</text>
  <text x='14' y='146' font-size='10.5' fill='#5A6B7A'>The figure it quotes is the figure on the page, every time — and you can audit it from the receipt.</text>
</svg>`,
  },
];

const FLUX_FIGURES: readonly GuideFigure[] = [
  {
    id: "flux-three-altitudes",
    afterHeading: "The three altitudes you can annotate",
    title: "One note, three altitudes, one card",
    alt: "A flux note pins to a transaction, an account, or a statement line — and all three roll up to the same card on the statement line, so a note written at any altitude is visible from above.",
    svg: `<svg width='100%' viewBox='0 0 720 210' xmlns='http://www.w3.org/2000/svg' font-family='Geist, ui-sans-serif, system-ui, sans-serif'>
  <defs><marker id='fx-a' markerWidth='10' markerHeight='10' refX='5' refY='2' orient='auto'><path d='M1,8 L5,2 L9,8' fill='none' stroke='#C9582E' stroke-width='1.6'/></marker></defs>
  <rect x='20' y='150' width='190' height='44' rx='8' fill='#EAEDF0' stroke='#5A6B7A'/>
  <text x='115' y='170' font-size='11' font-weight='600' fill='#1c2530' text-anchor='middle'>Transaction</text>
  <text x='115' y='185' font-size='9.5' fill='#5A6B7A' text-anchor='middle'>one vendor bill · txn id</text>
  <rect x='265' y='150' width='190' height='44' rx='8' fill='#E8F0F6' stroke='#6F93AC'/>
  <text x='360' y='170' font-size='11' font-weight='600' fill='#1c2530' text-anchor='middle'>Account</text>
  <text x='360' y='185' font-size='9.5' fill='#5A6B7A' text-anchor='middle'>trial balance · code + period</text>
  <rect x='510' y='150' width='190' height='44' rx='8' fill='#FAF0D6' stroke='#B9852A'/>
  <text x='605' y='170' font-size='11' font-weight='600' fill='#1c2530' text-anchor='middle'>Statement line / metric</text>
  <text x='605' y='185' font-size='9.5' fill='#5A6B7A' text-anchor='middle'>line + period</text>
  <line x1='115' y1='148' x2='300' y2='92' stroke='#C9582E' stroke-width='1.5' marker-end='url(#fx-a)'/>
  <line x1='360' y1='148' x2='360' y2='92' stroke='#C9582E' stroke-width='1.5' marker-end='url(#fx-a)'/>
  <line x1='605' y1='148' x2='420' y2='92' stroke='#C9582E' stroke-width='1.5' marker-end='url(#fx-a)'/>
  <rect x='250' y='40' width='220' height='48' rx='10' fill='#FBE9E1' stroke='#EC6D3F'/>
  <text x='360' y='62' font-size='13' font-weight='600' fill='#C9582E' text-anchor='middle'>One note card</text>
  <text x='360' y='80' font-size='10' fill='#5A6B7A' text-anchor='middle'>rolls up to the statement line</text>
  <text x='20' y='28' font-size='12' font-weight='600' fill='#5A6B7A'>Anchor to immutable ERP data wherever it exists — txn first, then account, then line</text>
</svg>`,
  },
];

const GETTING_STARTED_QUICKREF: readonly GuideQuickRefRow[] = [
  { surface: "Dashboard", href: "/dashboard", purpose: "The live cockpit — tap any KPI tile to peek its lineage" },
  { surface: "Forecasted P&L", href: "/statements/pnl", purpose: "Budget · Actual · Variance · Forecast, with charts" },
  { surface: "Scenario Manager", href: "/scenarios/manager", purpose: "Build a contained what-if from driver sliders" },
  { surface: "Data Import", href: "/setup/data-import", purpose: "Close a month — the detail-to-trial-balance control total" },
  { surface: "Ask Scout", href: "/dashboard", purpose: "The in-app agent — launches from the bottom of the rail" },
];

export const GUIDES: readonly Guide[] = [
  {
    slug: "getting-started",
    figures: GETTING_STARTED_FIGURES,
    quickRef: GETTING_STARTED_QUICKREF,
    title: "Getting started",
    summary: "An orientation to Dogfood: what it is (AI-native FP&A built on a living forecast that ties out), the demo company Bearing, the five-layer data model and how the nav maps to it, how to navigate with drill-downs and peek-vs-place, and where to go next.",
    body: "## What Dogfood is\n\nDogfood is an AI-native FP&A platform for strategic finance. Where accounting tools close the books and look backward, Dogfood looks forward: it plans off a clean close and helps you steer. The short version of the category is plan-to-perform. You get a living forecast, scenarios in minutes, statements that tie out, and an agent that works the same numbers you do.\n\nThree ideas hold the product together:\n\n- **A living forecast.** Actuals close month by month, and the forecast rolls forward off them. The current period default is always the working forecast plus closed actuals.\n- **Statements that tie out.** Every number traces to a source. The Dashboard's Revenue tile equals the P&L's Total Revenue because both read the same data, not two copies of it.\n- **One spine, two callers.** Both the screens you read and Scout, the in-app agent, read through the same typed functions, so they never disagree.\n\n## The demo company: Bearing\n\nDogfood runs on Bearing, a B2B AI-native FP&A SaaS company with a services and implementation arm. Bearing is roughly $23M revenue in FY26 with about 140 staff, on a calendar fiscal year. January 2024 through May 2026 is closed, June 2026 is in close, and July through December 2026 is forecast. Bearing sells mostly subscription with a smaller services mix, so its model shows both 606 ratable revenue and capacity-driven services delivery.\n\n## The five-layer model\n\nEverything in Dogfood sits in exactly one of five layers. Reading them bottom to top is how a number is built; reading top to bottom is how you drill into it.\n\n1. **Source records** are the atoms: Pipeline, Contracts, Customers, Renewals, Projects, Staff, Expense Transactions.\n2. **Drivers** are the forward assumptions that generate the forecast: Revenue Forecast, Cost of Revenue, Personnel, Expense Forecast, AR, Fixed Asset, Prepaids.\n3. **Statements** are the tie-out: Forecasted P&L, Balance Sheet, Cash Flow Forecast.\n4. **Metrics** are the derived analytics: ARR, NRR, Rule of 40, burn, runway, CAC payback, and the profitability set. These surface through the Dashboard.\n5. **Summaries** are the roll-ups: Dashboard and Board Package.\n\nWrapped around these are Scenarios (a what-if lens over layers 2 to 5), Scout (a guide across all layers), and Setup (configuration).\n\n## How the nav maps to it\n\nThe left rail groups follow the layers:\n\n- **Overview** (Dashboard, Board Package) is layer 5.\n- **Financial Statements** (Forecasted P&L, Balance Sheet, Cash Flow Forecast) is layer 3.\n- **Reporting** (Projects, Staff, Expense Transactions) and **Sales** (Pipeline, Contracts, Customers, Renewals) are layer 1 source records.\n- **Forecasts** (Revenue Forecast, Cost of Revenue, Personnel, Expense Forecast, AR, Fixed Asset, Prepaids) are layer 2 drivers.\n- **Scenarios** (Manager, Drivers, P&L, Dashboard) is the what-if lens, contained to its own group.\n- **Setup** (Data Import, Account Mapping, Settings, User Guides) is configuration.\n\n## Navigating: drill-downs and peek-vs-place\n\nStart at the Dashboard, the live cockpit. Its tiles drill down through the layers and roll back up the same path, so you can move from a summary number to the driver or record behind it and back again.\n\nHow a number opens depends on where you are:\n\n- **On the statements** (the reading surfaces), the first tap on a number opens a right-side pane that shows its lineage in place. This is a peek. The pane carries an Open full link that takes you to the working surface behind it.\n- **On the Dashboard**, the first tap on a tile opens the same right-side peek pane, carrying an Open full link to the metric or statement behind it.\n- **On working surfaces** (registers and drivers), tapping a row navigates straight to detail.\n\nThe rule is: peek where you read, navigate where you work. On the reading surfaces, closed months peek their register and forecast months peek their driver. Pure derived metrics like gross margin have no register, so their pane drills into the lines that compose them.\n\n## Scout\n\nScout is the AI agent built into Dogfood. It reads the same query spine the screens do, so it answers with numbers that tie out and can walk any drill chain in either direction. Launch it from the button at the bottom of the nav rail; it opens as a floating panel in the lower right. Scout is in-app only.\n\n## Where to go next\n\nSix more guides go deeper:\n\n- **Budgets and forecasts** for the drivers and the locked budget snapshot.\n- **Updating actuals** for how the close rolls the forecast forward.\n- **Creating scenarios** for the what-if levers.\n- **Reading the statements** for the P&L, Balance Sheet, and Cash Flow.\n- **Creating a flux analysis** for explaining each month's variances with durable notes.\n- **Asking Scout** for getting the most from the agent.",
  },
  {
    slug: "budgets-and-forecasts",
    figures: BUDGETS_FORECASTS_FIGURES,
    title: "Budgets & forecasts",
    summary: "How Dogfood's layer-2 drivers (Revenue, Cost of Revenue, Personnel, Expense, AR/Fixed Asset/Prepaids) generate the forecast that rolls up to the statements, the two-axis cost model, and how Base differs from the locked Budget snapshot used for variance.",
    body: "## What a forecast is in Dogfood\n\nDogfood builds your forecast the same way it generates its own books: forward assumptions (drivers) produce balanced entries that roll up into the three statements. Set the drivers and the Forecasted P&L, Balance Sheet, and Cash Flow Forecast move with them. You never edit a statement line directly. You edit the driver behind it.\n\nDrivers are the **layer-2** surfaces under **Forecasts** in the nav. There are seven, in two families. (You can view all seven driver pages now; editing the assumptions on them lands with the write path. The descriptions below are how they work, and the forecast they describe flows through the statements today.)\n\n## The P&L drivers\n\n- **Revenue Forecast** owns both revenue streams. Subscription forecast is **contracted revenue (read from Contracts) plus a new-business and retention assumption**, recognized ratably under 606 with the deferred waterfall and ARR. It does not re-derive contracted revenue, it reads it (one source, two callers). Services revenue is **capacity-driven**: percent complete plus unbilled WIP, and implementation capacity gates SaaS go-lives. For Bearing the mix runs roughly 85% subscription, 15% services in FY26.\n- **Cost of Revenue** is **assembled, not entered**. It equals Direct Payroll (read from Personnel's Direct-function departments) plus a **rate times revenue** per stream (subscription hosting and inference cost as a percent of subscription revenue, services pass-through). The rate is the only new input here, and it is what the Direct-cost scenario lever moves.\n- **Personnel** is payroll **by department and function tag**. You plan base comp and headcount by department; each department carries a function (Direct, R&D, S&M, or G&A). Payroll burden (taxes, medical, benefits) lives in the Employee Expenses OpEx group, not here.\n- **Expense Forecast** is **non-payroll OpEx only**, organized by group (Employee Expenses, Sales and Marketing programs, Travel and Entertainment, IT, HR, Admin, Facilities, Insurance). The group set comes from Account Mapping, so defining a group there makes it appear here.\n\n## The balance-sheet drivers\n\n- **AR Forecast** is DSO-driven. The receivables balance feeds the Balance Sheet AR line, and its month-over-month change feeds the cash-flow change-in-AR.\n- **Fixed Asset Budget** holds capex and the depreciation schedule (which becomes the D&A line on the P&L).\n- **Prepaids Budget** holds prepaid amortization.\n\n## The two-axis cost model\n\nEvery cost has two attributes:\n\n- **Nature** is how you input it: payroll (Personnel) or non-payroll (Expense Forecast).\n- **Function** is how you present and measure it: Direct/CoR, R&D, S&M, or G&A.\n\nYou enter costs by nature and by department or group. You read them by function via the function tag. Cost of Revenue is assembled from Direct-function payroll plus the rate, never typed as its own line. This is why the P&L shows only Direct vs Indirect payroll while the functional metrics (CAC, magic number, R&D as a percent of revenue) can still reassemble a full functional view.\n\n## Base vs Budget\n\nThere are two versions of the forecast, and the difference matters.\n\n- **Base** is the living working forecast. It keeps moving as actuals close each month, and it is the app default. The Dashboard, P&L, and statements always show Base plus actuals.\n- **Budget** is a **frozen snapshot of the drivers** taken at lock time. It is the approved annual plan and the yardstick for variance. Once locked it does not move, even as Base reforecasts.\n\nThe Forecasted P&L shows **Budget, Actual, Variance, and Forecast** columns side by side. Variance is those columns, not a separate module.\n\n## Setting the Budget\n\nYou set the Budget by **locking** a working plan. Lock the current Base forecast and Dogfood snapshots the layer-2 drivers as the Budget (`lockBudget`). After that, reforecasting moves Base and leaves the Budget untouched, so variance stays an honest comparison against the plan you committed to. The Forecasted P&L shows the locked snapshot driving its Budget and Variance columns, with a **Reset to plan** control that re-freezes the current plan. (Locking and resetting the Base plan are live; promoting an approved scenario into the Budget lands with the scenario write path.)\n\n## Asking Scout\n\nScout reads these same driver queries, so you can ask \"why is Cost of Revenue up versus budget\" or \"what is driving the services revenue ramp\" and get an answer that ties to the screen. Scenario variants of these questions are answered inside the Scenarios group.",
  },
  {
    slug: "updating-actuals",
    figures: UPDATING_ACTUALS_FIGURES,
    title: "Updating actuals",
    summary: "How closed-month actuals enter Dogfood from the ERP and import templates, how the in-app importer parses, validates, and reconciles a trial balance (the detail-to-TB control total) and advances the close, how the close boundary splits months into Actual, In close, and Forecast, and how Account Mapping routes the data onto every statement.",
    body: "## What \"updating actuals\" means\n\nActuals are the real, recorded results for months that are done. Dogfood reads them so every statement can show what happened next to what you plan. Dogfood does not run the close itself. It reads a clean close from your ERP and plans forward off it. Think of it as plan-to-perform sitting downstream of record-to-report: the books get closed somewhere else, then Dogfood pulls the closed numbers in.\n\n## Where actuals come from\n\nEvery data domain **batch-imports from its system of record** via a CSV/XLSX template, upserting on a stable id. The in-app importer is **live** on Setup > Data Import: it parses a trial-balance CSV, validates it (the trial balance must foot), reconciles the detailed sub-ledgers up to it, and on a clean new month advances the close. The templates in `import-templates/` are the contract it fills.\n\n- **The ERP** feeds the financials: chart of accounts, the trial balance, and journal entries for each closed period. Statements are trial-balance-driven, and the transaction sub-ledger reconciles up to the trial balance.\n- **The CRM** feeds customers, contracts, and pipeline; **the HRIS** feeds staff; **AP** feeds vendors and bills.\n- Forward-looking data (forecasts, scenarios, planned hires) and the Account Mapping are **Dogfood-native**: you set them here, they are not imported.\n\nA **live API connection** to any of these source systems (Salesforce, Rippling, your ERP) is on the roadmap, behind the same seam. It would replace the CSV step without changing anything downstream, because the CSV template is exactly the contract a connector fills. There is no single privileged connector: any domain can graduate from CSV to a live feed later.\n\nWhen new actuals land, the trial balance and journal entries for the closed period flow through the DataStore into `lib/queries`, so the UI and Scout read the same numbers.\n\n## The close boundary: Actual, In close, Forecast\n\nEvery month sits in one of three states, set by the close boundary (the global as-of date). The boundary advances when you import a clean new-month trial balance on Setup > Data Import. For Bearing (FY26, calendar fiscal year):\n\n- **Actual (closed):** January 2024 through May 2026. The books are closed, actuals are loaded, these numbers are final.\n- **In close:** June 2026. The period is being closed in the ERP. Numbers are still settling, so treat them as provisional until the close finishes.\n- **Forecast:** July through December 2026. Driven by your assumptions in the Forecasts modules, not by recorded actuals.\n\nThe boundary is config, not hardcoded. As June closes, it becomes Actual and the in-close marker advances to the next month. That roll-forward is how actuals \"update\": the wall between recorded and planned moves one month later each close. Advancing the boundary is **live**: import a clean new-month trial balance on Data Import and, once it reconciles, Dogfood commits the month and rolls the as-of forward one month. A re-import of an already-closed month is a restatement that leaves the boundary where it is.\n\n## The reconciliation control total\n\nThe **trial balance is the single source of truth** for the statements: the Actual columns roll up from the GL at the account grain, which is the trial balance, and it balances on its own (never a plug). On import, Dogfood runs a **detail-to-trial-balance reconciliation** on Setup > Data Import. For every account that has a sub-ledger (expenses to vendor bills, services revenue to timesheets, payroll to paychecks, receivables to invoices and receipts), it checks that the detailed transactions sum to the trial-balance figure within a small materiality threshold, and shows a control total per account rolled up to its statement line. Accounts with no sub-ledger (equity, deferred revenue, depreciation, cash, taxes, and subscription revenue recognized ratably) are authoritative straight from the trial balance, so they never throw a false variance. A gap over the threshold is a blocking **needs attention** flag. It is never plugged or force-balanced: the one honest fix is upstream, pull the missing entry or correct the mapping, then re-import. A clean reconcile is what lets a new month commit and advance the close. You can also ask Scout \"are the books reconciled?\" and it reads the same control total.\n\n## How Account Mapping routes the data\n\nRaw actuals arrive at the GL-account level. **Account Mapping** (Setup > Account Mapping) is the map from each GL account to its statement line. It is **editable and load-bearing**: re-point an account to a different statement line and the Actual columns on the P&L, Balance Sheet, and Cash Flow roll up through your edit (a field-level override that survives re-import and can be **Reset to the default chart**); you can also edit an expense account's classification and function tags, which are descriptive (they do not move statement totals). Re-points stay within the account's own section and nature (revenue to revenue, Cost of Revenue to Cost of Revenue, OpEx to OpEx, asset to asset, liability to liability), so Net Income, Gross Profit, and Assets-equal-Liabilities-plus-Equity always hold; subtotal, equity, and below-the-line lines are not targets. The statement engine and every drill-down read this map. When a JE or trial-balance row comes in, its account decides where it lands on the P&L, Balance Sheet, and Cash Flow.\n\nAccount Mapping also owns expense-group membership (which GL accounts roll into Sales & Marketing, IT, Facilities, and the other OpEx groups), and each group carries a typed classification (Cost of Revenue vs OpEx) plus a function role (Direct, R&D, S&M, G&A). Map an account correctly once and it reports correctly everywhere. If an actual lands on the wrong line, the fix is almost always in Account Mapping, not in the data.\n\n## How statements show Actual next to Forecast\n\nEvery statement renders all months on one timeline and bands them by state. Closed months show Actual, the in-close month is flagged as provisional, and future months show Forecast. The Forecasted P&L carries Budget, Actual, Variance, and Forecast columns so you read recorded results against the plan in one place. The Forecasted P&L's monthly view (`?view=monthly`) shades each column by state so the Actual-to-Forecast split is visible at a glance.\n\nWhen you peek a number (the first tap on the reading surfaces), an Actual month opens its source register, while a Forecast month opens its driver. Same spine, different side of the boundary.\n\n## What Dogfood does not do\n\nDogfood does not post journal entries or run the accounting close, those live in the ERP. What it does run is the **detail-to-trial-balance reconciliation control total** described above, a back-check that the imported close ties out before it drives the statements. Dogfood reads the closed result, proves the detail explains it, maps it, and plans forward. Keep your close clean in the ERP and the actuals tie out here by construction.\n",
  },
  {
    slug: "creating-scenarios",
    figures: CREATING_SCENARIOS_FIGURES,
    title: "Creating scenarios",
    summary: "How to build and compare what-if plans in Dogfood's contained Scenarios group using stacked driver adjustments, without changing the Base forecast the rest of the app shows.",
    body: "## What a scenario is\n\nA scenario is a what-if version of Bearing's forecast. You build it by stacking a few adjustments on top of the working plan, then read the result on a contained P&L and dashboard. Scenarios answer questions like \"what if we freeze hiring in Sales through year-end\" or \"what if subscription growth ramps 25% from August.\"\n\n(You can view the Scenarios group now: the four surfaces and a real deterministic engine are live, running the seed presets. Creating, duplicating, editing, resetting, and deleting your own scenarios is live in Scenario Manager and Scenario Drivers, and your work persists.)\n\nScenarios are **dynamic**: you create, duplicate, and reset your own. They are not a fixed list. Three seed presets ship as starting points, covered at the end.\n\n## Scenarios are contained\n\nScenarios live **only inside the Scenarios group**. Everywhere else in Dogfood (Dashboard, Forecasted P&L, Balance Sheet, Cash Flow, every Reporting, Sales, and Forecasts surface) always shows **Base plus actuals**, never a scenario.\n\nThere is **no global scenario switcher** and no top-bar toggle. Actuals are shared and immutable, so a scenario can never alter closed history. The only thing a scenario branches is the forecast months, and only within the four Scenario surfaces.\n\nThe trade-off: you cannot drill a scenario number out to a source transaction through the rest of the app. Scenarios are about the shape of the plan (margin, runway, growth), not about tracing a hypothetical to a line item.\n\n## The adjustment, the building block\n\nEvery scenario is a stack of adjustments. One adjustment is:\n\n- **Lever** plus an optional **sub-dimension** that narrows it (which driver you are moving).\n- **Magnitude**, set with a slider (how much you move it).\n- **Time window**: a **Start** month and an optional **End** month, at **monthly** granularity. Most adjustments run start-through-horizon. Bounded ones revert to Base after the End.\n- **Shape**: **Step** (the full change lands at Start) or **Ramp** (the change phases in across the window).\n\nThe window behaves by lever type. **Rate** levers (growth, DSO, target margin) override the rate inside the window and return to Base outside it. **Level** levers (headcount, opex amount) apply their delta inside the window.\n\n## The lever set\n\nThe levers are a closed, typed set. There are no free-form levers.\n\n- **Revenue**, by stream (subscription or services): bookings and growth.\n- **Personnel**, by department: hiring pace and adds, plus a hiring **freeze** mode.\n- **Expense**, by group (the live OpEx group set, for example Sales and Marketing or IT): the opex level.\n- **Direct cost / target margin**: the Cost-of-Revenue rate.\n- **AR DSO**: days sales outstanding.\n- **AP DPO**: days payable outstanding — defined in the model but gated off for now, so it is not yet an editable lever.\n\n## How levers stack\n\nYou can stack several adjustments in one scenario, and they compose. Adjustments on **different** levers apply independently. When two adjustments hit the **same** lever with **overlapping** windows, the **later window overrides** the earlier one in the overlap. The engine is deterministic about this, so the same inputs always produce the same result.\n\nThe engine validates and rejects bad inputs: an End before its Start, a window outside the forecast horizon, a magnitude past its limit, or a disallowed lever.\n\n## The four surfaces\n\nThe Scenarios group has four pages:\n\n- **Scenario Manager**: create, duplicate, and reset scenarios and Base. Your library of scenarios lives here. There is no global save-state machinery.\n- **Scenario Drivers**: the adjustment board. Stack your levers here, each a slider plus a monthly window plus Step or Ramp.\n- **Scenario P&L**: the contained result. Each scenario picks its comparison baseline. **Base** is the working forecast that keeps moving as actuals close. **Budget** is the locked plan snapshot. A version dropdown lets you set the comparison.\n- **Scenario Dashboard**: the compare and board view. Place two or three scenarios (and Budget) side by side with their KPIs.\n\n## The seed presets\n\nThree example bundles ship in the seed as starting points, computed by the engine and viewable now, and you can create, duplicate, and edit your own alongside them:\n\n- **25% Profit**: levers tuned to hit a 25% operating profit.\n- **Capacity**: a services-capacity-constrained view.\n- **Breakeven**: levers tuned to reach breakeven.\n\nThese are presets, not part of the model. Duplicate one to start from a known shape, edit it, or ignore them and build from scratch.",
  },
  {
    slug: "reading-the-statements",
    figures: READING_STATEMENTS_FIGURES,
    title: "Reading the statements",
    summary: "How to read Dogfood's three financial statements (Forecasted P&L, Balance Sheet, Cash Flow Forecast), including the P&L's Budget/Actual/Variance/Forecast columns and FY-vs-monthly views, the peek-vs-place drill interaction, and how the statements tie out by construction.",
    body: "## What the statements are\n\nDogfood carries the three financial statements under **Financial Statements** in the nav: **Forecasted P&L**, **Balance Sheet**, and **Cash Flow Forecast**. They are layer 3 in the five-layer model, the tie-out layer that the drivers roll up into and the metrics and summaries read back down from.\n\nThese are **reading surfaces**. You read here and drill out to where you work. For Bearing, the columns span the FY2026 arc: actuals through May 2026, June in close, and Jul through Dec on forecast.\n\n## Forecasted P&L\n\nThe P&L carries four columns: **Budget · Actual · Variance · Forecast**.\n\n- **Budget** is the locked snapshot of the layer-2 drivers, the approved annual plan, frozen and immutable.\n- **Actual** is closed-period results read from the ERP actuals, rolled up to each line through Account Mapping. Re-pointing an account in Setup > Account Mapping moves where its actuals land (Forecast and Budget are unaffected).\n- **Forecast** is the working forecast (Base), which keeps moving as months close.\n- **Variance** is Forecast minus Budget, colored by whether the line is better high (revenue, margins) or better low (costs).\n\nThe line layout is fixed: Revenue (Subscription, Services, Total Revenue), Cost of Revenue (Direct Payroll, Non-employee Cost of Revenue, Total CoR), **Gross Profit and Gross Margin %**, then Operating Expenses (Indirect Payroll, Employee Expenses, the OpEx groups, Stock-Based Comp, Depreciation & Amortization, Total OpEx), **Operating Income and Operating Margin %**, then Interest/Other and Taxes down to **Net Income and Net Margin %**.\n\n### Two views: FY columns vs Monthly\n\nA toggle in the header switches the P&L between two layouts:\n\n- **FY columns** is the default: the four Budget/Actual/Variance/Forecast columns described above.\n- **Monthly** spreads every line across the months of the fiscal year, actuals through May, June in close, Jul through Dec forecast, with each line's Total reconciling back to the FY Forecast column. The monthly board view also shows a strip of headline KPIs (revenue, growth, gross margin %, net margin %, NRR, Rule of 40, magic number, runway).\n\n## Balance Sheet\n\nThe Balance Sheet is point-in-time, shown at the close (Actual) and at fiscal-year end (Forecast). It carries cash, accounts receivable, unbilled WIP, prepaids, fixed assets, the ROU lease asset, deferred revenue, accounts payable, the lease liability, paid-in capital, and accumulated deficit. **Assets equal liabilities plus equity by construction.** A header **FY/Monthly** toggle (`?view=monthly`) also spreads the Balance Sheet across the months of the fiscal year, each column a month-end snapshot that ties back to the FY-end balance.\n\n## Cash Flow Forecast\n\nThe Cash Flow uses the **indirect method**: it starts from Net Income, adds back non-cash items (depreciation, stock-based comp), walks the working-capital deltas (change in AR, deferred revenue, unbilled WIP, prepaids, AP), foots to **Operating Cash Flow**, then nets capex and financing to the net change in cash. A **runway strip** at the top shows cash on hand, net burn per month (TTM), and runway in months. A header **FY/Monthly** toggle (`?view=monthly`) spreads the Cash Flow across the months too, where each line's monthly flows sum (telescope) to the FY total.\n\n## Peek vs Place\n\nThe core interaction rule: **peek where you read, navigate where you work.**\n\n- On the **reading surfaces** (Dashboard and the three statements), the **first tap on a number opens a right-side pane** that shows the line's lineage in place. The pane carries **Open full ↗** to jump to the working surface.\n- On **working surfaces** (registers, drivers), tapping a row navigates directly to detail. No pane.\n\nWhich working surface Open full goes to depends on the period:\n\n- **Actual months peek their register** (layer 1): subscription opens Contracts, services opens Projects, payroll opens Expense Transactions.\n- **Forecast months peek their driver** (layer 2): subscription and services open Revenue Forecast, payroll opens Personnel, Non-employee CoR opens Cost of Revenue.\n\n**Pure derived metrics are pane-only.** Gross Profit, Operating Income, and Net Income have no register or driver to open, so their pane decomposes them into the component lines instead (Gross Profit = Total Revenue minus Total Cost of Revenue, and so on). This is the one exception to peek-then-navigate. The pane is addressed by a URL param (`?inspect=<line>`); there is no pane within a pane.\n\n## They tie out by construction\n\nBecause the seed is generated drivers to JEs to GL to statements, the statements reconcile by construction, not by manual adjustment:\n\n- Subtotals foot to their sections.\n- **Net Income on the P&L ties to the top of the Cash Flow.**\n- The Cash Flow net change in cash ties to the Balance Sheet cash line.\n- The Balance Sheet balances (assets = liabilities + equity).\n- AR and AP aging foot to their statement lines.\n\nIf a number ever looks off, peek it, the pane shows the same value the working surface holds, because both call the same query.",
  },
  {
    slug: "asking-scout",
    figures: ASKING_SCOUT_FIGURES,
    title: "Asking Scout",
    summary: "Scout is Dogfood's in-app AI agent that answers number and how-to questions by calling the same typed query functions the screens use, so every figure it returns matches the page and is backed by a checkable receipt.",
    body: "## What Scout is\n\nScout is the AI agent built into Dogfood. You launch it from the **Ask Scout** button at the bottom of the left nav rail. It opens as a floating panel in the lower-right corner of the app and stays with you as you move between screens. Scout is **in-app only**. There is no Slackbot and no email or Slack alerting. Everything Scout does, both answers and any nudges, happens inside the app.\n\n## How Scout gets numbers (and why it cannot make one up)\n\nScout does not do its own math. For any figure, it calls the **same typed query functions the screens call**, reads the value those functions return, and reports it. This is the \"one source, two callers\" rule: the Dashboard, the P&L, and Scout all read through `lib/queries/`, so a number Scout gives you matches the number on the page exactly. Scout uses tool-use over this query spine with zero retrieval (zero RAG) for structured data, so it never pattern-matches a financial figure from text and never estimates. If a value is not computed by the spine, Scout does not have it.\n\n## The two lanes\n\nScout answers in two distinct lanes.\n\n- **Numbers.** Scout calls a query tool such as `getCashFlow`, `getPnL`, `getMetric`, `getBalanceSheet`, or `getDashboard`, then reports what it returns. Period is always explicit, so the answer is tied to a month, not an implicit \"now.\"\n- **How-tos.** \"How do I X\" and \"what does X do\" are answered from these User Guides plus the nav map. This is the only place retrieval is used, and only over help text, never over your financial data.\n\n## Receipts\n\nEvery numeric answer carries a **receipt**: Scout shows which tool it called and the arguments it used (for example `getMetric(\"gross_margin\", \"2026-05\")`), rendered as a tool-call chip with a result card. The receipt clicks through to the matching surface, so you land on the exact screen the number came from. Receipts make a wrong-tool answer legible: if Scout reached for the wrong query, you can see it in the chip and correct course, rather than trusting an opaque reply.\n\n## Walking the drilldown chains\n\nBecause every link between layers is a typed query, Scout can walk any drill chain in **either direction**. Ask it to go down (\"what's behind this gross margin number\") and it steps from the metric to the P&L lines to the drivers to source records. Ask it to roll up (\"how does this contract affect ARR\") and it climbs back the other way. Scout's tools expand only as modules ship, so it can never answer from data a screen would not show.\n\n## Scenario questions are contained\n\nScout can **read** the saved scenarios: list them, pull one scenario's P&L against its baseline, and compare two or three side by side. It works only inside the **Scenarios group**, so the Dashboard, P&L, and statements always read Base plus actuals and a scenario number never leaks into your live cockpit answers. Scout can also **build** a contained what-if for you: it creates or duplicates a scenario, sets the driver lever(s), and reads the result — still group-scoped, never touching Base or the actuals. Ask \"model what if we freeze hiring from August\" or \"duplicate the 25% Profit scenario and bump growth,\" and Scout drives the engine and quotes its numbers; the writes are attributed to you and undoable. You can still build one by hand in the Scenario Manager and Scenario Drivers.\n\n## Explaining variances\n\nScout reads and writes **flux notes** — the durable, authored explanations on a closed-month variance. Ask \"why did Sales & Marketing run over in May?\" and Scout narrates the variance and shows the budget-vs-actual breakdown; tell it to \"add a note on account 6200 that this is the Q3 campaign pull-forward\" and it records the note, attributed to you, with an Undo on the receipt. The dedicated guide is **Creating a flux analysis**.\n\n## Example questions\n\n- \"What is our runway?\" (calls the cash and efficiency metric, reports the value with a receipt)\n- \"Why did gross margin move from April to May?\" (drills the P&L into Cost of Revenue and Personnel)\n- \"What does the Cost of Revenue module do?\" (how-to, answered from the guides)\n- \"How do I create a scenario?\" (how-to, points you to the Scenarios group)\n- \"Show me our top expansion customers this quarter\" (walks Customers and Renewals)\n- \"What's our forecast revenue for Q4?\" (calls the revenue forecast for the named periods)\n\nWhen in doubt, ask in plain English. Scout picks the tool, shows the receipt, and you can always click through to confirm.",
  },
  {
    slug: "creating-a-flux-analysis",
    figures: FLUX_FIGURES,
    title: "Creating a flux analysis",
    summary: "How to explain each month's variances with durable, authored notes pinned to the immutable actuals: where variances live, the three altitudes you can annotate through one shared note card, the budget-vs-actual table, and how Scout reads and writes flux notes for you.",
    body: "## What a flux analysis is, and why you do it\n\nA flux analysis is the monthly discipline of explaining your variances. After a month closes, you compare what actually happened to what you planned, find the lines that moved more than they should have, and write down why. That \"why\" is the real deliverable: the note a board member, an auditor, or you six months from now reads sitting right next to the number.\n\nDogfood does not run the close. It reads a clean close from your ERP. The trial balance gives the account totals, the sub-ledger gives the transaction detail, and the statements are already built and tied out before you sit down. Flux changes none of that. You are not recomputing anything and you are not editing the actuals. You are explaining numbers that are already on the screen, and every note traces back to the source it explains.\n\nYou flux on **closed** months. For Bearing, January 2024 through May 2026 is closed (Actual), June 2026 is in close (provisional), and July through December 2026 is Forecast. Most flux work lands on the last fully closed month, which today is **May 2026**.\n\n## Where the variances live\n\nYou do not hunt for variances; they are already on the statements.\n\n- The **Forecasted P&L** carries four columns per line: **Budget**, **Actual**, **Variance**, and **Forecast**. On the statement columns, Variance is Forecast minus Budget, your full-year read against the locked plan.\n- The header **Monthly** toggle (`?view=monthly`) spreads every line across the months. This is where you find the single month a line jumped, which is what you want for closed-month flux.\n- The **Balance Sheet** and **Cash Flow** show period-over-period movement, so you can flux a balance that swung as easily as an expense that ran hot.\n\nEverything ties out by construction: each statement line traces down to its accounts, and each account down to its transactions, so any variance can be drilled to the source that caused it.\n\n## The three altitudes you can annotate\n\nA note pins to the exact grain that explains the variance. There are three, and all three roll up to the statement line for display, so a note written at any altitude is visible from the line above it.\n\n- **Transaction.** A single vendor bill from the sub-ledger, anchored on its `transaction_id`. Use this when one bill explains the move.\n- **Account (trial balance).** A trial-balance account, anchored on `account_code` plus period. The account code is a GL code from your chart of accounts (Sales & Marketing is `6200`, IT is `6400`). Use this to explain the account's move for the month without singling out one bill.\n- **Statement line or metric.** Anchored on the statement line plus period. Use this for a line that aggregates several accounts, or for a **pure computed metric** with no account or transaction underneath it (Gross Profit, Gross Margin %, Operating Income, Net Margin %). A pure metric is pane-only: it decomposes into its component lines and you note the line.\n\nThe rule of thumb: anchor to immutable ERP data wherever it exists. Reach for the `transaction_id` first, then the `account_code`, and use the line or metric grain only when nothing concrete sits beneath it. Whatever altitude you choose, the note carries its statement line, so it always knows where to roll up.\n\n## One card, three ways in\n\nWherever a number can move, there is one shared note card: the same editor and the same comment thread no matter how you open it.\n\n- From a **summary line**: tap a number on a statement and the right-hand peek pane opens with the note card in it (`?inspect=<line>`).\n- From an **account**: open the Account Mapping view and pick the account (`?note=<code>`).\n- From a **transaction**: open a row on the Expense Transactions register and a right-hand card slides out (`?note=<id>`).\n\nBecause it is one card, a note you write at one altitude shows up at the others. A transaction note **rolls up** onto its account's card and its statement line's card; a line note is **carried down** and shown on the transactions beneath it. One write, surfaced everywhere. A small **note marker** appears on any line or row that already carries a note, so you can see at a glance what has been explained and what has not.\n\n## Peek where you read, navigate where you work\n\nThe card behaves a little differently by surface, by design.\n\n- On **reading surfaces** (the Dashboard and the three statements), the first tap on a number opens the right-hand peek pane. It shows the lineage in place and carries an **Open full** link to the working surface. Actual months peek their register, forecast months peek their driver, and pure metrics decompose into the lines that compose them.\n- On **working surfaces** (registers and Account Mapping), a row navigates straight to detail, and the note card opens beside it.\n\n## Writing a note\n\nA note is your first write surface in Dogfood, and it is a layer on top of immutable data. The transactions come from your ERP sub-ledger and the account totals from the trial balance; Dogfood never edits either one. Your note points at that data with a stable key, the same delta-off-Base pattern Dogfood uses for scenarios.\n\nNotes are a **comment thread**, not a single field. You can stack many comments on one anchor as the explanation develops or as a reviewer signs off. Each comment carries:\n\n- **`body`**: the explanation you write.\n- **`author`**: the user who wrote it (for Bearing, Max · Chief Barking Officer, read from settings). Dogfood never invents the author.\n- **`source`**: either `ui` (you typed it on a card) or `scout` (Scout wrote it for you).\n- **`amount_at_note`**: a snapshot of the figure when you wrote the comment, so the note remembers what it was explaining.\n- **`resolved`** and a created timestamp.\n\n**Resolve is anchor-level.** Flipping Resolve signs off that the variance is explained, not that one comment is done. Every comment can be edited, resolved, or deleted from its card, and **Delete is always available**. Because the underlying actuals are immutable, deleting or editing a note never touches a transaction or a statement figure: you are only ever editing your own explanation.\n\n## The budget-vs-actual table\n\nAlongside the notes thread, the card (and Scout) can show a decomposition table from `getFluxDetail`, a sibling read to `getFluxNotes`. The table shows what is driving a line before you write the note, so when nothing is explained yet, the table leads.\n\nIts columns are **Item**, **Actual**, **Forecast**, **Budget**, and **Variance**. Keep one distinction straight: in this table **Variance is Actual minus Budget**, whereas the P&L statement column is Forecast minus Budget. The table is Actual versus Budget because flux is on a closed month, where the actual is the truth.\n\n- **Matched rows**, where both sides exist on a shared dimension (an account or an expense group), show every column plus variance, sorted by variance descending so the biggest overspend is on top. A matched account row drills to its transactions.\n- **Unmatched rows** show on their own lines with blank cells: an actual with no budget line, or a budget item with no spend.\n\nMatched plus unmatched rows sum to the line, so the table totals tie to the statement line you peeked.\n\n## How notes stay durable\n\nBecause a note keys on a stable ERP id (or on line plus period), never on a row's position or page, it stays attached through a re-import. `amount_at_note` snapshots the figure at write time, so if a restatement moves the number the card shows you it changed and you can flux the flux instead of staring at a silently stale comment. If a re-import removes the transaction a note was pinned to, the note is flagged **orphaned / needs re-review**, never silently dropped. (The re-import and restatement flow itself arrives with the importer; the note model is already built to survive it.)\n\n## Asking Scout\n\nScout launches from the button at the bottom of the nav rail and opens as a floating panel in the lower right. It reads the same spine you do, and every answer carries a click-through **receipt**. For flux, Scout both reads and writes.\n\n### Scout reads the variance\n\nAsk Scout why something moved and it does two things at once: it calls `getFluxNotes` to narrate the variance and quote any note already on it, and `getFluxDetail` to show the decomposition. So \"why is Sales & Marketing over budget in May?\" returns the overage, any reviewer note, and the breakdown that explains it. To see your open worklist, ask \"what's still unexplained this month?\" and Scout lists the material variances with no resolved note.\n\n### Scout writes a note\n\n`addFluxNote` is Scout's first write. Tell Scout what to record and where (\"for account `6200`, add a note that the S&M overage is the Q3 campaign pull-forward\") and it resolves the anchor, derives the statement line through Account Mapping, writes the comment, and stamps it with **`author` = you** and **`source` = `scout`**. It writes immediately, with no pre-confirm prompt (this is your own single-tenant data), and shows a receipt with **Undo**, **View note**, and **Delete**. One firm rail: Scout may add, resolve, undo, or delete the note it just wrote, but never edits or deletes a comment written by another author. Name the closed month in your request (\"for May 2026, note that...\") so the note lands on the period you mean.\n\n## The monthly flux checklist\n\nWork this list each time a month closes (for Bearing, the last closed month, May 2026 today):\n\n- **Set the period** to the last closed month and point your statement views and the Expense Transactions register at it.\n- **Scan the P&L on Monthly** for lines that moved beyond your materiality threshold; start with operating expenses, then Cost of Revenue.\n- **Scan the Balance Sheet and Cash Flow** for material period-over-period swings and flag those too.\n- **Peek each material variance and read the table first**, so `getFluxDetail` shows you the biggest matched overspend and any unmatched rows.\n- **Drill to the right altitude** and pin the note where the explanation lives: the transaction if one bill explains it, the account if the whole account moved, the line or metric if nothing is stored beneath it.\n- **Write the why and resolve it** with enough detail that a board member or auditor needs no follow-up; a line is complete when every material variance on it has a resolved note.\n- **Ask Scout for the gaps** (\"what's still unexplained this month?\") and clear anything it lists before you close the review.\n\nWhen the worklist is empty and every material variance carries a resolved note, your flux for the month is complete, and every number on the statements traces to both a source and a reason.",
  },
];

export const GUIDE_SLUGS: readonly string[] = GUIDES.map((g) => g.slug);
export const getGuide = (slug: string): Guide | undefined => GUIDES.find((g) => g.slug === slug);
