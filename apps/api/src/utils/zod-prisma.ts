import { z } from "@hono/zod-openapi";

// ============================================================================
// Prisma Enum Zod Schemas
// ============================================================================

export const PlatformRoleEnum = z.enum(["PLATFORM_ADMIN", "PLATFORM_SUPPORT"]);

export const IndustryTypeEnum = z.enum([
  "BARBERSHOP", "VET_CLINIC", "MASSAGE", "NAIL_SALON", "SPA",
  "PET_GROOMING", "DENTAL_CLINIC", "AUTO_DETAILING", "BEAUTY_SALON",
  "TATTOO_PARLOR", "GENERAL_SERVICE",
]);

export const FeatureModuleEnum = z.enum(["CORE", "OPS", "FINANCE", "INTEL", "ENGAGE", "ADMIN"]);

export const RoleScopeEnum = z.enum(["HQ", "BRANCH", "CUSTOMER"]);

export const AuthProviderEnum = z.enum(["EMAIL", "GOOGLE"]);

export const StaffTierEnum = z.enum(["JUNIOR", "SENIOR", "MASTER"]);

export const StaffStatusEnum = z.enum([
  "AVAILABLE", "BUSY", "ON_BREAK", "RESERVED", "OFF_DUTY",
]);

export const QueueSourceEnum = z.enum(["APP", "WEB", "WALK_IN"]);

export const QueueStatusEnum = z.enum([
  "WAITING", "CALLED", "IN_SERVICE", "COMPLETED",
  "AT_CHECKOUT", "PAID", "NO_SHOW", "CANCELLED",
]);

export const WaitlistStatusEnum = z.enum([
  "WAITING",
  "NOTIFIED",
  "CONVERTED",
  "EXPIRED",
  "CANCELLED",
]);

export const BookingStatusEnum = z.enum(["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]);

export const PaymentMethodEnum = z.enum(["CASH", "CARD", "QRIS", "DIGITAL_WALLET"]);

export const TransactionStatusEnum = z.enum(["PENDING", "COMPLETED", "VOIDED", "REFUNDED"]);

export const CommissionModelEnum = z.enum(["FLAT_PERCENTAGE", "SLIDING_SCALE", "BASE_PLUS_BONUS"]);

export const PayrollStatusEnum = z.enum([
  "DRAFT", "PENDING_APPROVAL", "APPROVED", "DISPUTED", "DISBURSED",
]);

export const LoyaltyTierEnum = z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]);

export const ReferralStatusEnum = z.enum(["PENDING", "COMPLETED", "EXPIRED"]);

export const CampaignTypeEnum = z.enum(["EMAIL", "PUSH", "IN_APP"]);

export const CampaignStatusEnum = z.enum([
  "DRAFT", "SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED",
]);

export const ServiceTypeEnum = z.enum(["STANDARD", "COMBO", "ADD_ON"]);

export const DiscountTypeEnum = z.enum(["PERCENTAGE", "FIXED"]);

export const StockMovementTypeEnum = z.enum(["IN", "OUT", "ADJUSTMENT", "VOID_REVERSAL"]);

export const DayOfWeekEnum = z.enum([
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY",
  "FRIDAY", "SATURDAY", "SUNDAY",
]);

export const TipDistributionEnum = z.enum(["PER_STAFF", "POOLED"]);

export const CashDrawerStatusEnum = z.enum(["OPEN", "CLOSED"]);

export const CashEntryTypeEnum = z.enum(["SALE", "REFUND", "ADJUSTMENT", "FLOAT"]);

export const AuditActionEnum = z.enum([
  "CREATE", "UPDATE", "DELETE", "VOID_TRANSACTION", "REFUND_TRANSACTION", "APPLY_DISCOUNT",
  "OVERRIDE_SCHEDULE", "CLOCK_IN", "CLOCK_OUT", "APPROVE_PAYROLL", "DISBURSE_PAYROLL",
  "DISPUTE_PAYROLL", "EARN_POINTS", "REDEEM_POINTS", "TIER_UPGRADE",
  "REFERRAL_REWARD", "MODERATE_REVIEW", "CREATE_CAMPAIGN",
  "EMERGENCY_CLOSURE", "BRANCH_REOPENED", "STATUS_CHANGE",
  "ASSIGN_ROLE", "REMOVE_ROLE", "DEACTIVATE_USER",
  "BRANCH_ASSIGNMENT", "ANOMALY_FLAGGED",
]);

export const AnomalyTypeEnum = z.enum([
  "EXCESSIVE_VOIDS", "HIGH_DISCOUNT", "OFF_HOURS_CLOCKIN",
  "UNUSUAL_REFUND", "INVENTORY_DISCREPANCY",
]);

export const AnomSeverityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

// ============================================================================
// Reusable Nested Shapes
// ============================================================================

export const UserSummarySchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
});

export const UserSummaryWithEmailSchema = UserSummarySchema.extend({
  email: z.string(),
});

export const BranchSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const PermissionActionsSchema = z.object({
  canCreate: z.boolean(),
  canRead: z.boolean(),
  canUpdate: z.boolean(),
  canDelete: z.boolean(),
});
