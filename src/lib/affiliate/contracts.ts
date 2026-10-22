import { z } from "zod";

export const affiliateDashboardSchema = z.object({
  partner: z.object({
    id: z.string().uuid(),
    display_name: z.string(),
    status: z.string(),
    created_at: z.string(),
  }),
  attributionWindowDays: z.number().int().positive(),
  links: z.array(
    z.object({
      id: z.string().uuid(),
      code: z.string(),
      active: z.boolean(),
      created_at: z.string(),
      visitors: z.number().int().nonnegative(),
      clicks: z.number().int().nonnegative(),
      conversions: z.number().int().nonnegative(),
    }),
  ),
  earnings: z.array(
    z.object({
      currency: z.string(),
      earned: z.number(),
      pending: z.number(),
      available: z.number(),
      paid: z.number(),
    }),
  ),
  commissions: z.array(
    z.object({
      id: z.string().uuid(),
      order_id: z.string().uuid().nullable(),
      gross_amount: z.number(),
      commission_amount: z.number(),
      currency: z.string(),
      status: z.string(),
      earned_at: z.string(),
    }),
  ),
  payouts: z.array(
    z.object({
      id: z.string().uuid(),
      amount: z.number(),
      currency: z.string(),
      status: z.string(),
      requested_at: z.string(),
      completed_at: z.string().nullable(),
    }),
  ),
});

export type AffiliateDashboard = z.infer<typeof affiliateDashboardSchema>;
export type AffiliateDashboardLink = AffiliateDashboard["links"][number];
