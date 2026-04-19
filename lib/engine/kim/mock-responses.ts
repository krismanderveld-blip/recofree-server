/**
 * Kim Mock Responses — PURE DATA ONLY
 *
 * Extracted from lib/ai/mock-provider.ts (lines 49-79):
 * Kim-specific mock response pools for UI/flow testing.
 *
 * No decision logic. No thresholds. Data only.
 * Decision logic (isKimLowMood) lives in slider-interpretation.ts.
 */

/**
 * Kim mock response pool — categorized response strings for mock AI provider.
 * Exact same categories, exact same strings as original.
 */
export const KIM_MOCK_RESPONSES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  greeting: [
    "Hello, glad you're here. How are you doing \u2014 not the other person, but you?",
    "Welcome. I'd like to know how you're really doing.",
    "Good that you're taking some time for yourself. What's on your mind?",
  ],
  lowMood: [
    "It sounds like you're carrying a lot. That's understandable, but it's important to look after yourself too.",
    "I notice it's heavy. As someone close to the situation, you sometimes forget that you matter too. How are you taking care of yourself?",
    "You don't have to be strong for everyone. What do you need right now?",
  ],
  boundary: [
    "Setting boundaries might feel like rejection, but it's actually self-protection. What could be a first step?",
    "You can't save someone who doesn't want to save themselves. That's not giving up \u2014 it's accepting reality.",
    "It's okay to say: 'I can't carry this anymore.' That's not weakness, that's honesty.",
  ],
  enabling: [
    "I notice you're taking over a lot. Do you know the difference between helping and enabling?",
    "Sometimes the best help you can give is to step back. How does that idea feel to you?",
  ],
  crisis: [
    "I hear that things are really difficult. You matter in this story too. Let's look at what you need right now.",
    "It's okay to ask for help for yourself. You don't have to do this alone.",
  ],
  general: [
    "Thank you for sharing that. How does this affect your daily life?",
    "That sounds challenging. What are you doing right now to take care of yourself?",
    "I hear you. Let's look at what you can influence in this situation.",
    "That's an honest answer. Would you like to talk more about it?",
  ],
});
