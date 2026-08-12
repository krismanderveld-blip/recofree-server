import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { chatInputSchema, generateAIResponse, type ChatRequestInput } from "./ai-chat";
import { extractionInputSchema, extractEntitiesFromBackpack } from "./backpack-extractor";
import { resolveProvider } from "./_core/llm";
import { analyzeBackpackInputSchema, analyzeBackpackForSchemas } from "./backpack-analyzer";
import { engineProcessInputSchema, processEngineRequest } from "./engine-process";
import { kerp01GenerateInputSchema, generateEigenRegiePlan } from "./kerp01-generate";

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
          const result = await generateAIResponse(input as ChatRequestInput);
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

    // Backpack Entity Extraction — called ONLY when backpack content changed
    extractEntities: publicProcedure
      .input(extractionInputSchema)
      .mutation(async ({ input }) => {
        const { provider } = resolveProvider();
        console.log(`[ROUTER] extractEntities for: ${input.userName} ${input.userType} provider=${provider}`);
        if (provider === 'none') {
          console.error('[ROUTER] extractEntities FAILED: no LLM provider (neither BUILT_IN_FORGE_API_KEY nor OPENAI_API_KEY)');
          return { success: false, entities: null, debug: { extractionProvider: 'none' as const, extractionSuccess: false, reason: 'missing_provider' as const } };
        }
        try {
          const entities = await extractEntitiesFromBackpack(
            {
              userName: input.userName,
              userType: input.userType,
              sections: input.sections,
              kimSections: input.kimSections,
              intakeContext: input.intakeContext,
            },
            input.sourceHash,
          );
          console.log(`[ROUTER] extractEntities SUCCESS: provider=${provider} persons=${entities?.persons?.length ?? 0}`);
          return { success: true, entities, debug: { extractionProvider: provider, extractionSuccess: true, reason: 'success' as const } };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[ROUTER ERROR] extractEntities: provider=${provider} error=${errorMessage}`);
          return { success: false, entities: null, debug: { extractionProvider: provider, extractionSuccess: false, reason: 'provider_error' as const } };
        }
      }),

    // Engine Process — server-side engine pipeline (shadow mode initially)
    engineProcess: publicProcedure
      .input(engineProcessInputSchema)
      .mutation(async ({ input }) => {
        try {
          const result = await processEngineRequest(input);
          return { success: true, ...result };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[ROUTER ERROR] engineProcess:`, errorMessage);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: errorMessage,
          });
        }
      }),

    // KERP01 — AI-powered Eigen Regie Plan generation from life story
    generateEigenRegiePlan: publicProcedure
      .input(kerp01GenerateInputSchema)
      .mutation(async ({ input }) => {
        console.log('[ROUTER] generateEigenRegiePlan for:', input.userName);
        try {
          const result = await generateEigenRegiePlan(input);
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[ROUTER ERROR] generateEigenRegiePlan:`, errorMessage);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: errorMessage,
          });
        }
      }),

    // Backpack Schema/Mode Analysis — called ONLY when backpack sections changed
    // One-time GPT analysis per section change to detect schema/mode candidates
    analyzeBackpack: publicProcedure
      .input(analyzeBackpackInputSchema)
      .mutation(async ({ input }) => {
        console.log('[ROUTER] analyzeBackpack for:', input.userName, input.userType, 'changed:', input.changedSectionIds);
        try {
          const analysis = await analyzeBackpackForSchemas(input);
          return { success: true, analysis };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[ROUTER ERROR] analyzeBackpack:`, errorMessage);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: errorMessage,
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
