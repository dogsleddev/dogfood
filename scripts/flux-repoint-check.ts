/**
 * flux-repoint-check — F4 regression gate. An account's flux note must FOLLOW a statement-line
 * re-point: the note's effective statement line is resolved from the CURRENT Account Mapping (chart ⊕
 * overrides) on read, not the line denormalized at write time. Without the fix, a re-pointed account's
 * note silently disappears from the new line's statement peek pane while still showing on the
 * account-grain card. Forces in-memory; the note + override are ephemeral.
 *
 * Run: npx tsx scripts/flux-repoint-check.ts
 */
process.env.DATASTORE = "in-memory";

import { addFluxNote, listFluxNotes } from "@/lib/queries/flux";
import { setAccountOverride, clearAccountOverride } from "@/lib/queries/account-mapping";
import { getDataStore } from "@/lib/datastore";

let fail = 0;
const ok = (b: boolean) => (b ? "PASS" : "FAIL");
function check(name: string, pass: boolean, detail = "") {
  if (!pass) fail++;
  console.log(`  ${ok(pass)}  ${name}${detail ? `  ${detail}` : ""}`);
}

async function main() {
  console.log("\n===== FLUX-REPOINT-CHECK (F4) — a re-pointed account's note follows to its new line =====\n");
  const period = (await getDataStore().getSettings()).closeThrough; // the last closed month
  const ACCOUNT = "6400"; // IT, maps to statement line "it"
  const FROM = "it";
  const TO = "admin"; // same group (pnl_opex) → an allowed re-point

  const note = await addFluxNote({ anchor: { accountCode: ACCOUNT, period }, body: "F4 test note" });
  check("note denormalized to the account's current line (it)", note.statementLine === FROM, `${note.statementLine}`);

  // before the re-point: the note shows on the "it" line, not "admin"
  const beforeIt = await listFluxNotes({ statementLine: FROM, period });
  check("before re-point: note is on line 'it'", beforeIt.some((n) => n.id === note.id));

  // re-point 6400 IT → Admin
  await setAccountOverride(ACCOUNT, { statementLineId: TO });

  const afterAdmin = await listFluxNotes({ statementLine: TO, period });
  const afterIt = await listFluxNotes({ statementLine: FROM, period });
  check("after re-point: note FOLLOWED to line 'admin'", afterAdmin.some((n) => n.id === note.id));
  check("after re-point: note no longer on line 'it'", !afterIt.some((n) => n.id === note.id));

  // the account-grain card (filter by accountCode) is unaffected either way
  const byAccount = await listFluxNotes({ accountCode: ACCOUNT, period });
  check("account-grain card still shows the note (unaffected by the re-point)", byAccount.some((n) => n.id === note.id));

  // cleanup
  await clearAccountOverride(ACCOUNT);
  await getDataStore().deleteFluxNote(note.id);

  console.log(`\n================ FLUX-REPOINT-CHECK: ${fail === 0 ? "PASS" : `${fail} FAILING`} ================\n`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
