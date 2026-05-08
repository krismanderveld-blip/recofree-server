import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { chatInputSchema, generateAIResponse } from "./ai-chat";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // AI Chat endpoint — routes through OpenAI GPT-4o server-side
  ai: router({
    chat: publicProcedure
      .input(chatInputSchema)
      .mutation(async ({ input }) => {
        console.log('[ROUTER] userType:', input.userType);
        console.log('[ROUTER] isSessionStart:', input.isSessionStart);

        try {
          const result = await generateAIResponse(input);
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[ROUTER ERROR] userType=${input.userType}:`, errorMessage);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `[${input.userType}] ${errorMessage}`,
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
