---
description: Mandatory SPEC->TEST->IMPLEMENT->VERIFY workflow gate enforced on every feature change
alwaysApply: true
---

# MANDATORY WORKFLOW GATE (Read This FIRST)

**Every feature change — no matter how small — MUST follow this exact order. Plans, task lists, and implementation steps MUST be structured to match this sequence. Skipping or reordering steps is a rule violation.**

## Pre-Flight Checklist (execute sequentially, never skip)

1. **SPEC FIRST** — Read or create/update the OpenSpec `spec.md` for every affected feature:

   - Existing feature: Read `openspec/specs/<app>/<feature>/spec.md` before touching any code.
   - New feature or new endpoint: Write/update the spec FIRST. The spec defines endpoints, request/response shapes, business rules, success/failure scenarios, edge cases, and HTTP status coverage.
   - STOP: Do not proceed to step 2 until the spec is complete and covers the full scope of the change.

2. **TEST FIRST (TDD)** — Write or update tests based on the spec scenarios:

   - API: `src/features/<name>/[name].test.ts` — schema validation, success paths, auth/RBAC (401/403), not-found (404), business rule violations, edge cases.
   - Admin: `src/features/<name>/__tests__/*.test.tsx` — hook success/error states, widget render/interaction.
   - Client: `src/features/<name>/__tests__/*.test.tsx` — hook success/error states, component render/interaction.
   - STOP: Do not proceed to step 3 until tests exist for ALL scenarios described in the spec. Tests WILL fail at this point — that is correct and expected.

3. **IMPLEMENT** — Write the minimum code to make the failing tests pass:

   - API order: schema.ts -> handlers.ts -> service.ts -> index.ts
   - Frontend order: types -> hooks -> widgets/components -> pages
   - Follow the Backend Schema First rule in app-level rules for all frontend work.

4. **VERIFY** — Run the full verification pipeline on every affected app:

   - `pnpm --filter <app> lint`
   - `pnpm --filter <app> typecheck`
   - `pnpm --filter <app> test`
   - ALL THREE must pass with zero errors. Fix any failures before considering the task complete.

5. **UPDATE DOCS** — Review & update all documentations needed
   - Review all documentations to make sure after we have done **verify**, make sure to update all the docs needed to make sure we are aligned on the current development.

**If you receive a plan or task list with steps ordered differently (e.g., code before specs/tests), you MUST reorder your execution to match this checklist. The plan structure does not override this workflow.**
