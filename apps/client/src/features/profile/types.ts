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
  phone?: string;
  tenantRoleId: string;
  tenantRole?: { name: string; scope: string };
};

export type BookingHistoryItem = {
  id: string;
  status: string;
  customerName: string;
  estimatedStartTime: string;
  scheduledFor: string | null;
  createdAt: string;
  calledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  estimatedDuration: number;
  branchId: string;
  staffProfileId?: string;
  branch?: { name: string };
  staff?: { user: { firstName: string; lastName: string } };
  booking?: {
    id: string;
    scheduledAt: string;
    note?: string;
    items?: { service: { name: string; durationMinutes: number; basePrice: number } }[];
  };
  transaction?: { id: string };
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
