import { isAdmin } from "@/lib/auth/admin";
import { adminLoginAction, adminLogoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const admin = await isAdmin();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-8 py-12">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Dogfood · Admin</div>
      <h1 className="mb-2 font-heading text-3xl text-ink">{admin ? "You're signed in as admin" : "Admin sign in"}</h1>
      <p className="mb-6 max-w-sm text-sm text-steel">
        {admin
          ? "You can import trial balances, re-point Account Mapping, lock the Budget, and reset the demo. Everyone else can view, add flux notes, build scenarios, and use Scout."
          : "The trial site is open to everyone. Sign in to unlock the data writes (CSV import, the as-of advance, Account Mapping, Budget lock) and the demo reset."}
      </p>

      {admin ? (
        <form action={adminLogoutAction}>
          <a href="/setup/data-import" className="mr-3 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90">
            Go to Data Import
          </a>
          <button type="submit" className="rounded-md border border-parchment-line bg-secondary px-4 py-2 text-sm text-steel hover:bg-secondary/70">
            Sign out
          </button>
        </form>
      ) : (
        <form action={adminLoginAction} className="rounded-xl border border-parchment-line bg-surface p-5">
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="password">Admin password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoFocus
            className="mb-3 block w-full rounded-md border border-parchment-line bg-secondary px-3 py-2 text-sm text-ink outline-none focus:border-ember"
          />
          {error && <div className="mb-3 text-sm text-ember-deep">Incorrect password.</div>}
          <button type="submit" className="rounded-md bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-deep">
            Sign in
          </button>
        </form>
      )}
    </div>
  );
}
