import { z } from "zod";

export const updateConfigBody = z.object({
  value: z.string(),
});

export const CONFIG_DEFAULTS: Record<string, string> = {
  POINTS_EARN_RATE: "10000",
  POINTS_REDEEM_RATE: "500",
  POINTS_EXPIRY_MONTHS: "6",
  MAX_REDEMPTION_PERCENT: "50",
  REFERRAL_BONUS_POINTS: "50",
  REFERRAL_EXPIRY_DAYS: "30",
  CASHIER_DISCOUNT_LIMIT: "10",
  TAX_RATE: "12",
  COMMISSION_RATE_MASTER: "40",
  COMMISSION_RATE_SENIOR: "35",
  COMMISSION_RATE_JUNIOR: "30",
};
