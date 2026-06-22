/**
 * Texture — curated B2B customer names (CLAUDE.md §12: Claude authors texture at design
 * time; the generator consumes it deterministically). Bearing sells AI-native FP&A to other
 * venture-backed tech/AI startups, so the book reads like a 2025 software/AI cohort (the
 * Numeric/Campfire peer profile; 2026-06-18). The first six are the marquee accounts; the
 * positions they occupy are shown in diagrams/revenue-drilldown.svg — update its rows to match
 * if that diagram is refreshed. Coined names, not real companies. The generator consumes these
 * by sequential index (no RNG), so the pool is RNG-stable: changing it never moves the financials.
 * Pool is 180 names ≥ 149 customers + headroom, so NO numeric-suffix repeats ("Northwind Cloud 2")
 * ever occur (realism audit, 2026-06-18).
 */
export const CUSTOMER_NAMES: readonly string[] = [
  // ── marquee accounts (positions shown in diagrams/revenue-drilldown.svg) ──
  "Northwind Cloud", // was Northwind Trading
  "Helix AI", // was Helix Bio
  "Atlas Data", // was Atlas Manufacturing
  "Cedar Security", // was Cedar Freight
  "Mariner Analytics", // was Mariner Logistics
  "Pinnacle Health AI", // was Pinnacle Health
  // ── B2B SaaS / software / dev-tools-infra (~45%) ──
  "Tensil",
  "Nodeform",
  "Quillstack",
  "Bramble",
  "Sublayer",
  "Coilbase",
  "Driftwork",
  "Padlock",
  "Fernwood Labs",
  "Pinegrid",
  "Slatewire",
  "Hexpoint",
  "Caldera Systems",
  "Stitchroom",
  "Plumb",
  "Gridline",
  "Forklift Software",
  "Marble",
  "Tovala Systems",
  "Quanta Stack",
  "Brightloop",
  "Onspring",
  "Vellum Data",
  "Cobblestone Labs",
  "Switchboard",
  "Latchkey",
  // ── AI-native startups (~20%) ──
  "Cinder AI",
  "Parallax Labs",
  "Numina AI",
  "Synapse Compute",
  "Lumadel AI",
  "Tessera Intelligence",
  "Cortexa",
  "Halcyon AI",
  "Veridian Labs",
  "Mesa Intelligence",
  "Foundry Compute",
  "Aperture AI",
  "Norvane AI",
  "Sferica Labs",
  // ── fintech / financial services (~20%) ──
  "Keel Financial",
  "Mintline",
  "Ledgerwise",
  "Cardamom Pay",
  "Tradewind Capital",
  "Settl",
  "Northkey Financial",
  "Fathom Treasury",
  "Beacon Ledger",
  "Vepay",
  "Quorum Capital",
  "Riverton Pay",
  "Standpoint Financial",
  "Almira Bank",
  // ── modern vertical SaaS (~10%) ──
  "Vellum Health",
  "Cleardeed", // proptech
  "Palette Health",
  "Haulwise", // logistics-tech
  "Lexwell", // legaltech
  "Surveyor Realty AI", // proptech
  "Cartway", // logistics-tech
  // ── non-tech spread (~5%) ──
  "Glasshouse Studio",
  "Tallwater Brewing",
  "Meridian Outfitters",
  "Copperline Coffee",
  // ════════════════════════════════════════════════════════════════════════
  //  APPENDED POOL — RNG-stable headroom so 149 customers never suffix.
  //  Same theme mix as above. Coined names, not real companies.
  // ════════════════════════════════════════════════════════════════════════
  // ── B2B SaaS / software / dev-tools-infra (~45%) ──
  "Brackit",
  "Spindle Systems",
  "Querybird",
  "Loamwork",
  "Tideglass",
  "Packetry",
  "Sundeck Software",
  "Yardstick Labs",
  "Mossflow",
  "Trellix Stack",
  "Cobaltline",
  "Heronworks",
  "Stackmint",
  "Birchpoint",
  "Quillet",
  "Driftline Systems",
  "Pylon Software",
  "Crateworks",
  "Sandbar Labs",
  "Threadbase",
  "Ironwood Systems",
  "Lumberyard Software",
  "Flintgrid",
  "Murmur Stack",
  "Cobblepath",
  "Tinderbox Labs",
  "Saltbox Systems",
  "Glidepath Software",
  "Anchorpoint",
  "Riffstack",
  "Bramblewire",
  "Cedarflow",
  "Outpost Software",
  "Kettleworks",
  "Snowfield Systems",
  "Tarpaulin Labs",
  "Wickline",
  "Plankstack",
  "Verdigris Systems",
  "Mapleline Software",
  "Brindle Labs",
  "Cloverstack",
  "Hollowpoint Systems",
  "Dunewire",
  "Stonefold Software",
  // ── AI-native startups (~20%) ──
  "Obsidian Compute",
  "Larkspur AI",
  "Vantix Intelligence",
  "Quench AI",
  "Saffron Labs",
  "Meridel AI",
  "Cobalt Compute",
  "Thornwell AI",
  "Periscope Intelligence",
  "Nimbex Labs",
  "Cradle AI",
  "Veor Compute",
  "Sablefield AI",
  "Inkwell Intelligence",
  "Talon Labs",
  "Marrow AI",
  "Cendric Compute",
  "Florin AI",
  "Wavelength Labs",
  "Solenya AI",
  "Bastion Intelligence",
  "Quill Compute",
  // ── fintech / financial services (~20%) ──
  "Holloway Capital",
  "Penmark Pay",
  "Sumledger",
  "Tidewater Treasury",
  "Greyrock Financial",
  "Cobblestone Capital",
  "Vaultline",
  "Aldercross Financial",
  "Strand Pay",
  "Norwell Capital",
  "Ferrowise",
  "Meadowlark Bank",
  "Capstone Treasury",
  "Driftwood Capital",
  "Slatebridge Financial",
  "Pennywhistle Pay",
  "Tollgate Capital",
  "Halford Treasury",
  "Castlepoint Financial",
  "Brightmark Pay",
  "Sterlinghaus",
  "Onyx Capital",
  // ── modern vertical SaaS (~10%) ──
  "Wellspring Health AI",
  "Stagecoach Logistics",
  "Deedline", // proptech
  "Casework AI", // legaltech
  "Plotbound Realty", // proptech
  "Freightcove", // logistics-tech
  "Chartwell Health",
  "Statute AI", // legaltech
  "Acrewise", // proptech
  "Palletworks", // logistics-tech
  "Vitalpath Health",
  // ── non-tech spread (~5%) ──
  "Birchwood Ceramics",
  "Granite Peak Apparel",
  "Lantern Bay Roasters",
  "Foxglove Press",
  "Ironwell Distillery",
];

