<!-- Detailed user guide (generated 2026-06-20 via the budget-scenarios-guide workflow; 9 agents, adversarially fact-checked). Ready to graduate into lib/guides/content.ts (deepens the budgets-and-forecasts + creating-scenarios guides). Lever/validation/baseline/preset names verified against lib/types/scenario.ts; budget snapshot fields against lib/types/statements.ts. -->

slug: budget-and-scenarios
title: Setting up a budget and creating scenarios
summary: Lock your approved plan as a frozen Budget, keep reforecasting Base as the months close, then build contained what-if scenarios off that plan and compare them against Base or Budget.

# Setting up a budget and creating scenarios

Your forecast is only as useful as the plan you measure it against. This guide walks the full planning loop: lock the approved annual plan as your **Budget**, keep reforecasting **Base** as the months close, and then build **scenarios** off that plan to test what-if moves before you commit to them. Budget and scenarios are one continuous workflow, not two separate features. Every number here ties back to the same drivers and the same source data, so what you compare is honest by construction.

## The shape of the workflow

There is a rhythm to planning Bearing's year, and the rest of this guide is these four steps in order:

1. **Build the plan** in the layer-2 drivers (the Forecasts group).
2. **Lock the plan** as your Budget, the frozen yardstick you measure against all year.
3. **Reforecast Base** as each month closes, so your working forecast stays honest while the Budget holds still.
4. **Explore alternatives** as scenarios, contained what-ifs you compare against Base or Budget.

The first three steps are about committing to a plan and tracking against it. The fourth is about asking "what if we did something different?" without disturbing the plan.

For depth on how each driver is built, see the **Budgets and forecasts** guide. This guide assumes you have a working forecast and shows you what to do with it.

## How is Base different from Budget?

Two versions of the forecast run side by side, and the difference between them is the whole point of variance.

- **Base** is the living working forecast. It keeps moving as actuals close each month, and it is the app default: the Dashboard, the Forecasted P&L, and the three statements always show Base plus actuals. When you reforecast, you are moving Base.
- **Budget** is a frozen snapshot of the layer-2 drivers, taken at plan time. Once you lock it, it does not move, even as Base reforecasts. It is the yardstick: the plan you committed to at the start of the year.

You never edit statement lines to set a budget. The Budget captures the **drivers** behind the statements (Revenue Forecast, Personnel, Expense Forecast, and the rest), and the statements roll up from there. Because Base and Budget read the same driver model (one is just frozen), variance is a clean comparison and not two copies of the truth drifting apart.

For Bearing, Base today reflects the closed actuals (Jan 2024 through May 2026), June 2026 in close, and the live forecast for Jul through Dec 2026. The Budget is whatever you locked at the start of FY26, untouched since.

## How do I lock the plan as my budget?

You set the Budget by **locking** a working plan. Get the plan into the shape you want in the Forecasts group, then lock it. Dogfood snapshots the layer-2 drivers as the Budget. Think of the two budget queries as a pair: `lockBudget` is the write that freezes the plan, and `getBudget(period)` is the read that everything else uses to pull the snapshot back.

There are two ways to lock:

- **Lock the current Base forecast.** This is the common path: your approved annual plan is the Base you have been building, so you freeze it as-is.

```
lockBudget({ source: "base", asOf: "2026-01" })
```

- **Promote an approved scenario.** If the plan the board approved lives in a scenario (say a version you tuned in the Scenarios group), promote that scenario's drivers to the Budget instead.

```
lockBudget({ source: "scenario", scenarioId, asOf: "2026-01" })
```

Either way the result is a **`BudgetSnapshot`**: the month it was locked, where it came from (`sourcedFrom: "base"` or `"scenario"`), the horizon it covers, and the snapshot of the P&L lines. Read it back at any period with `getBudget(period)`. The snapshot lives in `budget_snapshots`.

After you lock, the lifecycle is simple: **reforecasting moves Base, never the Budget.** Each month you close actuals and Base updates; the Budget you locked stays exactly where it was, so the gap between them is the story you tell the board. The only way the Budget changes is a deliberate re-lock.

### Worked example: locking Bearing's FY26 budget

1. Build the FY26 plan in the Forecasts group until Revenue Forecast, Personnel, Expense Forecast, and the balance-sheet drivers all read the way the board approved (revenue ramping to about $23.4M, headcount to about 140, an 85% subscription / 15% services mix).
2. Lock it: `lockBudget({ source: "base", asOf: "2026-01" })`. Dogfood freezes the layer-2 drivers as the FY26 Budget.
3. From then on, close each month and let Base reforecast. Open the Forecasted P&L and the Budget column still shows the January plan while the Forecast column tracks where you are headed now.

## Watch Base reforecast as actuals close

Once the Budget is locked, your monthly job is to keep Base honest. As each month closes (Bearing has Jan 2024 through May 2026 closed, June 2026 in close, and Jul through Dec 2026 in forecast), the closed month becomes Actual and Base reforecasts the remaining months off the new reality. Base moves; the Budget you locked does not.

