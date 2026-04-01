# API: Churn Prediction

## Overview

Behavioral churn scoring using weighted RFM (Recency, Frequency, Monetary) signals combined with engagement metrics. Computes a 0.0-1.0 churn probability score per customer per branch and classifies into risk tiers.

## Schema

### New Enum: `ChurnRiskLevel`
```prisma
enum ChurnRiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

### New Model: `ChurnScore`
```prisma
model ChurnScore {
  id             String         @id @default(cuid())
  customerId     String
  branchId       String
  organizationId String
  score          Float
  riskLevel      ChurnRiskLevel
  features       Json
  computedAt     DateTime       @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  branch       Branch       @relation(fields: [branchId], references: [id])
  customer     User         @relation("churn_scores", fields: [customerId], references: [id])

  @@unique([customerId, branchId])
  @@index([branchId, riskLevel])
  @@index([organizationId])
  @@map("churn_scores")
}
```

## API Endpoints

Base path: `/api/analytics`. Permission: `ANALYTICS` read on GET, `ANALYTICS` create on POST.

| Method | Path | Query / Body | Description |
|--------|------|-------------|-------------|
| GET | `/churn-scores` | `branchId` (required), `riskLevel?`, `minScore?`, `page`, `limit` | Paginated list of churn scores |
| POST | `/churn-scores/compute` | `{ branchId: string }` | Batch recompute churn scores for branch |
| GET | `/churn-scores/:customerId` | `branchId` (required) | Single customer churn detail |

### GET `/churn-scores`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "customerId": "user_1",
      "customerName": "John Doe",
      "score": 0.73,
      "riskLevel": "HIGH",
      "features": {
        "recencyDays": 45,
        "frequencyScore": 0.3,
        "monetaryTrend": -0.15,
        "engagementScore": 0.2
      },
      "computedAt": "2026-03-24T04:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}
```

### POST `/churn-scores/compute`

**Response 200:**
```json
{
  "success": true,
  "data": { "customersScored": 120, "riskDistribution": { "LOW": 60, "MEDIUM": 35, "HIGH": 20, "CRITICAL": 5 } }
}
```

### GET `/churn-scores/:customerId`

**Response 200:** Same shape as list item, with full feature breakdown.

## Algorithm

Weighted scoring using 4 behavioral signals (0.0-1.0 each):

### 1. Recency Score (weight: 0.35)
- Days since last completed transaction at the branch
- Score = exponential decay: `exp(-daysSinceLastVisit / 30)`
- 0 days = 1.0, 30 days = 0.37, 60 days = 0.13, 90 days = 0.05

### 2. Frequency Score (weight: 0.30)
- Visit count in last 90 days vs. historical average (per 90-day window)
- Score = `min(1.0, recentVisits / historicalAvg90d)`
- If no historical average, use 3 visits as baseline

### 3. Monetary Score (weight: 0.20)
- Average spend per visit trend: compare last 3 visits avg vs. overall avg
- Score = `min(1.0, recentAvgSpend / overallAvgSpend)`
- Decreasing spend → lower score → higher churn risk

### 4. Engagement Score (weight: 0.15)
- Binary signals: hasLoyaltyAccount (0.3), hasReviewInLast90d (0.3), hasReferral (0.2), hasPointsActivity (0.2)
- Sum of applicable signals

### Churn Probability
```
healthScore = 0.35 * recency + 0.30 * frequency + 0.20 * monetary + 0.15 * engagement
churnProbability = 1.0 - healthScore
```

### Risk Tiers
- `LOW`: churnProbability < 0.3
- `MEDIUM`: 0.3 ≤ churnProbability < 0.5
- `HIGH`: 0.5 ≤ churnProbability < 0.7
- `CRITICAL`: churnProbability ≥ 0.7

## Cron

Weekly batch: `0 4 * * 1` (Monday 04:00 UTC). Processes all active branches, computing scores for all customers with at least 1 completed transaction.

## Business Rules

1. Only customers with ≥1 completed transaction at the branch are scored.
2. Scores are upserted on each compute run (unique on customerId+branchId).
3. `features` JSON stores the raw input signals for transparency.
4. The `customer` field in responses joins `User` to get name/email.

## Admin UI

New "Churn Risk" tab on the Analytics page:
- Risk distribution donut chart (Recharts `PieChart`)
- Sortable customer table: name, score, risk level, last visit, trend
- "Run Churn Analysis" button for manual compute
- Branch selector

## RBAC

| Route | Feature | Action |
|-------|---------|--------|
| GET `/churn-scores` | ANALYTICS | read |
| POST `/churn-scores/compute` | ANALYTICS | create |
| GET `/churn-scores/:customerId` | ANALYTICS | read |
