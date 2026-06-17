/**
 * Detect User Language from Content
 *
 * Samples text from user-generated content (backpack sections, diary entries,
 * gratitude entries, VSP entries) and determines the dominant language.
 *
 * Used by the greeting engine to generate greetings in the user's language.
 * Fallback: 'en' (English) when no content is available.
 */

import type { Backpack, DiaryEntry } from '@/lib/ai/types';

export type DetectedLanguage = 'nl' | 'en' | 'de' | 'fr' | 'es' | 'pt' | 'it' | 'zh' | 'ja' | 'ko' | 'ar' | 'ru' | 'tr' | 'pl';

export interface LanguageDetectionResult {
  /** Detected language code (ISO 639-1) */
  language: DetectedLanguage;
  /** Whether content was found to analyze */
  hasContent: boolean;
  /** Confidence: 'high' if multiple sources agree, 'low' if only one short sample */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Detect the user's preferred language from their content.
 * Samples text from backpack, diary, gratitude, and VSP.
 * Returns 'en' with hasContent=false if no user content exists.
 */
export function detectUserLanguageFromContent(
  backpack: Backpack,
  diaryEntries: DiaryEntry[],
): LanguageDetectionResult {
  const samples: string[] = [];

  // 1. Backpack sections (life story)
  if (backpack.sections) {
    for (const section of backpack.sections) {
      if (section.content && section.content.trim().length > 10) {
        samples.push(section.content.trim().slice(0, 200));
      }
    }
  }

  // 2. Kim backpack sections
  if (backpack.kimBackpack) {
    const kimFields = Object.values(backpack.kimBackpack);
    for (const field of kimFields) {
      if (field && field.trim().length > 10) {
        samples.push(field.trim().slice(0, 200));
      }
    }
  }

  // 3. VSP entries (signals, whatHelps, anchorSentence)
  if (backpack.vspSection?.zones) {
    const zones = Object.values(backpack.vspSection.zones);
    for (const zone of zones) {
      if (zone?.signals && zone.signals.trim().length > 5) {
        samples.push(zone.signals.trim().slice(0, 100));
      }
      if (zone?.whatHelps && zone.whatHelps.trim().length > 5) {
        samples.push(zone.whatHelps.trim().slice(0, 100));
      }
      if (zone?.anchorSentence && zone.anchorSentence.trim().length > 5) {
        samples.push(zone.anchorSentence.trim().slice(0, 100));
      }
    }
  }

  // 4. VSP triggers
  if (backpack.vspSection?.triggers) {
    for (const trigger of backpack.vspSection.triggers) {
      if (trigger.trigger && trigger.trigger.trim().length > 5) {
        samples.push(trigger.trigger.trim().slice(0, 100));
      }
      if (trigger.counterThought && trigger.counterThought.trim().length > 5) {
        samples.push(trigger.counterThought.trim().slice(0, 100));
      }
    }
  }

  // 5. Diary entries (most recent 5)
  const recentDiary = [...diaryEntries]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);
  for (const entry of recentDiary) {
    if (entry.content && entry.content.trim().length > 10) {
      samples.push(entry.content.trim().slice(0, 200));
    }
  }

  // 6. Gratitude entries
  for (const entry of recentDiary) {
    if (entry.gratitude) {
      const gratTexts = [entry.gratitude.entry1, entry.gratitude.entry2, entry.gratitude.entry3].filter(Boolean);
      for (const g of gratTexts) {
        if (g && g.trim().length > 5) {
          samples.push(g.trim().slice(0, 100));
        }
      }
    }
  }

  // No content found — return English as default
  if (samples.length === 0) {
    return { language: 'en', hasContent: false, confidence: 'low' };
  }

  // Detect language for each sample and vote
  const votes: Record<string, number> = {};
  for (const sample of samples) {
    const lang = detectLanguageHeuristic(sample);
    votes[lang] = (votes[lang] ?? 0) + 1;
  }

