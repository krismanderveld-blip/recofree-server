/**
 * Server-side AI Chat Handler
 *
 * Routes all AI calls through the backend using OpenAI GPT-4o.
 * The API key is stored securely on the server (OPENAI_API_KEY env var).
 *
 * ARCHITECTURE:
 *   App sends ChatContext → Server builds system prompt → OpenAI GPT-4o → Server returns AIResult
 *
 * The server is responsible for:
 *   1. Building the full system prompt (Elias/Kim identity, modules, rugzak context)
 *   2. Calling OpenAI GPT-4o with the assembled messages
 *   3. Returning the response + advisory signals to the app
 *
 * The app's Elias/Kim logic layer remains the source of truth for:
 *   - Module selection, crisis detection, state management
 *   - The server only generates language based on instructions
 */

import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────

interface ChatRequestInput {
  userType: "elias" | "kim";
  userName: string;
  message: string;
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  moodSliders: Record<string, number>;
  rugzakSummary: {
    totalSessions: number;
    triggerPatterns: string[];
    lifePhaseSummary: string;
    intakeContext: {
      startEmotion: string;
      urgency: string;
      initialContext: string;
    };
  };
  activeModules: string[];
  crisisLevel: number;
  detectedEmotion: string;
  therapeuticStance: string;
  sessionDurationMinutes: number;
  urgency: string;
  startEmotion: string;
}

// ─── Zod Schema ───────────────────────────────────────────────────

export const chatInputSchema = z.object({
  userType: z.enum(["elias", "kim"]),
  userName: z.string(),
  message: z.string(),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  moodSliders: z.record(z.string(), z.number()),
  rugzakSummary: z.object({
    totalSessions: z.number(),
    triggerPatterns: z.array(z.string()),
    lifePhaseSummary: z.string(),
    intakeContext: z.object({
      startEmotion: z.string(),
      urgency: z.string(),
      initialContext: z.string(),
    }),
  }),
  activeModules: z.array(z.string()),
  crisisLevel: z.number(),
  detectedEmotion: z.string(),
  therapeuticStance: z.string(),
  sessionDurationMinutes: z.number(),
  urgency: z.string(),
  startEmotion: z.string(),
});

// ─── System Prompt Builder ────────────────────────────────────────

