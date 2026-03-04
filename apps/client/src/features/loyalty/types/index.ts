export type LoyaltyTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export type CustomerMembership = {
  id: string;
  userId: string;
  pointsBalance: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  tierMultiplier: number;
  pointsExpiringAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
};

export type LoyaltyTransaction = {
  id: string;
  points: number;
  description: string;
  transactionId: string | null;
  createdAt: string;
};

export type ReferralStatus = "PENDING" | "COMPLETED" | "EXPIRED";

export type ReferralHistoryItem = {
  id: string;
  status: ReferralStatus;
  bonusPoints: number;
  refereeName: string;
  completedAt: string | null;
  createdAt: string;
};

export const TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  BRONZE: 0,
  SILVER: 200,
  GOLD: 500,
  PLATINUM: 1000,
};

export const TIER_MULTIPLIERS: Record<LoyaltyTier, number> = {
  BRONZE: 1.0,
  SILVER: 1.25,
  GOLD: 1.5,
  PLATINUM: 2.0,
};

export const TIER_ORDER: LoyaltyTier[] = [
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
];

export const TIER_COLORS: Record<LoyaltyTier, string> = {
  BRONZE: "#CD7F32",
  SILVER: "#A8A8A8",
  GOLD: "#D4A017",
  PLATINUM: "#7B68AE",
};

export const POINTS_VALUE_IDR = 500;
