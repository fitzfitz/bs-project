export type ServiceTierSurchargeWire = {
  id: string;
  serviceId: string;
  organizationId: string;
  tier: string;
  surcharge: number;
};

/** Combo child row includes nested service scalar (API ComboServiceWithChildSchema). */
export type ServiceComboChildWire = {
  id: string;
  comboId: string;
  childServiceId: string;
  organizationId: string;
  childService?: {
    id: string;
    organizationId?: string;
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
};

export type ServiceBranchOverrideWire = {
  id: string;
  branchId: string;
  serviceId: string;
  organizationId: string;
  overridePrice: number | null;
  isActive: boolean;
};

export type ServiceResponse = {
  id: string;
  organizationId?: string;
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
  tierSurcharges?: ServiceTierSurchargeWire[];
  comboChildren?: ServiceComboChildWire[];
  branchOverrides?: ServiceBranchOverrideWire[];
};

export type BarberUserResponse = {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  email?: string;
  phone?: string | null;
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
};

export type BarberResponse = {
  id: string;
  userId?: string;
  organizationId?: string;
  tier: string;
  bio?: string | null;
  status?: string;
  commissionModel?: string;
  commissionRate?: number;
  baseSalary?: number | null;
  bonusRate?: number;
  specialties: string[];
  averageRating: number;
  totalReviews: number;
  user: BarberUserResponse;
};

export type CreateBookingInput = {
  branchId: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  staffProfileId?: string;
  serviceIds: string[];
  startTime: string;
  estimatedDuration: number;
  source: 'APP' | 'WEB' | 'WALK_IN';
  notes?: string;
};

/** Queue entry returned by POST /queue; optional self-service fields when API supports them. */
export type QueueEntryCreateResponse = {
  id: string;
  prepaymentAvailable?: boolean;
  /** Deposit amount in minor units / IDR as returned by API */
  depositAmount?: number;
};