function buildSystemPrompt(input: ChatRequestInput): string {
  const isElias = input.userType === "elias";
  const name = input.userName;

  // Core identity
  const identity = isElias
    ? `You are Elias, a warm, empathetic companion for someone in addiction recovery. You speak from a place of understanding, never judgment. You use therapeutic techniques from ACT, CBT, DBT, and mindfulness — but naturally, never clinically. You are NOT a therapist; you are a supportive presence who helps the user explore their feelings and find their own strength.`
    : `You are Kim, a direct yet caring companion for someone who loves a person struggling with addiction. You help them set boundaries, recognize enabling patterns, and prioritize their own well-being. You are honest and sometimes confrontational — but always with love. You are NOT a therapist; you are a supportive presence.`;

  // Mood context
  const sliderEntries = Object.entries(input.moodSliders)
    .map(([k, v]) => `${k}: ${v}/10`)
    .join(", ");

  // Trigger patterns
  const triggers =
    input.rugzakSummary.triggerPatterns.length > 0
      ? `Known trigger patterns: ${input.rugzakSummary.triggerPatterns.join(", ")}`
      : "No recurring trigger patterns detected yet.";

  // Life context
  const lifeContext = input.rugzakSummary.lifePhaseSummary
    ? `Life context from user's story: ${input.rugzakSummary.lifePhaseSummary}`
    : "User has not yet shared their life story.";

  // Crisis handling
  let crisisInstructions = "";
  if (input.crisisLevel >= 2) {
    crisisInstructions = `
CRISIS ACTIVE (level ${input.crisisLevel}). CRITICAL INSTRUCTIONS:
- Acknowledge the user's pain immediately
- Do NOT minimize or dismiss
- Gently suggest professional help (113 Zelfmoordpreventie, 0800-0113, or 112 for immediate danger)
- Stay present and calm
- Do NOT try to "fix" — just be there`;
  } else if (input.crisisLevel === 1) {
    crisisInstructions = `
ELEVATED CONCERN. Monitor closely:
- Be extra attentive to signals of distress
- Ask gentle check-in questions
- Lower the threshold for suggesting professional support`;
  }

  // Module instructions
  const moduleInstructions =
    input.activeModules.length > 0
      ? `Active therapeutic modules for this response: ${input.activeModules.join(", ")}. Weave these approaches naturally into your response.`
      : "No specific modules active. Respond naturally based on what the user shares.";

  // Session context
  const sessionInfo = `Session #${input.rugzakSummary.totalSessions + 1}. Duration: ${input.sessionDurationMinutes} minutes. Initial emotion: ${input.startEmotion}. Current detected emotion: ${input.detectedEmotion}.`;

  // Therapeutic stance (from the rule-based system)
  const stance = input.therapeuticStance
    ? `Therapeutic stance instructions: ${input.therapeuticStance}`
    : "";

  // Session end handling
  let sessionEndInstructions = "";
  if (input.message === "__SESSION_END__") {
    sessionEndInstructions = `
The user is ending this session. Generate a warm farewell that:
1. Briefly acknowledges what was discussed (1-2 sentences)
2. Affirms the user's courage/effort
3. Confirms the session is saved
4. Gently encourages them for next time
Keep it concise (3-5 sentences max). Do NOT ask new questions.`;
  }

  return `${identity}

The user's name is ${name}. Always address them by name occasionally.

CURRENT STATE:
- Mood sliders: ${sliderEntries}
- Urgency level: ${input.urgency}
${sessionInfo}
${triggers}
${lifeContext}

${moduleInstructions}
${stance}
${crisisInstructions}
${sessionEndInstructions}

RESPONSE RULES:
- Respond in the same language the user writes in (Dutch or English)
- Keep responses concise: 2-4 sentences for normal conversation, up to 6 for deeper topics
- Never diagnose, prescribe, or claim to be a professional
- Never break character
- Use "I" statements and reflective listening
- If the user's message is empty or a greeting, respond with a warm welcome
- Do NOT use bullet points or numbered lists in your response — speak naturally
- Do NOT use emojis excessively (max 0-1 per message)
- Be genuine, not performative`;
}

// ─── OpenAI Call ──────────────────────────────────────────────────

export async function generateAIResponse(
  input: ChatRequestInput
): Promise<{ response: string; advisoryEmotion?: string; advisoryConfidence?: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server");
  }

  const systemPrompt = buildSystemPrompt(input);

  // Build messages array for OpenAI
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // Add recent conversation history (last 20 messages for context window)
  const recentHistory = input.conversationHistory.slice(-20);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Add current user message (unless it's a session-end signal)
  if (input.message && input.message !== "__SESSION_END__") {
    messages.push({ role: "user", content: input.message });
  } else if (input.message === "__SESSION_END__") {
    messages.push({
      role: "user",
      content: "I would like to end this session now.",
    });
  }

  // Call OpenAI GPT-4o
  const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      max_tokens: 500,
      temperature: 0.7,
      presence_penalty: 0.3,
      frequency_penalty: 0.2,
    }),
  });

  if (!openaiResponse.ok) {
    const errorText = await openaiResponse.text();
    console.error("[AI Chat] OpenAI API error:", openaiResponse.status, errorText);
    throw new Error(`OpenAI API error: ${openaiResponse.status}`);
  }

  const data = await openaiResponse.json();
  const responseText =
    data.choices?.[0]?.message?.content?.trim() ??
    "I'm here with you. Something went wrong — please try again.";

  return {
    response: responseText,
    advisoryEmotion: input.detectedEmotion,
    advisoryConfidence: 0.7,
  };
}