/**
 * Person-name texture for Staff. Pools are 40 first × 41 last (deliberately COPRIME): combining on
 * INDEPENDENT moduli (i%40, i%41) gives unique full names for i < 40×41 = 1640 (CRT) AND advances
 * BOTH names every person, so no block of staff shares a surname — the prior 24×24 scheme repeated
 * the last name in runs of 24, which read oddly at 140 heads (review fix). RNG-stable: names are
 * consumed by index, so widening the pool never moves the financials.
 */
export const FIRST_NAMES: readonly string[] = [
  "Avery", "Bianca", "Caleb", "Dana", "Elena", "Felix", "Grace", "Hassan",
  "Ingrid", "Jonah", "Kira", "Liam", "Maya", "Noor", "Omar", "Priya",
  "Quinn", "Rosa", "Sam", "Tara", "Umar", "Vera", "Wesley", "Yusuf",
  "Zara", "Theo", "Nadia", "Marcus", "Leila", "Diego", "Sofia", "Aaron",
  "Mei", "Raj", "Hannah", "Tobias", "Aisha", "Lucas", "Yara", "Ethan",
];

export const LAST_NAMES: readonly string[] = [
  "Ahmed", "Brooks", "Chen", "Diaz", "Ellis", "Foster", "Gupta", "Hayes",
  "Iverson", "Jensen", "Khan", "Lowe", "Mensah", "Nguyen", "Osei", "Park",
  "Reyes", "Silva", "Tran", "Underwood", "Vargas", "Walsh", "Xu", "Young",
  "Abbott", "Bauer", "Cardoso", "Dasgupta", "Eriksson", "Fitzgerald", "Greco", "Haddad",
  "Ito", "Kowalski", "Lindqvist", "Moreau", "Okafor", "Petrov", "Rahman", "Sato",
  "Velasquez",
];

/**
 * Unique, non-clumping full names. The pools are coprime (40 × 41), so the pair
 * (firstIdx, lastIdx) is unique for i < 1640 for ANY affine index map with multipliers coprime to
 * each modulus. We scramble BOTH indices with such maps — gcd(7,40)=1 and gcd(11,41)=1 — so
 * consecutive i no longer walk the alphabet in lockstep. The prior plain i%40 / i%41 produced an
 * alliterative diagonal for the founding cohort (Avery Ahmed, Bianca Brooks, Caleb Chen…), a
 * synthetic-data tell on the Staff register (data audit 2026-06-21). Still consumed by index with no
 * RNG dependency, so widening/scrambling the pool never moves the financials.
 */
export const personName = (i: number): string =>
  `${FIRST_NAMES[(7 * i + 17) % FIRST_NAMES.length]} ${LAST_NAMES[(11 * i + 5) % LAST_NAMES.length]}`;
