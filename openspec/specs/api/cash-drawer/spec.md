# Cash Drawer API

## Overview

Per-branch cash drawer sessions: open (one OPEN session per branch), record manual entries (SALE, REFUND, ADJUSTMENT, FLOAT), read current OPEN session, close with counted cash and computed expected balance and discrepancy.

**Base path:** `/api/cash-drawer`.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/open` | Bearer + org + `CASH_DRAWER` **create** | Open session with `openingBalance`; fails if OPEN exists. |
| GET | `/current` | Bearer + org + `CASH_DRAWER` **create** | Current OPEN session with entries or `null`. |
| POST | `/close` | Bearer + org + `CASH_DRAWER` **create** | Close session: `expectedBalance = openingBalance + sum(entries.amount)`, `discrepancy = closingBalance - expectedBalance`. |
| POST | `/entry` | Bearer + org + `CASH_DRAWER` **create** | Append entry to OPEN session. |

## Business Rules

- **Single open session:** Second `open` for same branch → **400** message contains `already open`.
- **Entries:** Only when session status is **OPEN**; closed session → **400** `Cannot add entry to a closed session`.
- **Close:** Session must exist and be OPEN; already closed → **400** `Session is already closed`.
- **Amounts:** `openingBalance` and `closingBalance` must be ≥ 0 (schema); entry `amount` can be negative (e.g. refunds) — service sums raw `amount`.

## Scenarios

### Success

- **GIVEN** no OPEN session **WHEN** `POST /open` **THEN** `201` with session `status: OPEN`.
- **GIVEN** OPEN session **WHEN** `GET /current?branchId=` **THEN** `200` with session or `data: null`.
- **GIVEN** OPEN session with entries **WHEN** `POST /close` **THEN** `200` CLOSED with `expectedBalance` and `discrepancy`.
- **GIVEN** OPEN session **WHEN** `POST /entry` **THEN** `201` with entry row.

### Failure

- **GIVEN** no JWT **THEN** `401`.
- **GIVEN** missing `CASH_DRAWER` create **THEN** `403`.
- **GIVEN** duplicate open **WHEN** `POST /open` **THEN** `400`.
- **GIVEN** bad `sessionId` **WHEN** close/entry **THEN** `404` `Session not found`.
- **GIVEN** CLOSED session **WHEN** add entry **THEN** `400`; **WHEN** close again **THEN** `400`.

## Edge Cases

- All four routes share the same middleware: **`CASH_DRAWER` create** (including read current — no separate read permission).
- Handler uses `c.var.userId` for `openedById`.

## RBAC

Entire sub-router: `CASH_DRAWER` **create** only (`cash-drawer.index.ts`).

## Dependencies

- **Prisma:** `cashDrawerSession`, `cashDrawerEntry`
