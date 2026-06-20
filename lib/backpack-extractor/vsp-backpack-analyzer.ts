/**
 * VSP Backpack Analyzer
 * 
 * Triggered ONLY on backpack change (hash-based detection on themes section).
 * Sends recurringThemes to server LLM for deep VSP zone extraction.
 * Caches result in AsyncStorage — reused every session without re-calling.
 * 
 * Rules:
 * - Read-only: never writes to backpack
 * - store:false on all GPT calls
 * - Elias only (not Kim)
 * - No diagnosis in output — only observations
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { readEncrypted, writeEncrypted } from '@/lib/crypto/storage-encryption';

const VSP_PROFILE_KEY = "@vsp_backpack_profile";
const VSP_HASH_KEY = "@vsp_backpack_hash";

// ─── DJB2 Hash (same as backpack-extractor) ────────────────────
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ─── Types ─────────────────────────────────────────────────────
export interface VspBackpackProfileCached {
  green: string[];
  yellow: string[];
  orange: string[];
  red: string[];
  purple: string[];
  contextBlock: string;
  analyzedAt: string;
  sourceHash: string;
}

// ─── Main Entry ────────────────────────────────────────────────
/**
 * Check if recurringThemes changed and re-analyze if needed.
 * Returns cached contextBlock string for prompt injection, or null.
 */
export async function checkAndAnalyzeVspProfile(
  themesContent: string | null,
  callAnalysis: (input: { themesContent: string; sourceHash: string }) => Promise<VspBackpackProfileCached | null>,
): Promise<string | null> {
  if (!themesContent || themesContent.trim().length < 20) return null;

  try {
    const currentHash = djb2Hash(themesContent.trim());
    const previousHash = await AsyncStorage.getItem(VSP_HASH_KEY);

    if (currentHash === previousHash) {
      const cached = await loadCachedVspProfile();
      return cached?.contextBlock ?? null;
    }

    console.log('[VspBackpackAnalyzer] Themes changed, triggering LLM analysis...');
    const result = await callAnalysis({ themesContent: themesContent.trim(), sourceHash: currentHash });

    if (result) {
      await writeEncrypted(VSP_PROFILE_KEY, JSON.stringify(result));
      await AsyncStorage.setItem(VSP_HASH_KEY, currentHash);
      console.log('[VspBackpackAnalyzer] Analysis complete, cached');
      return result.contextBlock;
    }

    const fallback = await loadCachedVspProfile();
    return fallback?.contextBlock ?? null;
  } catch (error) {
    console.error('[VspBackpackAnalyzer] Error:', error);
    const fallback = await loadCachedVspProfile();
    return fallback?.contextBlock ?? null;
  }
}

// ─── Cache Access ──────────────────────────────────────────────
export async function loadCachedVspProfile(): Promise<VspBackpackProfileCached | null> {
  try {
    const raw = await readEncrypted(VSP_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Context Block Builder ─────────────────────────────────────
/**
 * Build the prompt block from LLM analysis result.
 */
export function buildVspProfileContextBlock(profile: { green: string[]; yellow: string[]; orange: string[]; red: string[]; purple: string[] }): string {
  const lines: string[] = ['USER VSP PROFILE (personal safety plan zones from backpack):'];
  if (profile.green.length > 0) lines.push(`GREEN signals: ${profile.green.join('; ')}`);
  if (profile.yellow.length > 0) lines.push(`YELLOW signals: ${profile.yellow.join('; ')}`);
  if (profile.orange.length > 0) lines.push(`ORANGE signals: ${profile.orange.join('; ')}`);
  if (profile.red.length > 0) lines.push(`RED signals: ${profile.red.join('; ')}`);
  if (profile.purple.length > 0) lines.push(`PURPLE signals: ${profile.purple.join('; ')}`);
  if (lines.length === 1) return '';
  lines.push('');
  lines.push('Use this profile to understand what the user experiences per zone. Reference it when discussing zone-related topics.');
  return lines.join('\n');
}
