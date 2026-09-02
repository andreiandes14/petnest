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

## Architecture decisions

- The primary customer journey is category → provider → service/product → pet or basket → booking/order.
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

- Keep `info.title: Api` in the OpenAPI document so generated import paths remain stable.
- The generated client expects the API at `/api`; use the shared proxy rather than hardcoding localhost in browser code.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
