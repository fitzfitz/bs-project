# API — Reports (Generate, CSV Export, PDF Export, Scheduled Reports, Templates)

## Overview

The **reports** module lets admin staff generate tabular reports for a branch and date range, export as **CSV** or **PDF**, create **scheduled email reports**, and save **report templates** for reuse.

## Endpoints

| Method | Path | Auth | Permission | Description |
|--------|------|------|------------|-------------|
| GET | `/reports/generate` | JWT | `REPORTS.read` | Generate report data (JSON) |
| GET | `/reports/export/csv` | JWT | `REPORTS.read` | Export report as CSV download |
| GET | `/reports/export/pdf` | JWT | `REPORTS.read` | Export report as PDF download |
| GET | `/reports/schedules` | JWT | `REPORTS.read` | List org's scheduled reports |
| POST | `/reports/schedules` | JWT | `REPORTS.create` | Create a report schedule |
| PATCH | `/reports/schedules/:id` | JWT | `REPORTS.update` | Update a schedule |
| DELETE | `/reports/schedules/:id` | JWT | `REPORTS.delete` | Delete a schedule |
| GET | `/reports/templates` | JWT | `REPORTS.read` | List saved report templates |
| POST | `/reports/templates` | JWT | `REPORTS.create` | Save a report template |
| DELETE | `/reports/templates/:id` | JWT | `REPORTS.delete` | Delete a template |

## Report Types

- `daily_revenue` — BranchDailySnapshot per day for a branch/date range
- `service_popularity` — Completed TransactionItem grouped by service name
- `barber_leaderboard` / `staff_leaderboard` — Staff earnings leaderboard (aliases)
- `customer_visits` — Completed transactions per customer
- `booking_source` — QueueEntry grouped by source

## PDF Export

- Same query params as CSV: `type`, `branchId`, `dateFrom`, `dateTo`
- Generates a formatted PDF document with:
  - Report type title header
  - Date range subtitle (from query `dateFrom` / `dateTo`)
  - Table with column headers and data rows
  - Footer: `Generated at: <ISO-8601 timestamp>`
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="<type>_<dateFrom>_<dateTo>.pdf"`

## Scheduled Reports

### Database Model: `ReportSchedule`

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | Org scope (FK) |
| branchId | String? | Optional branch filter |
| reportType | String | One of the report type enums |
| frequency | Enum | DAILY, WEEKLY, MONTHLY |
| recipients | String[] | Email addresses |
| filters | Json | Additional filters (dateRange relative: last_7d, last_30d, etc.) |
| isActive | Boolean | Enable/disable toggle |
| lastSentAt | DateTime? | Last successful send |
| nextRunAt | DateTime | Next scheduled run |
| createdBy | String | User who created (FK) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Database Model: `SavedReportTemplate`

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | Org scope (FK) |
| name | String | Template display name |
| reportType | String | One of the report type enums |
| filters | Json | Saved filter configuration |
| createdBy | String | User who created (FK) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Cron Job

- **Schedule:** Every hour (0 * * * *)
- **Logic:** Find active schedules where `nextRunAt <= now` and `isActive`, resolve `branchId` from schedule or `filters.branchId`, resolve date range from `filters.dateFrom`/`dateTo` or prior period by frequency, generate report, attempt email with PDF + CSV attachments, then update `lastSentAt` and `nextRunAt` (via `computeNextRunAt`)
- **Graceful degradation:** When SMTP is not configured, `sendEmail` no-ops (logged); schedule timestamps are still advanced so jobs do not stall

## Email Service

- SMTP-based email via `nodemailer`
- Env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Graceful degradation when SMTP not configured

## Business Rules

1. All report endpoints require `REPORTS` permission
2. Reports are org-scoped (organizationId from JWT)
3. Schedules can only be managed by users with `REPORTS.create/update/delete`
4. Templates are org-scoped; list/read use `REPORTS.read`, create uses `REPORTS.create`, delete uses `REPORTS.delete`

## RBAC

- `REPORTS` feature code with `read`, `create`, `update`, `delete` actions
