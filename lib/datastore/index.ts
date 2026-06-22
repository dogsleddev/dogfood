/**
 * The single place the active DataStore is selected (CLAUDE.md §4 "Swap Don't Rewrite").
 *
 * Default = InMemoryDataStore (the deterministic generator). Set `DATASTORE=supabase` to use
 * SupabaseDataStore (the persistent record layer). This is an EXPLICIT opt-in rather than
 * auto-detecting `SUPABASE_URL`, because the URL must be present for the seed loader to run
 * BEFORE the database is populated — auto-switching the instant keys are added would break every
 * read until the load completes. Once the swap is validated (scripts/supabase-parity.ts), flip
 * the flag (env / Vercel) to make Supabase the live backend.
 */
import type { DataStore } from "./datastore";
import { InMemoryDataStore } from "./in-memory";
import { SupabaseDataStore } from "./supabase";

/** Which backend is active, from the env flag (defaults to in-memory). */
export function dataStoreKind(): "supabase" | "in-memory" {
  return process.env.DATASTORE === "supabase" ? "supabase" : "in-memory";
}

// Cache the store on globalThis, NOT a module-level `let`: Next dev re-evaluates server modules on
// HMR / per route, which would otherwise re-create the store on many requests. For SupabaseDataStore
// that means a fresh supabase-js client (new sockets) + an empty collection cache every time → network
// + memory accumulation that can exhaust the dev process. One global instance = one client, one cache.
const g = globalThis as unknown as { __dogfoodStore?: DataStore; __dogfoodStoreKind?: string };

export function getDataStore(): DataStore {
  const kind = dataStoreKind();
  if (g.__dogfoodStore && g.__dogfoodStoreKind === kind) return g.__dogfoodStore;
  g.__dogfoodStore = kind === "supabase" ? new SupabaseDataStore() : new InMemoryDataStore();
  g.__dogfoodStoreKind = kind;
  return g.__dogfoodStore;
}

export type {
  DataStore,
  FirmProfile,
  AppSettings,
  ExpenseTransactionFilter,
} from "./datastore";
