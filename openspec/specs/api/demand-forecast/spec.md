# API: Demand Forecasting

## Overview

Advanced demand forecasting using time-series decomposition with day-of-week seasonality. Replaces the existing simple linear regression forecast with a more accurate model that accounts for weekly patterns, holidays, and surge rules.

## Schema

### New Model: `DemandForecast`

```prisma
model DemandForecast {
  id                    String   @id @default(cuid())
  branchId              String
  organizationId        String
  date                  DateTime @db.Date
  predictedTransactions Float    @default(0)
  predictedRevenue      Float    @default(0)
  confidenceLow         Float    @default(0)
  confidenceHigh        Float    @default(0)
  dayOfWeek             Int
  isHoliday             Boolean  @default(false)
  createdAt             DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  branch       Branch       @relation(fields: [branchId], references: [id])

  @@unique([branchId, date])
  @@index([organizationId])
  @@map("demand_forecasts")
}
```

## API Endpoints

Base path: `/api/analytics` (existing analytics router). Permission: `ANALYTICS` **read** on GET, **create** on POST compute.

| Method | Path | Query / Body | Description |
|--------|------|-------------|-------------|
| GET | `/demand-forecast` | `branchId` (required), `dateFrom?`, `dateTo?` | Retrieve stored forecasts for date range |
| POST | `/demand-forecast/compute` | `{ branchId?: string }` | Compute forecasts for next 14 days (all branches if no branchId) |

### GET `/demand-forecast`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "forecasts": [
      {
        "date": "2026-04-01",
        "predictedTransactions": 24.5,
        "predictedRevenue": 4800000,
        "confidenceLow": 3600000,
        "confidenceHigh": 6000000,
        "dayOfWeek": 3,
        "isHoliday": false
      }
    ],
    "accuracy": {
      "mape": 12.5
    }
  }
}
```

### POST `/demand-forecast/compute`

**Response 200:**
```json
{
  "success": true,
  "data": { "branchesProcessed": 5, "forecastDays": 14 }
}
```

## Algorithm

1. Load 90 days of `BranchDailySnapshot` history for the branch.
2. Compute 7-day moving average to extract **trend** component.
3. For each day-of-week (0-6), compute the average **seasonal index** = (actual / trend) for that weekday.
4. Extrapolate trend forward using linear regression on the smoothed series.
5. Multiply projected trend by seasonal index for each forecasted day.
6. Compute **confidence bands** as ±1.5× standard deviation of historical residuals.
7. Mark forecasted dates as `isHoliday: true` if they match any `BranchHoliday` record; apply a 0.3× multiplier for holidays.
8. Apply `SurgeRule` multipliers if applicable.
9. Upsert `DemandForecast` rows (14 days per branch).

## Cron

Nightly at `0 2 * * *` (02:00 UTC), after daily snapshots are computed. Calls `ForecastService.computeForecasts()` for all active branches.

## Business Rules

1. Minimum 14 days of history required; otherwise returns empty forecasts with a message.
2. Forecasts are upserted (replaced) on each compute run.
3. Holiday multiplier reduces predicted values by 70% (configurable via 0.3 factor).
4. MAPE (Mean Absolute Percentage Error) computed on last 7 days of backtested data.

## Admin UI

New "Forecast" tab on the Analytics page. Uses Recharts `AreaChart` with:
- Actual values line (from `BranchDailySnapshot`)
- Predicted values line
- Confidence band shading between `confidenceLow` and `confidenceHigh`
- Table with daily breakdown
- MAPE accuracy badge

## RBAC

| Route | Feature | Action |
|-------|---------|--------|
| GET `/demand-forecast` | ANALYTICS | read |
| POST `/demand-forecast/compute` | ANALYTICS | create |
