# TMNG SaaS Platform — Technical Specification

> [!WARNING]
> **This document is superseded.** The schema references below reflect the original pre-Phase 7 design. For current architecture and schema, see:
> - [database_schema.md](database_schema.md) — Current Prisma schema (46 models, multi-tenant)
> - [platform_architecture.md](platform_architecture.md) — Platform architecture and multi-tenancy model
> - [implementation_plan.md](implementation_plan.md) — Full implementation plan with phase completion status
> - [rbac_system.md](rbac_system.md) — Database-driven RBAC system (25 features)
>
> This file is retained for historical reference of original business requirements and objectives.

## 1. System Overview

The TMNG SaaS Platform is a multi-tenant, industry-agnostic digital ecosystem designed to unify operations across service-based businesses with multiple branches. Architected as a dual-platform solution, the system comprises a high-performance Client Application and a robust Admin Dashboard. The primary objective is to replace fragmented manual processes with an integrated workflow that enhances service quality, optimizes workforce utilization through dynamic allocation, and fosters customer retention via a structured loyalty program. This ecosystem serves as the single source of truth for operational data, ensuring consistency and professionalism across all business locations.

## 2. Business Objectives

The implementation of this system is governed by the following core objectives:

- **Digitalizing Barbershop Operations** — Transitioning from legacy manual tracking to a unified, scalable digital infrastructure.
- **Improving Customer Experience** — Streamlining the service lifecycle to minimize latency and provide predictable scheduling.
- **Enhancing Customer Loyalty** — Utilizing integrated engagement tools to increase customer lifetime value.
- **Optimizing Workforce Management** — Precision organization and real-time tracking of human resources across the network.
- **Centralized Multi-branch Monitoring** — Consolidating performance data from disparate locations into a single management pane.
- **Data-Driven Decision Making** — Leveraging historical and real-time analytics to inform strategic business maneuvers.
- **Increasing Operational Efficiency** — Eliminating workflow redundancies and automating resource-intensive administrative tasks.
- **Strengthening Business Professionalism** — Standardizing brand interactions through modern, reliable technological touchpoints.

## 3. Functional Requirements: Client Application

The Client Application is the primary interface for customer interaction, designed to facilitate self-service and engagement:

- **User Registration & Membership** — Secure account creation module allowing customers to manage personal profiles and participate in the tiered membership program.
- **Online Booking System** — An asynchronous scheduling engine that allows users to select specific branches, dates, and time slots. The system provides real-time availability lookups for preferred barbers to ensure schedule certainty.
- **Loyalty & Rewards** — An automated point-accumulation ledger that tracks transaction volume and enables the redemption of points for discounts or complimentary services.
- **Feedback Mechanism** — A verified review system where customers rate specific barber performance following a completed service, providing branch-specific quality control.
- **Branch Navigation** — A multi-location selector allowing users to toggle between branches and view location-specific services and personnel.

## 4. Functional Requirements: Admin Dashboard

The Admin Dashboard provides branch administrators with tools for granular operational control:

- **Branch Management** — Centralized configuration of branch-specific metadata, including operating hours, location details, and service menus.
- **Workforce Management** — Lifecycle management of barber profiles, including credentials, performance history, and primary branch assignments.
- **Schedule Management** — Comprehensive roster planning tools to manage shifts, time-off requests, and daily barber availability.
- **Attendance Tracking** — Real-time state monitoring of barber availability. The system tracks state transitions (e.g., *Check-in*, *In-Service*, *Break*, *Check-out*) to monitor staff reliability and actual labor hours.
- **Dynamic Workforce Allocation** — A resource-balancing interface that visualizes current barber distribution across the network and facilitates rapid reassignment to mitigate localized staffing shortages.
- **Operational Reporting** — An analytics engine generating transaction summaries, customer throughput metrics, and attendance audits. Reports support multi-dimensional filtering by branch, time-series, and personnel.

## 5. Functional Requirements: Super Admin & Analytics

The Super Admin interface provides the business owner with a global view of the enterprise to drive high-level strategy:

- **Centralized Monitoring** — A holistic dashboard comparing performance parity and operational health across all branches.
- **Key Performance Indicators (KPIs):**
  - **Total Revenue** — Aggregated and branch-specific financial performance.
  - **Booking Volume** — Trend analysis of appointment density and conversion rates.
  - **Membership Growth** — Tracking of new user acquisitions and loyalty program penetration.
- **Strategic Insights** — Identification of top-rated barbers *at each specific location* to facilitate targeted rewards and training. Data-driven trend analysis supports resource planning and expansion decisions.

## 6. Proposed Database Schema

> **Note:** This section shows the original simplified schema from Phase 1. For the current complete schema (46 models with multi-tenancy, RBAC, and generic naming), see [database_schema.md](database_schema.md).

The system utilizes a normalized relational database structure to ensure data integrity and support complex querying.

### Table: Users/Customers

