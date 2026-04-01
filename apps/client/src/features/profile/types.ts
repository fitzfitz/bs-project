import { z } from "zod";

export const UpdateProfileSchema = z.object({
  firstName: z.string().min(2, "First name is too short"),
  lastName: z.string().min(2, "Last name is too short"),
  phone: z.string().optional(),
});

export type UpdateProfileFormValues = z.infer<typeof UpdateProfileSchema>;

export type UserProfileResponse = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  tenantRoleId: string;
  organizationId: string;
  branchId: string | null;
  isCustomer: boolean;
  emailOptIn?: boolean;
  tenantRole: { id: string; name: string; scope: string } | null;
  staffProfile: { id: string; tier: string } | null;
  permissions?: Record<string, { canCreate: boolean; canRead: boolean; canUpdate: boolean; canDelete: boolean }>;
};

/** Shape returned by `PATCH /auth/me` only — do not use as full profile or session user. */
export type UpdateProfileResponse = {
  id: string;
  organizationId: string;
  tenantRoleId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  isCustomer: boolean;
};

/** Branch on `GET /queue/me` rows (API BranchResponseSchema); extra keys allowed. */
export type BookingHistoryBranch = {
  id: string;
  organizationId?: string;
  name: string;
  address: string;
  city: string;
  phone?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl?: string | null;
  isActive?: boolean;
  isEmergencyClosed?: boolean;
  tipDistribution?: string | null;
  maxDiscountPercent?: number | null;
  averageRating?: number;
  totalReviews?: number;
  createdAt?: string;
  updatedAt?: string;
} & Record<string, unknown>;

/** Transaction on queue/me when present (API QueueTransactionSchema); extra keys allowed. */
export type BookingHistoryTransaction = {
  id: string;
  organizationId: string;
  branchId: string;
  queueEntryId?: string | null;
  staffProfileId?: string | null;
  customerId?: string | null;
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  tipAmount: number;
  netAmount: number;
  totalDue: number;
  loyaltyPointsUsed: number;
  loyaltyPointsEarned: number;
  promoCode?: string | null;
  status: string;
  clientUuid?: string | null;
  createdAt: string;
  updatedAt: string;
} & Record<string, unknown>;

export type BookingHistoryStaffUser = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string | null;
  avatar?: string | null;
  organizationId?: string;
  tenantRoleId?: string;
  branchId?: string | null;
  isCustomer?: boolean;
  isActive?: boolean;
  authProvider?: string;
  googleId?: string | null;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
} & Record<string, unknown>;

export type BookingHistoryStaff = {
  id: string;
  userId?: string;
  organizationId?: string;
  bio?: string | null;
  specialties: string[];
  tier: string;
  status?: string;
  commissionModel?: string;
  commissionRate?: number;
  baseSalary?: number | null;
  bonusRate?: number;
  averageRating: number;
  totalReviews: number;
  user: BookingHistoryStaffUser;
} & Record<string, unknown>;

/** Booking on queue/me when non-null: `scheduledAt` is always set (API QueueBookingDetailSchema). */
export type BookingHistoryBookingDetail = {
  id: string;
  organizationId?: string;
  customerId?: string;
  branchId?: string;
  staffProfileId?: string | null;
  status?: string;
  scheduledAt: string;
  totalDuration: number;
  note?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  items: Array<{
    id?: string;
    bookingId?: string;
    serviceId?: string;
    organizationId?: string;
    price?: number;
    isAddOn?: boolean;
    service: {
      id: string;
      organizationId?: string;
      name: string;
      description?: string | null;
      category?: string;
      type?: string;
      basePrice: number;
      durationMinutes: number;
      bufferMinutes?: number;
      isCommissionable?: boolean;
      loyaltyEligible?: boolean;
      isActive?: boolean;
      sortOrder?: number;
      createdAt?: string;
      updatedAt?: string;
    };
  }>;
} & Record<string, unknown>;

export type BookingHistoryItem = {
  id: string;
  organizationId: string;
  branchId: string;
  staffProfileId: string | null;
  bookingId: string | null;
  customerId: string | null;
  status: string;
  source: string;
  position: number;
  customerName: string | null;
  estimatedWait: number | null;
  calledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  staff: BookingHistoryStaff | null;
  branch: BookingHistoryBranch;
  booking: BookingHistoryBookingDetail | null;
  transaction?: BookingHistoryTransaction | null;
};

export type ReceiptData = {
  receiptNumber: string;
  date: string;
  branchId: string;
  branchName: string;
  branchAddress: string;
  cashierName: string;
  staffProfileId: string | null;
  staffName: string | null;
  queueEntryId: string | null;
  items: { name: string; qty: number; unitPrice: number; discount: number; total: number }[];
  subtotal: number;
  discountTotal: number;
  tax: number;
  tip: number;
  grandTotal: number;
  payments: { method: string; amount: number }[];
  loyaltyPointsEarned: number;
};
