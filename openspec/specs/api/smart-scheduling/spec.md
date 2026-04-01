# API: Smart Scheduling Suggestions

## Overview

Generates staffing suggestions by comparing demand forecasts against current staff schedules. Identifies understaffed and overstaffed time slots and recommends shift changes.

## Schema

### New Enum: `SuggestionStatus`
```prisma
enum SuggestionStatus {
  PENDING
  ACCEPTED
  REJECTED
}
```

### New Model: `ScheduleSuggestion`
```prisma
model ScheduleSuggestion {
  id              String           @id @default(cuid())
  branchId        String
  organizationId  String
  staffProfileId  String?
  date            DateTime         @db.Date
  suggestedStart  String
  suggestedEnd    String
  reason          String
  demandScore     Float            @default(0)
  status          SuggestionStatus @default(PENDING)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  branch       Branch       @relation(fields: [branchId], references: [id])

  @@index([branchId, date])
  @@index([organizationId])
  @@map("schedule_suggestions")
}
```

## API Endpoints

Base path: `/api/analytics`. Permission: `ANALYTICS` for read/create, `SCHEDULING` for update (accept/reject).

| Method | Path | Query / Body | Description |
|--------|------|-------------|-------------|
| GET | `/schedule-suggestions` | `branchId` (required), `weekStart` (ISO date) | Get suggestions for the week |
| POST | `/schedule-suggestions/compute` | `{ branchId: string }` | Generate suggestions for next 7 days |
| PATCH | `/schedule-suggestions/:id` | `{ status: "ACCEPTED" \| "REJECTED" }` | Accept or reject a suggestion |

### GET `/schedule-suggestions`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sug_1",
      "date": "2026-04-03",
      "suggestedStart": "10:00",
      "suggestedEnd": "18:00",
      "reason": "Predicted 40% above capacity — add 1 staff",
      "demandScore": 1.4,
      "status": "PENDING",
      "staffProfileId": null
    }
  ]
}
```

### POST `/schedule-suggestions/compute`

**Response 200:**
```json
{
  "success": true,
  "data": { "suggestionsCreated": 3 }
}
```

### PATCH `/schedule-suggestions/:id`

On ACCEPTED, auto-creates a `ShiftSchedule` entry for the suggested staff/date/times.

**Response 200:**
```json
{
  "success": true,
  "data": { "id": "sug_1", "status": "ACCEPTED" }
}
```

## Algorithm

1. Load `DemandForecast` for the branch for the next 7 days.
2. Load existing `ShiftSchedule` entries and `StaffProfile` (active staff) for the branch.
3. For each day:
   - Compute **required staff-hours** = `predictedTransactions × avgServiceDuration / hoursInDay`
   - Compute **scheduled staff-hours** = sum of existing shift durations
   - **demandScore** = required / scheduled (>1.0 = understaffed, <1.0 = overstaffed)
4. If `demandScore > 1.2`: suggest adding staff (reason: "Predicted X% above capacity")
5. If `demandScore < 0.7`: suggest reducing staff (reason: "Predicted X% below capacity")
6. Average service duration is computed from historical `QueueEntry` (completedAt - startedAt).

## Business Rules

1. Only generates suggestions for days with existing forecasts.
2. Uses 45-minute default average service duration if insufficient historical data.
3. Suggestions are deleted and regenerated on each compute call for the branch.
4. Accepting a suggestion with `staffProfileId` auto-creates a `ShiftSchedule` row.

## Admin UI

New "Smart Schedule" tab on the Analytics page (or sub-tab in Attendance):
- Weekly bar chart: forecasted demand vs scheduled capacity per day
- Suggestion cards with accept/reject buttons
- Branch selector for filtering

## RBAC

| Route | Feature | Action |
|-------|---------|--------|
| GET `/schedule-suggestions` | ANALYTICS | read |
| POST `/schedule-suggestions/compute` | ANALYTICS | create |
| PATCH `/schedule-suggestions/:id` | SCHEDULING | update |
