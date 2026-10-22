import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuidSchema = z.string().uuid();
const profileInput = z.object({ userId: uuidSchema.optional() });
const awardInput = z.object({
  userId: uuidSchema,
  amount: z.number().int().positive().max(1_000_000),
  reason: z.string().trim().min(1).max(300),
});
const achievementInput = z.object({
  userId: uuidSchema,
  achievementId: uuidSchema,
});

export const getUserAMSProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const targetUserId = data.userId ?? context.userId;
    const { withTaskTransaction } = await import("@/lib/tasks/db.server");
    const { getAmsProfile, requireAmsOperator } = await import("./core.server");
    return withTaskTransaction(context.userId, async (tx) => {
      if (
        targetUserId !== context.userId &&
        !(await requireAmsOperator(tx, context.userId))
      ) {
        throw new Error("You may only view your own AMS profile.");
      }
      return getAmsProfile(tx, targetUserId);
    });
  });

export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { withTaskTransaction } = await import("@/lib/tasks/db.server");
    const { getAmsLeaderboard } = await import("./core.server");
    return withTaskTransaction(context.userId, (tx) => getAmsLeaderboard(tx));
  });

export const awardXP = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => awardInput.parse(input))
  .handler(async ({ data, context }) => {
    const { withTaskTransaction } = await import("@/lib/tasks/db.server");
    const { awardXpInTransaction } = await import("./core.server");
    return withTaskTransaction(context.userId, (tx) =>
      awardXpInTransaction(tx, context.userId, data.userId, data.amount, data.reason),
    );
  });

export const grantAchievement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => achievementInput.parse(input))
  .handler(async ({ data, context }) => {
    const { withTaskTransaction } = await import("@/lib/tasks/db.server");
    const { grantAchievementInTransaction } = await import("./core.server");
    return withTaskTransaction(context.userId, (tx) =>
      grantAchievementInTransaction(
        tx,
        context.userId,
        data.userId,
        data.achievementId,
      ),
    );
  });
