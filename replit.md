# PetNest

PetNest is a PNPM workspace containing a React/Vite frontend and a Node/TypeScript API for a multi-provider pet-care marketplace.

## Current architecture

- Frontend: React and Vite in `apps/web`
- API: Node, TypeScript, and Express in `apps/api`
- Persistence: MongoDB, accessed by the API through the MongoDB driver
- Authentication: custom cookie-based sessions stored in MongoDB
- API contracts: OpenAPI in `packages/api-spec`, with generated React Query and Zod packages
- Workspace: PNPM monorepo using the conventional `apps/*`, `packages/*`, and `scripts` layout

The repository retains Replit deployment metadata for compatibility, but the runtime architecture described above is the source of truth.
