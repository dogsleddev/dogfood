-- 0006_vendor_bill_subcode.sql — add the expense-granularity sub-account code to vendor_bills.
--
-- The expense-granularity feature stamps each VendorBill with a display sub-account code (6210/6220…
-- the GL sub-account WITHIN the group, §7). It rides as the additive `subCode` field on
-- ExpenseTransaction (lib/types/source.ts); the real GL account stays `account_id` (the parent group
-- account), so statements / Flux are unchanged. Without this column `subCode` does not round-trip to
-- Supabase, so getExpenseForecast's closed-month account/vendor breakdown reads empty on that backend.
--
-- Folded into 0001_init.sql too, for fresh applies (per the 0003/0004/0005 convention).

alter table vendor_bills add column if not exists sub_code text;
