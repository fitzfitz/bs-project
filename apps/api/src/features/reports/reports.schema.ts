import { z } from "zod";

export const generateReportQuery = z.object({
  type: z.enum(["daily_revenue", "service_popularity", "barber_leaderboard", "staff_leaderboard", "customer_visits", "booking_source"]),
  branchId: z.string(),
  dateFrom: z.string(),
  dateTo: z.string(),
});

export const exportCsvQuery = z.object({
  type: z.enum(["daily_revenue", "service_popularity", "barber_leaderboard", "staff_leaderboard", "customer_visits", "booking_source"]),
  branchId: z.string(),
  dateFrom: z.string(),
  dateTo: z.string(),
});
