import {
  getSessionCookieName,
  getSessionCookieOptions,
} from "./_core/cookies";
import { getDailySalesByIdempotencyKey, insertDailySalesInbox } from "./db";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

const dailySalesItemInput = z.object({
  item: z.string().trim().max(255),
  quantity: z.number().positive().max(100000),
  totalAmount: z.number().nonnegative().max(100000000),
});

const dailySalesInput = z.object({
  idempotencyKey: z.string().trim().min(8).max(80),
  employeeId: z.string().trim().min(1).max(64),
  salesDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "salesDate must use YYYY-MM-DD"),
  location: z.string().trim().min(1).max(255),
  store: z.string().trim().min(1).max(255),
  totalAmount: z.number().nonnegative().max(100000000),
  items: z.array(dailySalesItemInput).max(100),
});

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(getSessionCookieName(ctx.req), {
        ...cookieOptions,
        maxAge: -1,
      });
      return {
        success: true,
      } as const;
    }),
  }),

  dailySales: router({
    /**
     * Staging-friendly inbox endpoint. It never connects to the old portal
     * database; the portal-side worker reads pending rows separately.
     */
    submit: publicProcedure.input(dailySalesInput).mutation(async ({ input }) => {
      const existing = await getDailySalesByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        return {
          reportId: existing.id,
          status: existing.status,
          duplicate: true,
        } as const;
      }

      const reportId = crypto.randomUUID();
      await insertDailySalesInbox({
        id: reportId,
        idempotencyKey: input.idempotencyKey,
        employeeId: input.employeeId,
        salesDate: input.salesDate,
        location: input.location,
        store: input.store,
        totalAmount: input.totalAmount.toFixed(2),
        itemsJson: JSON.stringify(input.items),
        status: "pending",
      });

      return {
        reportId,
        status: "pending" as const,
        duplicate: false,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