| Field Name     | Data Type | Description                                       |
| -------------- | --------- | ------------------------------------------------- |
| user_id        | UUID      | Primary Key: Unique customer identifier            |
| name           | String    | Full legal name of the user                        |
| email          | String    | Unique email address for authentication            |
| phone_number   | String    | Contact number for SMS notifications and MFA       |
| loyalty_points | Integer   | Current balance of redeemable rewards points       |
| created_at     | Timestamp | Record creation date                               |
| updated_at     | Timestamp | Last record modification date                      |

### Table: Branches

| Field Name    | Data Type | Description                              |
| ------------- | --------- | ---------------------------------------- |
| branch_id     | UUID      | Primary Key: Unique branch identifier     |
| location_name | String    | Internal designation for the branch       |
| address       | String    | Verified physical address                 |
| created_at    | Timestamp | Record creation date                      |
| updated_at    | Timestamp | Last record modification date             |

### Table: Barbers

> **Renamed:** In the current codebase, `Barbers` is now `StaffProfile` with generic naming.

| Field Name        | Data Type | Description                                              |
| ----------------- | --------- | -------------------------------------------------------- |
| barber_id         | UUID      | Primary Key: Unique barber identifier                     |
| name              | String    | Barber's professional name                                |
| current_branch_id | UUID      | Foreign Key: References `Branches(branch_id)`             |
| status            | Enum      | Current state (Available, In-Service, Break, Off-Duty)    |
| average_rating    | Decimal   | Aggregate rating calculated from Reviews table            |
| created_at        | Timestamp | Record creation date                                      |
| updated_at        | Timestamp | Last record modification date                             |

### Table: Bookings

| Field Name   | Data Type | Description                                              |
| ------------ | --------- | -------------------------------------------------------- |
| booking_id   | UUID      | Primary Key: Unique appointment identifier                |
| customer_id  | UUID      | Foreign Key: References `Users(user_id)`                  |
| barber_id    | UUID      | Foreign Key: References `Barbers(barber_id)`              |
| branch_id    | UUID      | Foreign Key: References `Branches(branch_id)`             |
| booking_date | Date      | Scheduled date of service                                 |
| booking_time | Time      | Scheduled start time                                      |
| status       | Enum      | Current state (Pending, Completed, Cancelled, No-show)    |
| created_at   | Timestamp | Record creation date                                      |
| updated_at   | Timestamp | Last record modification date                             |

### Table: Attendance

| Field Name     | Data Type | Description                                      |
| -------------- | --------- | ------------------------------------------------ |
| attendance_id  | UUID      | Primary Key: Unique record identifier             |
| barber_id      | UUID      | Foreign Key: References `Barbers(barber_id)`      |
| check_in_time  | Timestamp | Recorded arrival timestamp                        |
| check_out_time | Timestamp | Recorded departure timestamp                      |
| created_at     | Timestamp | Record creation date                              |

### Table: Transactions/Payments

| Field Name       | Data Type | Description                                      |
| ---------------- | --------- | ------------------------------------------------ |
| transaction_id   | UUID      | Primary Key: Unique transaction identifier        |
| booking_id       | UUID      | Foreign Key: References `Bookings(booking_id)`    |
| revenue_amount   | Decimal   | Gross currency amount paid                        |
| transaction_date | Timestamp | Precise time of financial settlement              |
| created_at       | Timestamp | Record creation date                              |

### Table: Reviews

| Field Name   | Data Type | Description                                      |
| ------------ | --------- | ------------------------------------------------ |
| review_id    | UUID      | Primary Key: Unique review identifier             |
| booking_id   | UUID      | Foreign Key: References `Bookings(booking_id)`    |
| customer_id  | UUID      | Foreign Key: References `Users(user_id)`          |
| barber_id    | UUID      | Foreign Key: References `Barbers(barber_id)`      |
| rating_score | Integer   | Numeric rating (1–5 scale)                        |
| comment_text | Text      | Qualitative feedback content                      |
| created_at   | Timestamp | Record creation date                              |

## 7. Operational Logic & Workflow: Barber Tracking and Allocation

To maintain high availability across the multi-branch network, the system employs a dynamic resource allocation logic driven by real-time demand monitoring and state synchronization.

1. **Threshold Trigger** — The system's monitoring service continuously calculates the Barber-to-Booking ratio for each branch. If the ratio at Branch A exceeds the defined saturation threshold (i.e., demand exceeds service capacity), an "Under-Staffed" alert is triggered on the Admin Dashboard.
2. **Cross-Branch Resource Query** — The administrator initiates a Resource Availability Lookup. The system queries the Barbers table filtered by `status = 'Available'` and attendance status across all other branch IDs.
3. **Concurrency Evaluation** — The system evaluates upcoming Bookings at potential donor branches to ensure that reassigning a barber will not create a concurrency conflict or subsequent shortage at the source location.
4. **State Synchronization and Update** — Upon executing the reassignment, the system performs an atomic update on the barber's `current_branch_id`.
5. **Push Notification & Deployment** — The system pushes a real-time notification to the barber's mobile interface. Simultaneously, the barber becomes immediately available for online booking at the target branch, ensuring zero downtime in the allocation process.
