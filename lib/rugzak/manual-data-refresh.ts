/**
 * Manual Data Refresh — Client-side orchestration service
 *
 * Triggered by user button in Profile/Backpack screens.
 * Refreshes local memory layers (Backpack analysis, VSP/ERP, DIST01, context.dat)
 * so the next chat session uses the most recent clinical context.
 *
 * IMPORTANT:
 * - Never sends raw data directly to GPT
 * - Only triggers existing safe analysis flows
 * - CMD-ready marker for next chat
 * - No server route changes
 * - No provider changes
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { callExtractionEndpoint } from '@/lib/backpack-extractor/client';
import { forceExtract } from '@/lib/backpack-extractor/extractor';
import { analyzeAllSections } from '@/lib/backpack-extractor/section-analysis-service';
import { distillContextDat, serializeContextDatForGPT } from '@/lib/pipeline/context-dat-distiller';
import { createDistillationStore } from '@/lib/engine/shared/dist01-store';
import { SessionMemoryCache } from '@/lib/crypto/session-memory-cache';
import { LocalDeviceTimeService } from '@/lib/core/time';
import type { Backpack } from '@/lib/ai/types';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ManualDataRefreshInput {
  persona: 'elias' | 'kim';
  refreshBackpack: boolean;
  refreshVsp: boolean;
  refreshErp: boolean;
  refreshDist01: boolean;
  refreshContextDat: boolean;
  forceNextChatCMD: boolean;
  reason: 'manual_user_refresh';
  nowLocal: string;
}

export interface ManualDataRefreshOutput {
  ok: boolean;
  refreshed: {
    backpackAnalysis: boolean;
    vspAnalysis: boolean;
    erpAnalysis: boolean;
    dist01: boolean;
    contextDat: boolean;
    cmdReadyForNextChat: boolean;
  };
  skipped: Array<{ key: string; reason: string }>;
  errors: Array<{ key: string; message: string }>;
  updatedAtLocal: string;
}

// ─── Storage Keys ──────────────────────────────────────────────────────────
const MANUAL_REFRESH_KEY = '@recofree_manual_data_refresh';
const USERDAT_KEY = '@recofree_userdat';
const BACKPACK_KEY = '@recofree_backpack';

export interface ManualRefreshState {
  lastUpdatedAtLocal: string;
  persona: 'elias' | 'kim';
  status: 'success' | 'partial' | 'error';
  forceNextChatCMD: boolean;
}

// ─── Load/Save Refresh State ───────────────────────────────────────────────

export async function loadManualRefreshState(): Promise<ManualRefreshState | null> {
  try {
    const json = await AsyncStorage.getItem(MANUAL_REFRESH_KEY);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

export async function saveManualRefreshState(state: ManualRefreshState): Promise<void> {
  await AsyncStorage.setItem(MANUAL_REFRESH_KEY, JSON.stringify(state));
}

export async function clearForceNextChatCMD(): Promise<void> {
  const current = await loadManualRefreshState();
  if (current && current.forceNextChatCMD) {
    await saveManualRefreshState({ ...current, forceNextChatCMD: false });
  }
}

// ─── Main Refresh Function ─────────────────────────────────────────────────

export async function runManualDataRefresh(input: ManualDataRefreshInput): Promise<ManualDataRefreshOutput> {
  const output: ManualDataRefreshOutput = {
    ok: false,
    refreshed: {
      backpackAnalysis: false,
      vspAnalysis: false,
      erpAnalysis: false,
      dist01: false,
      contextDat: false,
      cmdReadyForNextChat: false,
    },
    skipped: [],
    errors: [],
    updatedAtLocal: input.nowLocal,
  };

  try {
    // Load current backpack
    let backpack: Backpack | null = null;
    try {
      const bpJson = await SessionMemoryCache.get(BACKPACK_KEY);
      if (bpJson) backpack = JSON.parse(bpJson);
    } catch {
      // Try direct AsyncStorage fallback
      try {
        const raw = await AsyncStorage.getItem(BACKPACK_KEY);
        if (raw) backpack = JSON.parse(raw);
      } catch { /* ignore */ }
    }

    // Load current userDat
    let userDat: any = null;
    try {
      const udJson = await SessionMemoryCache.get(USERDAT_KEY);
      if (udJson) userDat = JSON.parse(udJson);
    } catch {
      try {
        const raw = await AsyncStorage.getItem(USERDAT_KEY);
        if (raw) userDat = JSON.parse(raw);
      } catch { /* ignore */ }
    }

    // 1. Backpack analysis refresh
    if (input.refreshBackpack) {
      if (backpack && backpack.sections && backpack.sections.length > 0) {
        try {
          // BLOCKING: Send raw backpack to GPT for full entity extraction
          // This feeds user.dat with persons, events, patterns, contexts
          console.log('[ManualRefresh] Sending backpack to GPT for full analysis...');
          const entities = await forceExtract(backpack, callExtractionEndpoint);
          if (entities) {
            // Update user.dat with extracted entities
            if (userDat) {
              userDat.extractedEntities = entities;
              // Also populate relationalAnchors from persons for personalAnchors block
              if (entities.persons && entities.persons.length > 0) {
                userDat.relationalAnchors = entities.persons.map((p: any) => ({
                  name: p.name,
                  role: p.relationshipNL || p.relationship || 'onbekend',
                  roleEN: p.relationship || 'unknown',
                  emotionalWeight: p.emotionalValence === 'positive' ? 0.8 : p.emotionalValence === 'negative' ? 0.4 : 0.6,
                }));
              }
              await SessionMemoryCache.set(USERDAT_KEY, JSON.stringify(userDat));
              await AsyncStorage.setItem(USERDAT_KEY, JSON.stringify(userDat));
              console.log('[ManualRefresh] Extraction complete:', entities.persons.length, 'persons,', entities.events.length, 'events,', entities.patterns.length, 'patterns');
            }
          }
          // Also clear hash so pipeline knows to re-check
          await AsyncStorage.removeItem('@recofree_backpack_hash');
          output.refreshed.backpackAnalysis = true;
          // Deep section analysis — extracts relation graph, schemas, modes, life status
          try {
            const sectionsForAnalysis = backpack.sections
              .filter((s: any) => s.content && s.content.trim().length > 10)
              .map((s: any) => ({ id: s.id, label: s.label || s.id, content: s.content }));
            if (sectionsForAnalysis.length > 0) {
              const analysisReport = await analyzeAllSections(sectionsForAnalysis, input.persona);
              console.log(`[ManualRefresh] Deep analysis: ${analysisReport.sectionsAnalyzed} sections, ${analysisReport.anchorsBuilt} anchors, ${analysisReport.relationEdgesBuilt} edges, ${analysisReport.schemasDetected} schemas`);
              // FIX 2: Store report in AsyncStorage so clinical dropdown can display it
              try {
                await AsyncStorage.setItem('@recofree_last_deep_analysis_report', JSON.stringify({
                  timestamp: new Date().toISOString(),
                  sectionsAnalyzed: analysisReport.sectionsAnalyzed,
                  sectionsSkipped: analysisReport.sectionsSkipped,
                  anchorsBuilt: analysisReport.anchorsBuilt,
                  relationEdgesBuilt: analysisReport.relationEdgesBuilt,
                  schemasDetected: analysisReport.schemasDetected,
                  modesDetected: analysisReport.modesDetected ?? 0,
                  triggersDetected: analysisReport.triggersDetected ?? 0,
                  lifeStatusDetected: analysisReport.lifeStatusDetected ?? 0,
                  failures: analysisReport.failures ?? 0,
                  ok: true,
                }));
              } catch { /* non-blocking */ }
            }
          } catch (analysisErr) {
            console.warn('[ManualRefresh] Deep section analysis failed (non-blocking):', analysisErr);
            // FIX 2: Store failure report
            try {
              await AsyncStorage.setItem('@recofree_last_deep_analysis_report', JSON.stringify({
                timestamp: new Date().toISOString(),
                ok: false,
                error: (analysisErr as Error).message?.slice(0, 200) || 'unknown',
              }));
            } catch { /* non-blocking */ }
          }
        } catch (e) {
          output.errors.push({ key: 'backpackAnalysis', message: (e as Error).message });
        }
      } else {
        output.skipped.push({ key: 'backpackAnalysis', reason: 'backpack_empty_or_missing' });
      }
    }

    // 2. VSP analysis refresh (Elias only)
    if (input.refreshVsp) {
      if (input.persona === 'elias') {
        if (userDat?.vspProfile || userDat?.vsp) {
          // Mark VSP as needing refresh — pipeline will rebuild on next session
          output.refreshed.vspAnalysis = true;
        } else {
          output.skipped.push({ key: 'vspAnalysis', reason: 'vsp_not_available' });
        }
      } else {
        output.skipped.push({ key: 'vspAnalysis', reason: 'not_elias_persona' });
      }
    }

    // 3. ERP analysis refresh (Kim only)
    if (input.refreshErp) {
      if (input.persona === 'kim') {
        if (userDat?.eigenRegiePlan || userDat?.erp) {
          // Mark ERP as needing refresh — pipeline will rebuild on next session
          output.refreshed.erpAnalysis = true;
        } else {
          output.skipped.push({ key: 'erpAnalysis', reason: 'erp_not_available' });
        }
      } else {
        output.skipped.push({ key: 'erpAnalysis', reason: 'not_kim_persona' });
      }
    }

    // 4. DIST01 refresh
    if (input.refreshDist01) {
      try {
        const distStore = createDistillationStore();
        const distData = await distStore.load(input.persona);
        if (distData && (distData.entities.length > 0 || distData.signals.length > 0)) {
          output.refreshed.dist01 = true;
        } else {
          output.skipped.push({ key: 'dist01', reason: 'dist01_empty' });
        }
      } catch (e) {
        output.errors.push({ key: 'dist01', message: (e as Error).message });
      }
    }

    // 5. Context.dat refresh (rebuild from current layers)
    if (input.refreshContextDat) {
      // Re-read userDat from storage to include deep analysis fields
      // written by analyzeAllSections/mergeAnalysisToUserDat above
      let freshUserDat = userDat;
      try {
        const udJson = await SessionMemoryCache.get(USERDAT_KEY);
        if (udJson) freshUserDat = JSON.parse(udJson);
      } catch {
        try {
          const raw = await AsyncStorage.getItem(USERDAT_KEY);
          if (raw) freshUserDat = JSON.parse(raw);
        } catch { /* keep stale as fallback */ }
      }
      if (backpack && freshUserDat) {
        try {
          const contextDat = distillContextDat({
            backpack,
            userDat: freshUserDat,
            logsDat: null,
            stateDat: null,
            projectionsDat: null,
            userDatMemory: null,
            diaryEntries: [],
          });
          // Serialize and store for next session
          const serialized = serializeContextDatForGPT(contextDat);
          if (serialized && serialized.length > 0) {
            // Store context.dat serialized for next chat
            await AsyncStorage.setItem('@recofree_context_dat_cache', serialized);
            output.refreshed.contextDat = true;
          } else {
            output.skipped.push({ key: 'contextDat', reason: 'serialization_empty' });
          }
        } catch (e) {
          output.errors.push({ key: 'contextDat', message: (e as Error).message });
        }
      } else {
        output.skipped.push({ key: 'contextDat', reason: 'backpack_or_userdat_missing' });
      }
    }

    // 6. CMD-ready marker
    if (input.forceNextChatCMD) {
      output.refreshed.cmdReadyForNextChat = true;
    }

    // Determine overall status
    const hasErrors = output.errors.length > 0;
    const hasRefreshed = Object.values(output.refreshed).some(v => v === true);
    const status: 'success' | 'partial' | 'error' = hasErrors && !hasRefreshed
      ? 'error'
      : hasErrors && hasRefreshed
        ? 'partial'
        : 'success';

    output.ok = status !== 'error';

    // Save refresh state
    await saveManualRefreshState({
      lastUpdatedAtLocal: input.nowLocal,
      persona: input.persona,
      status,
      forceNextChatCMD: input.forceNextChatCMD,
    });

    return output;
  } catch (e) {
    output.errors.push({ key: 'global', message: (e as Error).message });
    return output;
  }
}
