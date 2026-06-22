# Connector mapping — Salesforce → Dogfood

A worked example of how a source system feeds Dogfood. **Today** you export Salesforce reports to the
CSV templates (`customers.csv`, `contracts.csv`, `pipeline.csv`); **the target** is a live Salesforce
connector (API, scheduled or real-time) that writes the same upserts behind the `DataStore` seam — so
no one exports or re-keys anything. The CSV template *is* the contract the connector fills; this doc
is the field map either path uses.

## Scope — what Salesforce owns (and what it doesn't)

Salesforce is the source of record for the **sales / bookings** domain only:

- **Account → `customers`** · **Opportunity (open) → `pipeline`** · **Opportunity (closed-won) /
  Contract → `contracts`**.

It does **not** carry the financial actuals — recognized revenue, deferred, AR, cash. Those come from
**billing / the ERP** (the trial balance + the sub-ledger). Salesforce tells you *what was sold* (ARR
bookings + the funnel); the close tells you *what was earned and collected*. Keep the seam clean: a
contract's `arr` is a Salesforce fact; its recognized revenue is an ERP fact.

## The upsert key

Every record upserts on the Salesforce **18-char Id** (or a dedicated `External_Id__c`). Re-syncing
updates the existing row and adds new ones — never duplicates, never re-keys. That id becomes the
Dogfood record `id`.

## Account → `customers`

| Salesforce (Account) | → `customers` | Transform / notes |
|---|---|---|
| `Id` / `External_Id__c` | `id` | upsert key |
| `Name` | `name` | |
| `Segment__c` (picklist) | `segment` | Enterprise→`scale`, Mid-Market→`growth`, SMB→`starter` (see picklist maps) |
| earliest closed-won / `First_Won_Date__c` | `start_month` | date → `YYYY-MM` |
| derived from contract status | `status` | `active` unless every contract is churned → `churned` |
| `ARR__c` (roll-up) | `arr` | numeric; sum of active subscription ARR |

## Opportunity (open) → `pipeline`

| Salesforce (Opportunity) | → `pipeline` | Transform / notes |
|---|---|---|
| `Id` | `id` | upsert key |
| `Account.Name` | `customer_name` | |
| `RecordType` / product line | `stream` | `subscription` or `services` |
| `StageName` (picklist) | `stage` | map → `lead`/`qualified`/`proposal`/`negotiation`/`closed_won`/`closed_lost` |
| `ARR__c` or `annualize(Amount)` | `arr` | `Amount` is often TCV — use the ARR field or annualize |
| `Owner.Name` | `owner` | |
| `CloseDate` | `expected_close` | date → `YYYY-MM` |
| `Probability` | `probability` | `/100` → 0–1 |

Only **open** opportunities sync to pipeline; `closed_won` graduates to `contracts`, `closed_lost`
drops out.

## Opportunity (closed-won) / Contract → `contracts`

| Salesforce | → `contracts` | Transform / notes |
|---|---|---|
| `Id` (Opportunity or Contract) | `id` | upsert key (`C-` prefix optional) |
| `AccountId` | `customer_id` | join → `customers.id` |
| `Account.Name` | `customer_name` | denormalised for display |
| `RecordType` / product line | `stream` | `subscription` / `services` |
| `Plan_Tier__c` | `plan_tier` | `starter` / `growth` / `scale` |
| `ARR__c` | `arr` | annual recurring value |
| `Subscription_Start__c` / `StartDate` | `start_month` | → `YYYY-MM` |
| `Term_Months__c` | `term_months` | |
| `Status` | `status` | `active` / `pending` / `churned` |
| `Type` | `booking_type` | New Business→`new`, Upsell/Expansion→`expansion`, Downsell→`contraction` |

## Picklist maps (the transforms that need a decision)

- **`Segment__c` → `segment`:** Enterprise→`scale` · Mid-Market→`growth` · SMB→`starter`. (If you
  segment by ARR instead, derive from bands.)
- **`StageName` → `stage`:** your SF stages (e.g. "Discovery", "Demo", "Proposal/Quote", "Negotiation",
  "Closed Won/Lost") map onto the six Dogfood stages. One-time mapping, stored in config.
- **`Type` → `booking_type`:** New Business→`new` · Upsell/Cross-sell→`expansion` · Downsell/Churn→
  `contraction`.

## Synced vs. override

Most fields **sync** (Salesforce is authoritative). A few are reasonable **manual overrides** (they
layer on top, are flagged, and survive the next sync):

- `segment` — a manual reclassification the CRM hasn't caught up on.
- `stream` / `plan_tier` — when the SF product mix is ambiguous.
- a **forward ARR adjustment** on a contract (a planning override, distinct from the synced booking).

`start_month`, `arr` (as booked), `owner`, `status` normally stay synced — overriding them means
diverging from the CRM, which you'd only do deliberately.

## Worked row

Salesforce Account `0015e000ABCd · Talon Labs · Segment=Enterprise · ARR__c=1715000 · status active`
→ `customers` row:

```
id,name,segment,start_month,status,arr
0015e000ABCd,Talon Labs,scale,2026-08,active,1715000
```

(Same account's closed-won subscription Opportunity becomes a `contracts` row with
`customer_id=0015e000ABCd`, `stream=subscription`, `plan_tier=scale`, `arr=1715000`,
`booking_type=new`.)

## Cadence

- **Today:** export the three Salesforce reports → drop the CSVs in Setup → Data Import (upsert).
- **Target:** a Salesforce connector calls the same upserts on a schedule (or via Change Data
  Capture), behind the `DataStore` seam. The field map above is unchanged; only the *delivery* changes
  from "you export a CSV" to "it refreshes itself." HRIS (Rippling → `staff`) and the ERP (→ trial
  balance + COA) follow the same shape.