  // Find the dominant language
  const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const topLang = sorted[0][0] as DetectedLanguage;
  const topCount = sorted[0][1];
  const totalVotes = samples.length;

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low';
  if (totalVotes >= 3 && topCount / totalVotes >= 0.6) {
    confidence = 'high';
  } else if (totalVotes >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return { language: topLang, hasContent: true, confidence };
}

/**
 * Heuristic language detection for a single text sample.
 * Uses common word patterns to identify the language.
 */
function detectLanguageHeuristic(text: string): DetectedLanguage {
  // Check for non-Latin scripts first
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  if (/[\u0600-\u06ff]/.test(text)) return 'ar';
  if (/[\u0400-\u04ff]/.test(text)) return 'ru';

  const lowerText = text.toLowerCase();

  // Dutch
  const dutchPatterns = /\b(ik|het|een|dat|niet|maar|ook|wel|nog|als|naar|voor|bij|uit|aan|heb|ben|kan|wil|zou|mijn|dit|die|deze|geen|zijn|heeft|wordt|veel|meer|goed|slecht|moeilijk|gevoel|vandaag|gisteren)\b/;
  if (dutchPatterns.test(lowerText)) return 'nl';

  // German
  const germanPatterns = /\b(ich|das|ein|nicht|aber|auch|noch|als|nach|für|bei|aus|hab|bin|kann|will|mein|dies|kein|sind|wird|viel|mehr|gut|schlecht|schwer|gefühl|heute|gestern)\b/;
  if (germanPatterns.test(lowerText)) return 'de';

  // French
  const frenchPatterns = /\b(je|le|la|les|un|une|pas|mais|aussi|encore|pour|avec|dans|suis|peux|veux|mon|cette|sont|fait|bien|mal|difficile|sentiment|aujourd)\b/;
  if (frenchPatterns.test(lowerText)) return 'fr';

  // Spanish
  const spanishPatterns = /\b(yo|el|la|los|un|una|no|pero|también|para|con|en|soy|puedo|quiero|mi|este|esta|son|hace|bien|mal|difícil|sentimiento|hoy|ayer)\b/;
  if (spanishPatterns.test(lowerText)) return 'es';

  // Portuguese
  const portuguesePatterns = /\b(eu|o|a|os|um|uma|não|mas|também|para|com|em|sou|posso|quero|meu|este|esta|são|faz|bem|mal|difícil|sentimento|hoje|ontem)\b/;
  if (portuguesePatterns.test(lowerText)) return 'pt';

  // Italian
  const italianPatterns = /\b(io|il|la|i|un|una|non|ma|anche|per|con|in|sono|posso|voglio|mio|questo|questa|fanno|bene|male|difficile|sentimento|oggi|ieri)\b/;
  if (italianPatterns.test(lowerText)) return 'it';

  // Turkish
  const turkishPatterns = /\b(ben|bir|bu|değil|ama|da|için|ile|var|yok|oldu|çok|iyi|kötü|zor|bugün|dün|benim|şey|gibi)\b/;
  if (turkishPatterns.test(lowerText)) return 'tr';

  // Polish
  const polishPatterns = /\b(ja|to|nie|ale|też|dla|jest|może|chcę|mój|ten|ta|są|dobrze|źle|trudno|dzisiaj|wczoraj)\b/;
  if (polishPatterns.test(lowerText)) return 'pl';

  // Default to English
  return 'en';
}

/**
 * Get the language name in that language (for GPT instruction).
 * E.g., 'nl' → 'Nederlands', 'en' → 'English', 'de' → 'Deutsch'
 */
export function getLanguageNameForGpt(lang: DetectedLanguage): string {
  const map: Record<DetectedLanguage, string> = {
    nl: 'Nederlands',
    en: 'English',
    de: 'Deutsch',
    fr: 'Français',
    es: 'Español',
    pt: 'Português',
    it: 'Italiano',
    zh: '中文',
    ja: '日本語',
    ko: '한국어',
    ar: 'العربية',
    ru: 'Русский',
    tr: 'Türkçe',
    pl: 'Polski',
  };
  return map[lang] ?? 'English';
}

/**
 * Get the greeting language instruction for GPT prompts.
 * Returns a clear instruction about which language to write in.
 */
export function getGreetingLanguageInstruction(result: LanguageDetectionResult): string {
  if (!result.hasContent) {
    return 'Write in English. Add at the end: "Feel free to type in your native language — I\'ll understand."';
  }
  const langName = getLanguageNameForGpt(result.language);
  return `Write in ${langName}. Use grammatically correct, fluent ${langName}.`;
}
