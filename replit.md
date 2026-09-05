# PetNest

PetNest is a multi-provider pet care marketplace for discovering local grooming, vaccination, and pet supply providers.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/petnest/src/App.tsx` — customer-facing routes, marketplace interactions, pet profiles, bookings, orders, and account views
- `artifacts/petnest/src/index.css` — PetNest visual tokens and responsive UI styles
- `artifacts/api-server/src/routes/petnest.ts` — provider, pet, record, booking, order, and dashboard API routes
- `lib/api-spec/openapi.yaml` — source-of-truth API contract; regenerate clients after changes

## Design language

- Palette: indigo `--brand-indigo`, magenta `--brand-magenta`, sunshine `--brand-sun` on a white page, all defined as HSL triples in `index.css`.
- Type: Poppins for display/UI chrome (`--app-font-serif`), Nunito for body (`--app-font-sans`); `--app-font-mono` is Nunito with tabular numerals, not a real monospace.
- Cards end in a wavy edge via the `.wavy` class, an SVG mask over a fixed 28px bottom strip (`.wavy-lg` uses 40px for large surfaces like the hero). The curve is one long swell, not repeating scallops; it lives in `--wave-edge` on `:root` and the provider card's inner crest reuses it flipped with `scaleY(-1)`.
- Dialogs: `.modal` scrolls as one block; add `.modal-split` for a fixed frame with `.modal-head` / `.modal-body` / `.modal-foot` when the header and actions should stay put.
- Masks clip `box-shadow`, so card depth comes from a `drop-shadow` filter on the *grid* container — it applies per child silhouette and follows the curve.
- Buttons and inputs are full pills; `.eyebrow` is a coloured chip, not small caps.
- The wave in `--wave-edge` is one trough / crest / trough (about 1.5 wavelengths) — enough to read as a wave without becoming repeating scallops. Strip heights: 36px via `.wavy`, 58px via `.wavy-lg`; surfaces need matching bottom padding or content sits in the curve.
- One wave per surface and no decorative colour washes inside cards — a card is a single flat colour with a wavy bottom edge. Where two waves meet (the hero band over the panel edge) mirror one with `scale(-1, -1)` so they run out of phase; matching curves read as a flat ribbon.
- The sidebar is `position: sticky; top: 0; height: 100dvh`, which needs `align-items: start` on `.app-shell` or the grid stretches it and sticky does nothing.
- `.animate-in` must use `animation-fill-mode: backwards`, never `both` — a lingering transform makes the element a containing block and crops any `position: fixed` overlay inside it to the page column.

## Architecture decisions

- The primary customer journey is category → provider → service/product → pet or basket → booking/order.
- Each tab has its own layout so they do not read as one template: Discover is hero + sticky rail; Providers leads with a `.spotlight` card then a grid; Bookings is a dated `.booking-list` timeline grouped into upcoming/past; My pets is `.pet-card` portrait tiles with a `.pet-add` tile in the grid; Profile is `.identity-card` beside the details form.
- Discover (`Home`) is a two-column layout: `.discover-main` for browsing, and a sticky `.discover-rail` holding everything account-specific (next visit, counts, jump links). The rail collapses to a card row under 1180px and to a single column on mobile.
- Provider discovery remains public while account entry uses Replit-managed Clerk.
- Marketplace seed data is served by the shared API server so the first-run experience demonstrates the full product surface.

## Product

- Discover providers by category and search
- View provider services, hours, pricing, and supply products
- Book grooming or vaccination visits for a specific pet
- Add and edit pet profiles and view grooming/vaccination records
- Track bookings and supply orders
- Sign in and create an account through branded Clerk screens

## User preferences

The project brief prioritizes simplicity, provider-first flows, prominent landing-page categories, and no chatbot or AI diagnosis/recommendations.

## Gotchas

- There are no provider, product, or pet images in the database: every `imageUrl` / `avatarUrl` is `""`, and `initializePetnestData()` runs a migration on each boot that clears any `images.unsplash.com` URL (`artifacts/api-server/src/routes/petnest.ts`). The UI therefore always renders the monogram fallback — `.provider-image-fallback` with a `tone-0..3` class picked from the record id. Remove that migration before adding real photos, or they will be wiped on the next restart.


- Keep `info.title: Api` in the OpenAPI document so generated import paths remain stable.
- The generated client expects the API at `/api`; use the shared proxy rather than hardcoding localhost in browser code.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
