---
name: monorepo-standards
description: Global monorepo standards — workspace structure, pnpm, naming, tech standards, documentation references
---

> **Always apply:** true

---

# Monorepo Standards

## Core Directives

- **READ FIRST:** Before proposing any architecture, adding dependencies, or writing multi-file features, you MUST read `docs/platform_overview.md` and `docs/features.md`.
- **Monorepo Manager:** This is a `pnpm` workspace (NOT Nx). **NEVER** use `npm`, `yarn`, or `bun`. Always execute commands using `pnpm` (e.g., `pnpm add`, `pnpm install`). Workspace filtering: `pnpm --filter <pkg>`.
- **No Boilerplate:** Always use CLI tools to scaffold files when available. Never manually write boilerplate that a CLI can generate.

## Workspace Structure

```
bs-project/                     # pnpm workspace root
├── apps/
│   ├── api/                    # @tmng/saas-api      — Hono.js REST API (Node.js 22)
│   ├── admin/                  # @tmng/barber-admin   — Admin dashboard (React 19, desktop-first)
│   └── client/                 # @tmng/barber-client  — Customer PWA (React 19, mobile-first)
├── packages/                   # Shared packages (currently empty)
└── docs/                       # Architecture & planning docs (source of truth)
```

- **Package namespace:** All packages use the `@tmng/` scope.
- **No shared packages yet** — do not create packages in `packages/` without explicit discussion.

## Source-of-Truth Documentation

Before generating code that touches architecture, RBAC, database models, or deployment, consult:

| Doc | Purpose |
|-----|---------|
| `docs/platform_overview.md` | Business context, architecture, tech stack, third parties, scheduler |
| `docs/features.md` | Complete feature catalog with endpoints, pages, workflows, status |
| `docs/business_logic.md` | Core business rules (22 domains), state machines, pricing calculations |
| `docs/templates/barbershop.md` | Barbershop industry template — role mapping, seed data, workflow examples |
| `docs/database_schema.md` | Complete Prisma schema (56 models, multi-tenant) |
| `docs/rbac_system.md` | 25-feature permission catalog, TenantRole model, middleware |
| `docs/deployment.md` | Docker, Nginx, MinIO/Soketi/OneSignal setup, database backups |
| `docs/development_guide.md` | Dev setup, testing, conventions, verification workflow |
| `docs/gap_analysis.md` | Current open gaps, resolved summary, phase completion |

## Universal Tech Standards

- **TypeScript:** Strict mode is mandatory across all packages and apps.
- **Zod v4:** The single source of truth for types on both frontend and backend. Import from `zod` (v4), not `@hono/zod-openapi`'s re-export of `z` unless inside a schema file.
- **Time/Dates:** All timestamps stored, processed, and transmitted in UTC. Only format to WIB (UTC+7) at the final UI rendering layer.

## Multi-Tenancy & Naming

- **Multi-tenant model:** Every data table is scoped by `organizationId`. Auth uses `orgSlug` to identify the tenant.
- **Database-driven RBAC:** Roles are `TenantRole` records per org. Permissions are `TenantRolePermission` rows (25 feature codes, CRUD flags). Never hardcode role names for access checks.
- **Generic naming:** Use `StaffProfile` (not `BarberProfile`), `staff` (not `barber`) in API routes and types. The platform is industry-agnostic.
- **JWT claims:** `userId`, `organizationId`, `tenantRoleId`, `scope` (HQ | BRANCH | CUSTOMER), `branchId`.

## API Response Envelope

All API responses follow this shape:

```typescript
{ success: boolean; data?: T; message?: string; pagination?: { page, limit, total, totalPages } }
```

Frontend `lib/api.ts` (both apps) unwraps this envelope automatically. Hooks receive `data` directly.

## Workflow Verification

- **Order of Operations:** Always run `lint` -> `typecheck` -> `test` in that exact order before considering any phase or feature complete.
- **Root scripts:** `pnpm verify` runs the full chain. `pnpm dev:api`, `pnpm dev:admin`, `pnpm dev:client` start individual apps.
