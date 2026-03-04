export type ServiceResponse = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  type: string;
  basePrice: number;
  durationMinutes: number;
  bufferMinutes: number;
  isCommissionable: boolean;
  loyaltyEligible: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type BarberResponse = {
  id: string;
  tier: string;
  specialties: string[];
  avatarUrl?: string;
  averageRating: number;
  totalReviews: number;
  user: {
    firstName: string;
    lastName: string;
  };
};

export type CreateBookingInput = {
  branchId: string;
  customerId?: string;
  customerName: string;
  staffProfileId?: string;
  serviceIds: string[];
  startTime: string;
  estimatedDuration: number;
  source: 'APP' | 'WEB' | 'WALK_IN';
};
