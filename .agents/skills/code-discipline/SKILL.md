---
name: code-discipline
description: Read-before-write protocol, dependency discipline, no invention rule, OpenSpec mechanics, TDD tooling
---

> **Always apply:** true

---

# Code Discipline

## Read-Before-Write Protocol

- Before modifying any file, you MUST read it first.
- Before creating a file in a directory, read at least one sibling file to learn local conventions.
- Before importing a module, verify the path exists.
- NEVER guess the signature of a function, hook, or component — read its source.

## Dependency Discipline

- Never assume a package is installed. Check the app's `package.json` before using an import.
- Never add a dependency without checking if the functionality already exists in an installed package.
- To add deps: `pnpm --filter <pkg> add <dep>`. Never edit `package.json` by hand.
- When using Zod, confirm whether the app has v3 or v4 (backend is v4).

## No Invention Rule

- Do NOT create directories, files, utility functions, or middleware that do not already exist unless explicitly asked.
- Before proposing a new shared module, check `lib/`, `utils/`, `hooks/`, or `middlewares/` for existing solutions.
- If you need something that doesn't exist, state that explicitly and propose creation before writing code.

## Verification After Changes

- After code changes, run `pnpm --filter <affected-app> typecheck` to verify compilation.
- After adding/changing an API route, verify the OpenAPI spec loads at `/api/docs`.
- Full `pnpm verify` only required at feature completion, not during iterative dev.

## Specification-Driven Development (OpenSpec)

- All feature specs live in `openspec/specs/<app>/<feature>/spec.md`.
- The OpenSpec workflow is: **Propose** (proposal.md, design.md, tasks.md) -> **Apply** (write code) -> **Archive** (merge specs).
- Specs are the source of truth. If code disagrees with the spec, the **CODE** is wrong.
- Project context for AI agents lives in `openspec/project.md`.
- To propose a new feature: `/opsx:propose <description>`.

## Test-Driven Development

- **Test runner:** Vitest. **Frontend mocking:** MSW. **API testing:** Hono `testClient`.
- Every test file must cover: **success cases**, **failure/error cases**, **edge cases**, and **RBAC** (for API).
- Test file locations (co-located with features):
  - API: `src/features/<name>/[name].test.ts`
  - Admin: `src/features/<name>/__tests__/`
  - Client: `src/features/<name>/__tests__/`
- Run tests: `pnpm --filter <app> test`. CI runs tests on every push.
