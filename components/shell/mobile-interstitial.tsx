/**
 * Mobile interstitial (ship-now). Dogfood is a dense, multi-column FP&A workspace
 * built around the Midnight rail; the layout has no responsive collapse yet, so on a
 * phone the content crushes to ~100px and reads as broken. Until the responsive nav
 * (top bar + hamburger drawer) lands, gate small screens behind a branded "open on a
 * larger screen" panel. Pure CSS (`md:hidden`) so it is SSR-safe with no hydration
 * flash; the desktop app is rendered `hidden md:flex` alongside and is untouched.
 */
function TrailMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
      <polyline points="3,17 7,14 3,11" stroke="var(--color-frost)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="9,15 13,12 9,9" stroke="var(--color-steel)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="15,13 19,10 15,7" stroke="var(--color-ember)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MobileInterstitial() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center text-sidebar-foreground md:hidden"
      style={{ background: "linear-gradient(180deg, var(--color-midnight), var(--color-midnight-2))" }}
    >
      <div className="flex max-w-sm flex-col items-center gap-5">
        <div className="flex items-center gap-2.5">
          <TrailMark />
          <span className="font-heading text-2xl text-parchment">
            dogfood<span className="text-steel">.cafe</span>
          </span>
        </div>

        <h1 className="font-heading text-xl text-parchment">
          Dogfood is a desktop FP&amp;A workspace
        </h1>

        <p className="text-sm leading-relaxed text-steel">
          The platform packs statements, forecasts, scenarios, and Scout into a dense,
          multi-column cockpit. Open it on a laptop or desktop for the full experience —
          a mobile layout is on the way.
        </p>

        <div className="mt-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-steel">
          Best viewed at <span className="font-medium text-parchment">1024px</span> or wider
        </div>
      </div>
    </div>
  );
}