### Where does variance show up?

There is no separate variance module. Variance is the columns on the **Forecasted P&L**, read straight off the locked snapshot:

- **Budget** (the locked snapshot), **Actual** (closed months), **Variance** (the gap), **Forecast** (Base, forward).

The Variance column reads `getBudget(period)` for the plan side and the live statement for the actual and forecast sides, so the comparison ties to the screen. Because Budget reads the snapshot and Forecast reads live Base, the gap is always honest: what you committed to against where you are headed. For the narrative around it, ask Scout: it reads the same columns and explains the drivers behind a variance, with a click-through receipt on every number.

## What drivers does the budget actually snapshot?

The Budget freezes the seven layer-2 drivers in the Forecasts group:

- **P&L drivers:** Revenue Forecast, Cost of Revenue, Personnel, Expense Forecast.
- **Balance-sheet drivers:** AR Forecast, Fixed Asset Budget, Prepaids Budget.

Two things worth remembering when you read them:

- **Cost of Revenue is assembled, not entered.** It is Direct payroll (read from Personnel's Direct-function departments) plus a rate times revenue per stream. You tune the rate, not a CoR line.
- **The two-axis cost model:** every cost has a nature (payroll vs non-payroll, which is how you input it) and a function (Direct/CoR, R&D, S&M, G&A, which is how you present and measure it).

For depth on each driver and how to build them, see the **Budgets and forecasts** guide.

## What is a scenario?

A **scenario** is a what-if version of Bearing's forecast. You build it by stacking a few adjustments on the working plan, then read the result on a contained P&L and dashboard. Scenarios are **dynamic and user-created**: you create, duplicate, and reset your own. The shipped presets are starting points, not a fixed list you are stuck with.

A scenario is about the **shape** of the plan (margin, runway, growth), not about drilling a single number to a transaction.

## Scenarios stay contained (and why that is good)

Scenarios live **only inside the Scenarios group**. Everywhere else, the Dashboard, the three statements, and every Reporting, Sales, and Forecasts surface, always shows Base plus actuals. There is **no global switcher and no top-bar toggle**: the live cockpit never flips into a hypothetical.

This holds because actuals are **shared and immutable**. A scenario can never alter closed history; it branches only the forecast months (for Bearing, Jul through Dec 2026), and only within the four Scenario surfaces. The adjustments themselves are stored as deltas in `scenario_inputs`, layered over Base, so the source plan is never touched.

The trade-off: you cannot drill a scenario number to a source transaction through the rest of the app. That is by design. Scenarios answer "what shape does the plan take if we do X," and for that the contained P&L and dashboard are exactly what you want.

## The adjustment: the building block of a scenario

Every scenario is a small stack of **adjustments**. One adjustment is four parts:

- **Lever** (plus an optional **sub-dimension** that narrows it): what you are changing.
- **Magnitude:** the slider, how much.
- **Time window:** a Start month and an optional End month, at monthly granularity. Most adjustments run start-through-horizon; a bounded one reverts to Base after its End.
- **Shape:** **Step** applies the full change at the Start; **Ramp** phases it in across the window.

Depth comes from **more rules and finer targeting, not per-line month-cell editing.** The slider set stays coarse on purpose. There are two behaviors to keep straight:

- **Rate levers** (revenue growth, DSO, target margin) override the rate inside the window and return to Base outside it.
- **Level levers** (headcount adds, an opex amount) apply their delta inside the window.

### The lever set

The levers are a closed, typed set. There are no free-form levers:

- **Revenue**, by stream (`subscription` or `services`): bookings / growth.
- **Personnel**, by department (optional, so it can be company-wide): hiring pace / adds, plus a hiring **freeze** mode.
- **Expense**, by group (the live OpEx group set, for example **Sales & Marketing** or **IT**): the opex level.
- **Direct cost**: the Cost-of-Revenue rate / target margin.
- **AR DSO**: days sales outstanding.
- **AP DPO**: days payable outstanding (available once AP/DPO planning is turned on).

The Revenue and Expense levers require a sub-dimension (which stream, which group); Personnel's department is optional. The OpEx groups you can target are the live eight: Employee Expenses, Sales & Marketing, Travel & Entertainment, IT, HR, Admin, Facilities, Insurance. Personnel departments are the ten seed departments, tagged by function: Professional Services and Support (Direct/CoR); Engineering and Product & Design (R&D); Sales, Marketing, and Customer Success (S&M); Finance, People, and Ops (G&A).

### How levers stack

- Adjustments on **different levers** apply independently and compose together. A revenue change and a personnel change just both happen.
- When two adjustments hit the **same lever with overlapping windows**, the **later window overrides** the earlier one in the overlap.

The engine is **deterministic**: the same inputs always produce the same result. One operation runs the whole thing: Base plus the scenario's active adjustments for the period, re-derived into the Scenario P&L and Scenario Dashboard. Nothing outside the Scenarios group changes.

And it validates as you go, rejecting bad inputs before they ever reach the P&L:

- An **End before its Start**.
- A **window outside the forecast horizon** (for Bearing, anything outside Jul through Dec 2026).
- A **magnitude past its limit**.
- A **lever that is not in the set**.

You cannot build a scenario that does not compute.

## The four Scenario surfaces

The Scenarios nav group has four surfaces, each a step in the loop:

- **Scenario Manager:** your library. Create, duplicate, and reset scenarios (and Base). No global save-state machinery: a scenario is just its name, its baseline, and its stack of adjustments.
- **Scenario Drivers:** the adjustment board. Stack levers here, each with a slider, a monthly window, and a **Step** or **Ramp** shape.
- **Scenario P&L:** the contained result. Each scenario picks its **comparison baseline**, and a version dropdown sets it.
- **Scenario Dashboard:** the compare / board view. Place two or three scenarios (and Budget) side by side with their KPIs.

### Can I compare against the plan or against the live forecast?

Both, and you choose per scenario. On the Scenario P&L, the version dropdown sets the **baseline** the scenario compares against:

- **Base** (the working forecast): "how does this move change where we are actually headed?"
- **Budget** (the locked snapshot): "how does this move compare to the plan we committed to?"

On the Scenario Dashboard, Budget can be one of the columns alongside your scenarios, so you can line up two what-ifs against the locked plan at once.

## The seed presets

Three presets ship as editable starting points (they are starting points, not part of the model):

- **25% Profit:** levers tuned to a 25% operating profit.
- **Capacity:** a services-capacity-constrained view.
- **Breakeven:** levers tuned to reach breakeven.

Duplicate one to start from a known shape, edit its adjustments, or build a scenario from scratch in the Scenario Manager. The **25% Profit** preset is a good first thing to open: it shows the kind of lever stack (margin and spend moves) that pulls Bearing to a target operating profit, and you can retune it to your own number.

## What if we freeze hiring in Sales for H2?

Here is the full worked example, end to end.

1. In **Scenario Manager**, create a new scenario (or duplicate one to start from a known shape). Name it "Hiring freeze."
2. In **Scenario Drivers**, add one adjustment:
   - **Lever:** Personnel, sub-dimension department **Sales**.
   - **Magnitude:** a hiring **freeze**.
   - **Window:** Start **Aug 2026**, End **Dec 2026** (inside Bearing's Jul through Dec 2026 forecast horizon).
   - **Shape:** **Step** (the freeze applies in full from August).
3. Set the scenario's baseline to **Budget** so you measure the freeze against the plan you committed to.
4. Open **Scenario P&L** to read the contained result: Sales headcount holds flat Aug through Dec, S&M payroll comes in under plan, and operating income and runway shift accordingly. Everything outside the window stays on Base.
5. Open **Scenario Dashboard** to place "Hiring freeze" next to Budget (and the **25% Profit** preset if you want a third column) and read the KPI deltas side by side.

Because the freeze is a single Personnel adjustment in a bounded window, it reverts to Base after December, and nothing outside the Scenarios group changes: the live Dashboard and statements still show Base plus actuals the whole time. If you later add a second Personnel adjustment in Sales with an overlapping window, remember the precedence rule: the later window overrides the earlier one in the overlap.

## Asking Scout in the Scenarios group

Scout's scenario tools, `setDriver` (add or change an adjustment) and `compareScenarios` (line up two or three scenarios against Base or Budget), are scoped to the Scenarios group. There, Scout can build, compare, and explain a scenario's shape for you. Outside the group, Scout's Dashboard, P&L, and statement answers always read Base plus actuals, so a scenario number never leaks into the live cockpit. Every Scout answer carries a click-through receipt, so you can trace any figure it quotes.

## End-to-end SOP checklist

1. **Build the plan.** Set the layer-2 drivers in the Forecasts group until the annual plan reads the way it was approved. (See the Budgets and forecasts guide for driver depth.)
2. **Lock the Budget.** Lock the Base forecast, or promote an approved scenario: `lockBudget({ source: "base", asOf })`. This freezes the layer-2 drivers as your yardstick.
3. **Reforecast Base monthly.** Close each month; Base moves, the Budget does not. Watch the Budget / Actual / Variance / Forecast columns on the Forecasted P&L.
4. **Build scenarios.** In the Scenarios group, create or duplicate a scenario, then stack adjustments (lever + magnitude + window + Step/Ramp) on Scenario Drivers. Mind validation: keep windows inside the forecast horizon and magnitudes within range.
5. **Pick each scenario's baseline.** On Scenario P&L, compare against Base (where you are headed) or Budget (the plan you committed to).
6. **Compare.** On Scenario Dashboard, place two or three scenarios (and Budget) side by side and read the shape: margin, runway, growth. Ask Scout to narrate the differences, with a receipt on every number.
7. **Promote if approved.** If a scenario becomes the new plan, lock it as the Budget with `lockBudget({ source: "scenario", scenarioId, asOf })` and start the loop again.