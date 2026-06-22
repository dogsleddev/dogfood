export const meta = {
  name: 'progress-review',
  description: 'Multi-agent review of Dogfood/Bearing progress — strengths, gaps, and ranked suggestions before the next steps',
  whenToUse: 'Run at the start of a session to get a candid, prioritized review of where the build stands before deciding next steps.',
  phases: [
    { title: 'Review', detail: 'four parallel reviewers — seed/data realism · architecture & Scout-readiness · Harness DoD/gaps · product & Run priorities' },
    { title: 'Synthesize', detail: 'rank cross-dimension suggestions, surface risks + open questions for Chris, propose a next-step sequence' },
  ],
}

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    dimension: { type: 'string' },
    summary: { type: 'string', description: '3-5 sentence candid assessment of this dimension' },
    strengths: { type: 'array', items: { type: 'string' } },
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, detail: { type: 'string' }, severity: { type: 'string', enum: ['low', 'medium', 'high'] } },
        required: ['title', 'detail', 'severity'],
      },
    },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          rationale: { type: 'string' },
          effort: { type: 'string', enum: ['S', 'M', 'L'] },
          priority: { type: 'string', enum: ['P0', 'P1', 'P2'] },
        },
        required: ['title', 'rationale', 'effort', 'priority'],
      },
    },
  },
  required: ['dimension', 'summary', 'strengths', 'gaps', 'suggestions'],
}

const SYNTH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overallAssessment: { type: 'string' },
    topSuggestions: {
      type: 'array',
      description: 'ranked, deduped across dimensions',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rank: { type: 'number' },
          title: { type: 'string' },
          why: { type: 'string' },
          effort: { type: 'string', enum: ['S', 'M', 'L'] },
          priority: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          dimension: { type: 'string' },
        },
        required: ['rank', 'title', 'why', 'effort', 'priority'],
      },
    },
    risks: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, detail: { type: 'string' } }, required: ['title', 'detail'] } },
    openQuestionsForChris: { type: 'array', items: { type: 'string' } },
    proposedNextSteps: { type: 'array', items: { type: 'string' } },
  },
  required: ['overallAssessment', 'topSuggestions', 'risks', 'openQuestionsForChris', 'proposedNextSteps'],
}

const COMMON = `You are reviewing the Dogfood (demo company "Bearing") AI-native FP&A project to advise the team (Chris, CFO)
on next steps BEFORE they proceed. Read CLAUDE.md (the authoritative spec) and Handoff.md (current build state) first,
then the code areas named below. Do NOT read archive/ (stale). Ground every point in the actual repo — cite files.
Be candid and useful: surface real gaps and concrete, prioritized suggestions, not praise. Effort S/M/L, priority P0/P1/P2.`

phase('Review')
const dims = [
  {
    key: 'seed-realism',
    prompt: `${COMMON}\n\nDIMENSION: Seed data realism + integrity. Read lib/seed/* (params, subscription, services, personnel,
cost-of-revenue, opex, balance-sheet, gl, transactions, statements, dashboard-metrics) and scripts/data-sweep.ts.
Assess: does Bearing read as a credible high-growth Series B after the recent retune (NRR ~111%, ~$22M, 77/23 mix,
runway ~38mo)? Are the 35 tie-out/reconciliation checks genuinely independent or partly definitional? Is the 13.6k-txn
sub-ledger realistic + useful (vendor bills, paychecks, timesheets/job-costing, invoices, receipts)? What is thin or
fragile — e.g. the first-pass SaaS metric formulas (cac_payback label, NRR cohort, ltv/magic), the name pools, services
job-costing assumptions, the long deferred-funded runway? Suggest improvements.`,
  },
  {
    key: 'architecture',
    prompt: `${COMMON}\n\nDIMENSION: Architecture, the query spine & Scout-readiness. Read lib/datastore/*, lib/queries/*
(incl. registry.ts), lib/types/*, lib/erp/*. Assess against CLAUDE.md §4 (the spine, the six principles, the Scout-ready
bar) and §10 (Scout). Is the spine ready for the Run to wire module surfaces + Scout tools without rework? Are the typed
contracts/seams solid (DataStore, query I/O, the query↔tool registry)? Architectural risks/gaps: queries still
notImplemented, no StatementLine table (the Account Mapping seam points at an enum), absent firm_id multi-tenancy for
the Supabase swap, the GL being monthly-summary vs the sub-ledger. Suggest.`,
  },
  {
    key: 'harness-dod',
    prompt: `${COMMON}\n\nDIMENSION: Harness Definition-of-Done completeness. Review against CLAUDE.md §13 (the DoD) and the
Handoff. Classify each DoD item as genuinely DONE / DECIDED-not-built / gap, cross-checking the Handoff's claims against
the actual code (don't take the Handoff at face value). Is Harness complete enough to start the Run, or should anything
be closed first? Enumerate remaining gaps (guides prose, scenario engine build, metric drill-downs, reporting/sales
queries, Scout tools) and whether any is a blocker.`,
  },
  {
    key: 'product-priorities',
    prompt: `${COMMON}\n\nDIMENSION: Product readiness + Run priorities. Read CLAUDE.md §5-§10 (layers, drilldowns, nav,
scenarios, Scout) and the Handoff "the Run" section. Context: Chris has been asking to SEE monthly statements (P&L/BS/CF,
expense-group breakout, a KPI footer) and a schema/ERD — strong signal he wants these as REAL in-app surfaces, but today
the module UIs are placeholders, lib/queries reporting/sales/scenario throw notImplemented, and the scenarios engine +
Scout tools are unbuilt (the data + sub-ledger exist behind the DataStore). Recommend what the Run should build first and
in what order to get to a demoable product fastest, and which of Chris's requested views to wire first.`,
  },
]
const reviews = (await parallel(dims.map((d) => () => agent(d.prompt, { label: `review:${d.key}`, phase: 'Review', schema: REVIEW_SCHEMA, agentType: 'general-purpose' })))).filter(Boolean)

phase('Synthesize')
const synthesis = await agent(
  `${COMMON}\n\nSYNTHESIS. Four dimension reviews of the project are below as JSON. Produce advice for Chris before the
next steps: an overall assessment of where the build stands, a RANKED list of top cross-dimension suggestions (dedupe
overlaps; each with effort + priority + which dimension), the key risks, the open questions Chris should decide, and a
concrete proposed next-step sequence. Favor the highest-leverage moves toward a demoable product.\n\nREVIEWS:\n${JSON.stringify(reviews)}`,
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTH_SCHEMA, agentType: 'general-purpose' },
)

return { reviews, synthesis }
