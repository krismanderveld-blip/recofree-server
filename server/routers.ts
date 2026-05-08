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
        try {
          const result = await generateAIResponse(input);
          return {
            success: true as const,
            response: result.response,
            advisoryEmotion: result.advisoryEmotion,
            advisoryConfidence: result.advisoryConfidence,
            tokenUsage: result.tokenUsage,
          };
        } catch (error: any) {
          console.error("[AI Chat] Router error:", error?.message ?? error);
          if (error?.stack) console.error("[AI Chat] Stack:", error.stack);
          return {
            success: false as const,
            response:
              "Something went wrong with the connection. I'm still here — please try again.",
            advisoryEmotion: undefined,
            advisoryConfidence: undefined,
            tokenUsage: undefined,
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
