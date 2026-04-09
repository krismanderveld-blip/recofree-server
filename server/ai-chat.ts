/**
 * Server-side AI Chat Handler
 *
 * Routes all AI calls through the backend using OpenAI GPT-4o.
 * The API key is stored securely on the server (OPENAI_API_KEY env var).
 *
 * ARCHITECTURE:
 *   App sends full context → Server builds system prompt → OpenAI GPT-4o → Server returns AIResult
 *
 * The RUGZAK is the user's persistent personal memory:
 *   - Life story sections (childhood, adolescence, adulthood, family, themes)
 *   - Trigger patterns detected over time
 *   - Mood history across sessions
 *   - Module usage history
 *   - Intake context
 *
 * The rugzak is loaded from local storage on the device and sent with each request.
 * The AI MUST use this data as if it personally knows the user.
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
  rugzakFull: {
    totalSessions: number;
    lifeStory: Array<{
      id: string;
      label: string;
      ageRange: string;
      content: string;
    }>;
    triggerPatterns: Array<{
      trigger: string;
      count: number;
      firstSeen: string;
      lastSeen: string;
    }>;
    moodHistory: Array<{
      sliders: Record<string, number>;
      timestamp: string;
    }>;
    moduleUsageSummary: string[];
    intakeContext: {
      startEmotion: string;
      urgency: string;
      initialContext: string;
      intakeDate: string;
    };
    lastSessionDate: string | null;
    createdAt: string;
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
  rugzakFull: z.object({
    totalSessions: z.number(),
    lifeStory: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        ageRange: z.string(),
        content: z.string(),
      })
    ),
    triggerPatterns: z.array(
      z.object({
        trigger: z.string(),
        count: z.number(),
        firstSeen: z.string(),
        lastSeen: z.string(),
      })
    ),
    moodHistory: z.array(
      z.object({
        sliders: z.record(z.string(), z.number()),
        timestamp: z.string(),
      })
    ),
    moduleUsageSummary: z.array(z.string()),
    intakeContext: z.object({
      startEmotion: z.string(),
      urgency: z.string(),
      initialContext: z.string(),
      intakeDate: z.string(),
    }),
    lastSessionDate: z.nullable(z.string()),
    createdAt: z.string(),
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

  // ── CORE IDENTITY ──
  const identity = isElias
    ? `You are Elias, a warm, empathetic companion for someone in addiction recovery. You speak from a place of understanding, never judgment. You use therapeutic techniques from ACT, CBT, DBT, and mindfulness — but naturally, never clinically. You are NOT a therapist; you are a supportive presence who helps the user explore their feelings and find their own strength.`
    : `You are Kim, a direct yet caring companion for someone who loves a person struggling with addiction. You help them set boundaries, recognize enabling patterns, and prioritize their own well-being. You are honest and sometimes confrontational — but always with love. You are NOT a therapist; you are a supportive presence.`;

  // ── PERSONAL MEMORY (RUGZAK) ──
  // This is the BACKBONE of the user's history. You KNOW this person.
  const rugzak = input.rugzakFull;

  let personalMemory = `\n=== YOUR PERSONAL MEMORY OF ${name.toUpperCase()} ===\nYou have known ${name} across ${rugzak.totalSessions} previous sessions.`;

  if (rugzak.intakeContext.initialContext) {
    personalMemory += `\nWhen ${name} first came to you, they shared: "${rugzak.intakeContext.initialContext}"`;
    personalMemory += `\nTheir initial emotion was: ${rugzak.intakeContext.startEmotion}`;
    personalMemory += `\nUrgency at intake: ${rugzak.intakeContext.urgency}`;
    if (rugzak.intakeContext.intakeDate) {
      personalMemory += `\nFirst session: ${rugzak.intakeContext.intakeDate}`;
    }
  }

  // Life story — the user's personal narrative
  if (rugzak.lifeStory.length > 0) {
    personalMemory += `\n\n--- ${name}'s LIFE STORY (shared by ${name} personally) ---`;
    for (const section of rugzak.lifeStory) {
      personalMemory += `\n\n[${section.label} (${section.ageRange})]:\n${section.content}`;
    }
    personalMemory += `\n--- END LIFE STORY ---`;
    personalMemory += `\n\nYou KNOW this story. Reference it naturally when relevant. If ${name} mentions a person, place, or event from their story, you recognize it immediately. You do NOT ask them to repeat what they already told you.`;
  } else {
    personalMemory += `\n${name} has not yet shared their life story with you. You can gently invite them to share when appropriate, but never pressure.`;
  }

  // Trigger patterns — recurring vulnerabilities
  if (rugzak.triggerPatterns.length > 0) {
    personalMemory += `\n\n--- KNOWN TRIGGER PATTERNS ---`;
    for (const tp of rugzak.triggerPatterns) {
      personalMemory += `\n- "${tp.trigger}" (detected ${tp.count}x, first: ${tp.firstSeen}, last: ${tp.lastSeen})`;
    }
    personalMemory += `\nThese are recurring patterns you've observed. Be alert when these themes come up. You can gently name them: "I notice this connects to something we've seen before..."`;
  }

  // Mood history — trajectory across sessions
  if (rugzak.moodHistory.length > 0) {
    const recent = rugzak.moodHistory.slice(-5);
    personalMemory += `\n\n--- MOOD TRAJECTORY (last ${recent.length} check-ins) ---`;
    for (const mh of recent) {
      const sliderStr = Object.entries(mh.sliders).map(([k, v]) => `${k}: ${v}/10`).join(", ");
      personalMemory += `\n- ${mh.timestamp}: ${sliderStr}`;
    }
  }

  // Module usage — what therapeutic approaches have been used
  if (rugzak.moduleUsageSummary.length > 0) {
    personalMemory += `\n\nTherapeutic modules previously used with ${name}: ${rugzak.moduleUsageSummary.join(", ")}`;
  }

  personalMemory += `\n=== END PERSONAL MEMORY ===`;

  // ── CURRENT STATE ──
  const sliderEntries = Object.entries(input.moodSliders)
    .map(([k, v]) => `${k}: ${v}/10`)
    .join(", ");

  const sessionInfo = `Session #${rugzak.totalSessions + 1}. Duration: ${input.sessionDurationMinutes} minutes. Initial emotion: ${input.startEmotion}. Current detected emotion: ${input.detectedEmotion}.`;

  // ── CRISIS HANDLING ──
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

  // ── MODULE INSTRUCTIONS ──
  const moduleInstructions =
    input.activeModules.length > 0
      ? `Active therapeutic modules for this response: ${input.activeModules.join(", ")}. Weave these approaches naturally into your response.`
      : "No specific modules active. Respond naturally based on what the user shares.";

  // ── THERAPEUTIC STANCE ──
  const stance = input.therapeuticStance
    ? `Therapeutic stance instructions: ${input.therapeuticStance}`
    : "";

  // ── SESSION END ──
  let sessionEndInstructions = "";
  if (input.message === "__SESSION_END__") {
    sessionEndInstructions = `
The user is ending this session. Generate a warm farewell that:
1. Briefly acknowledges what was discussed (1-2 sentences)
2. References something specific from their personal memory if relevant
3. Affirms the user's courage/effort
4. Confirms the session is saved
5. Gently encourages them for next time
Keep it concise (3-5 sentences max). Do NOT ask new questions.`;
  }

  return `${identity}

The user's name is ${name}. Always address them by name occasionally.
${personalMemory}

=== MANDATORY BEHAVIORAL INSTRUCTIONS ===
${stance}

These behavioral instructions are ABSOLUTE. They override your default conversational style.
If the tone says GROUNDING + DIRECTIVE, you MUST be direct and structured — not exploratory.
If questions say MINIMAL, you MUST NOT ask open-ended questions.
If reflection says SHARP, you MUST name the distress explicitly based on the slider values.
The sliders tell you exactly how the user is doing — USE them in your response.
=== END MANDATORY INSTRUCTIONS ===

CURRENT STATE:
- Mood sliders: ${sliderEntries}
- Urgency level: ${input.urgency}
${sessionInfo}

${moduleInstructions}
${crisisInstructions}
${sessionEndInstructions}

RESPONSE RULES:
- You KNOW ${name}. Use your personal memory naturally — reference their story, patterns, and history when relevant.
- If ${name} asks "what do you know about me?" — you share what you know from your memory. You are NOT a blank slate.
- Respond in the same language the user writes in (Dutch or English)
- Keep responses concise: follow the PACING instruction above strictly
- Never diagnose, prescribe, or claim to be a professional
- Never break character
- Use "I" statements and reflective listening
- If the user's message is empty or a greeting, respond with a warm welcome that shows you remember them
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

  console.log("[AI Chat] System prompt length:", systemPrompt.length, "chars");
  console.log("[AI Chat] Total messages:", messages.length);
  console.log("[AI Chat] Life story sections:", input.rugzakFull.lifeStory.length);
  console.log("[AI Chat] Trigger patterns:", input.rugzakFull.triggerPatterns.length);

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
