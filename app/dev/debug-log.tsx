/**
 * Debug Log Screen — On-device engine monitoring
 *
 * __DEV__ only. Activated via 5 taps on version number in Profile.
 * Two tabs: Live State (current engine snapshot) and Session Log (chronological events).
 * Utilities: Clear projections, clear UserDat.
 */
import { useState, useCallback, useMemo } from 'react';
import {
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useUser } from '@/lib/user-context';
import { getDebugEvents, formatDebugLog, clearDebugEvents } from '@/lib/debug/session-logger';
import { getTraceBlocks, getTraceBlockCount, getFullTraceExport, clearTraceBlocks } from '@/lib/debug/engine-trace';
import { getProjectionSummary, clearEliasProjection } from '@/lib/engine/elias/projection';
import { getKimProjectionSummary, clearKimProjection } from '@/lib/engine/kim/projection';
import { getInterventionState } from '@/lib/engine/elias/intervention-continuity';
import { getSessionCostSummary, getRemainingBudget, isOverBudget } from '@/lib/rugzak/cost-control';

type TabId = 'live' | 'log' | 'modules' | 'copy';

const USERDAT_KEY = '@recofree_userdat';
const BACKPACK_KEY = '@recofree_backpack';

export default function DebugLogScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, getUserDat, getVsp, getEigenRegieHistory, getGuidanceDepth } = useUser();
  const [activeTab, setActiveTab] = useState<TabId>('live');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // ── Live State Data ──
  const liveState = useMemo(() => {
    const userDat = getUserDat();
    const projSummary = state.userType === 'elias'
      ? getProjectionSummary()
      : getKimProjectionSummary();
    const interventionState = getInterventionState();
    const costSummary = getSessionCostSummary();
    const vsp = getVsp();
    const eigenRegie = getEigenRegieHistory();
    const guidanceDepth = getGuidanceDepth();
    const events = getDebugEvents();
    const lastMsgEvent = [...events].reverse().find((e) => e.type === 'message_processed');

    const remaining = getRemainingBudget();
    const overBudget = isOverBudget();
    const budgetStatus = overBudget
      ? 'CRITICAL'
      : costSummary.totalTokens > 20000
        ? 'WARNING'
        : 'OK';

    // Module dashboard data
    const activeModules = (lastMsgEvent?.data as any)?.activeModules ?? [];
    const k06Status = (lastMsgEvent?.data as any)?.k06Status ?? (userDat as any)?.k06StabilizationStatus ?? 'NOT_RUN';
    const crisisProtocolActive = (lastMsgEvent?.data as any)?.crisisProtocolActive ?? false;

    return {
      userType: state.userType ?? 'unknown',
      guidanceDepth,
      vsp,
      eigenRegieLatest: eigenRegie.length > 0 ? eigenRegie[eigenRegie.length - 1] : null,
      totalSessions: userDat?.totalSessions ?? 0,
      lastSessionDate: userDat?.lastSessionDate ?? 'never',
      projection: projSummary,
      intervention: interventionState,
      cost: costSummary,
      lastMessage: lastMsgEvent?.data ?? null,
      remaining,
      budgetStatus,
      // Module dashboard
      activeModules,
      k06Status,
      crisisProtocolActive,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, state.userType]);

  // ── Session Log Data ──
  const logText = useMemo(() => {
    return formatDebugLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const events = useMemo(() => {
    return getDebugEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // ── Engine Trace Data ──
  const traceBlocks = useMemo(() => {
    return getTraceBlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const traceCount = useMemo(() => {
    return getTraceBlockCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // ── Actions ──
  const handleCopyLog = useCallback(async () => {
    const text = getFullTraceExport() || formatDebugLog();
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied', 'Debug log copied to clipboard.');
    } catch (e) {
      console.error('[DebugLog] Copy failed:', e);
    }
  }, []);

  const handleClearEliasProjection = useCallback(async () => {
    await clearEliasProjection();
    refresh();
    Alert.alert('Done', 'Elias projection cleared.');
  }, [refresh]);

  const handleClearKimProjection = useCallback(async () => {
    await clearKimProjection();
    refresh();
    Alert.alert('Done', 'Kim projection cleared.');
  }, [refresh]);

  const handleClearUserDat = useCallback(() => {
    const doReset = async () => {
      try {
        await AsyncStorage.removeItem(USERDAT_KEY);
        await AsyncStorage.removeItem(BACKPACK_KEY);
        refresh();
        Alert.alert('Done', 'UserDat + Backpack cleared. Restart app to re-intake.');
      } catch (e) {
        console.error('[DebugLog] Clear UserDat failed:', e);
      }
    };
    if (Platform.OS === 'web') {
      if (confirm('Clear ALL UserDat? This is irreversible.')) doReset();
    } else {
      Alert.alert(
        'Clear UserDat',
        'This permanently deletes UserDat and Backpack. The app will need re-intake. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: doReset },
        ],
      );
    }
  }, [refresh]);

  const handleClearLog = useCallback(() => {
    clearDebugEvents();
    refresh();
  }, [refresh]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // ── Render Helpers ──
  const Row = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.foreground }]} numberOfLines={2}>
        {value ?? '—'}
      </Text>
    </View>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={[styles.section, { borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>{title}</Text>
      {children}
    </View>
  );

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="px-4 pt-2">
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.backBtn, { color: colors.primary }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Debug Log</Text>
        <Pressable onPress={refresh} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.refreshBtn, { color: colors.primary }]}>Refresh</Text>
        </Pressable>
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { borderColor: colors.border }]}>
        {(['live', 'modules', 'log', 'copy'] as TabId[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => { setActiveTab(tab); refresh(); }}
            style={({ pressed }) => [
              styles.tab,
              activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? colors.primary : colors.muted },
              ]}
            >
              {tab === 'live' ? 'Live' : tab === 'log' ? 'Log' : tab === 'modules' ? 'Modules' : 'Copy'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'copy' ? (
          <CopyAllTab liveState={liveState} events={events} colors={colors} traceBlocks={traceBlocks} />
        ) : activeTab === 'log' ? (
          <>
            {/* Session Log Tab — Engine Trace Blocks */}
            <View style={[styles.logHeader, { borderColor: colors.border }]}>
              <Text style={[styles.logCount, { color: colors.muted }]}>
                {traceCount} trace block{traceCount !== 1 ? 's' : ''}
              </Text>
              <Pressable onPress={handleCopyLog} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <Text style={[styles.copyBtn, { color: colors.primary }]}>Share Log</Text>
              </Pressable>
            </View>
            {traceCount === 0 ? (
              <Text style={[styles.emptyLog, { color: colors.muted }]}>
                No trace blocks yet. Send a message to start tracing.
              </Text>
            ) : (
              <View style={styles.logList}>
                {traceBlocks.map((block, i) => (
                  <View key={`trace-${i}`} style={[styles.logEntry, { borderColor: colors.border }]}>
                    <Text
                      style={[styles.logData, { color: colors.foreground }]}
                      selectable
                    >
                      {block}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : activeTab === 'modules' ? (
          <>
            {/* Module Activation Dashboard */}
            <Section title="K06 Stabilization">
              <Row
                label="Status"
                value={liveState.k06Status === 'COMPLETE' ? '✅ Complete' : liveState.k06Status === 'IN_PROGRESS' ? '⏳ In Progress' : '❌ Not Run'}
              />
              <Row
                label="Crisis Protocol"
                value={liveState.crisisProtocolActive ? '🚨 ACTIVE' : '✅ Clear'}
              />
            </Section>

            <Section title="Active Modules (P2/P3/P4)">
              {liveState.activeModules.length === 0 ? (
                <Row label="Status" value="No active modules" />
              ) : (
                liveState.activeModules.map((mod: { id: string; confidence: number; mode: string }, i: number) => (
                  <View key={`mod-${i}`} style={[styles.row, { paddingVertical: 6 }]}>
                    <Text style={[styles.label, { color: colors.foreground, fontWeight: '700', fontSize: 13 }]}>
                      {mod.id}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 11, color: colors.muted }}>{mod.mode}</Text>
                      <View style={[styles.confidenceBar, { backgroundColor: colors.border }]}>
                        <View style={[styles.confidenceFill, { width: `${Math.round(mod.confidence * 100)}%`, backgroundColor: mod.confidence >= 0.7 ? colors.success : mod.confidence >= 0.4 ? colors.warning : colors.error }]} />
                      </View>
                      <Text style={{ fontSize: 11, color: colors.foreground, fontWeight: '600', minWidth: 36, textAlign: 'right' }}>
                        {Math.round(mod.confidence * 100)}%
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </Section>

            <Section title="Module Overview">
              <Row label="BEDR01" value="Deception Detection" />
              <Row label="VETR01" value="Trust Restoration" />
              <Row label="GASL01" value="Gaslighting Detection" />
              <Row label="CDP01" value="Codependency Pattern" />
              <Row label="RNW01" value="Grief Loved One: Who They Were" />
              <Row label="PAR01" value="Parentification" />
              <Row label="FIN01" value="Financial Dependency" />
            </Section>

            <Section title="Pipeline Order">
              <Row label="1. K06" value="Stabilization (always first)" />
              <Row label="2. P2" value="BEDR01 > VETR01 > GASL01" />
              <Row label="3. P3" value="CDP01 > RNW01" />
              <Row label="4. P4" value="PAR01 > FIN01" />
              <Row label="Override" value="Crisis protocol always overrides" />
            </Section>
          </>
        ) : activeTab === 'live' ? (
          <>
            <Section title="Zone & Dominant">
              <Row
                label="Zone"
                value={
                  liveState.lastMessage
                    ? `${(liveState.lastMessage as any).zone ?? '?'}`
                    : '(no messages yet)'
                }
              />
              <Row
                label="Dominant Module"
                value={(liveState.lastMessage as any)?.dominantModule ?? '—'}
              />
              <Row
                label="Risk Score"
                value={(liveState.lastMessage as any)?.riskScore ?? '—'}
              />
            </Section>

            <Section title="Guidance Depth">
              <Row label="User Setting" value={liveState.guidanceDepth} />
              <Row
                label="Effective (last msg)"
                value={liveState.intervention?.linkedZone
                  ? `zone=${liveState.intervention.linkedZone} sev=${liveState.intervention.linkedSeverity}`
                  : '—'}
              />
            </Section>

            <Section title="Model & Tokens">
              <Row label="Model (last)" value={(liveState.lastMessage as any)?.model ?? '—'} />
              <Row label="Est. Tokens (last)" value={(liveState.lastMessage as any)?.estimatedTokens ?? '—'} />
              <Row label="Total Calls" value={liveState.cost.totalCalls} />
              <Row label="Total Tokens" value={liveState.cost.totalTokens} />
              <Row label="Peak Call" value={liveState.cost.peakCallTokens} />
            </Section>

            <Section title="Token Budget">
              <Row
                label="Last Call"
                value={
                  liveState.cost.totalCalls > 0
                    ? `${liveState.cost.totalPromptTokens > 0 ? Math.round(liveState.cost.totalPromptTokens / liveState.cost.totalCalls) : 0} in + ${liveState.cost.totalCompletionTokens > 0 ? Math.round(liveState.cost.totalCompletionTokens / liveState.cost.totalCalls) : 0} out = ${liveState.cost.averageTokensPerCall} avg`
                    : '—'
                }
              />
              <Row label="Session Total" value={`${liveState.cost.totalTokens} / 25000`} />
              <Row label="Remaining" value={liveState.remaining} />
              <Row label="Warning Threshold" value="3500 / Critical: 5000" />
              <Row
                label="Status"
                value={liveState.budgetStatus}
              />
              {liveState.cost.warnings.length > 0 && (
                <Row label="Warnings" value={liveState.cost.warnings.join('; ')} />
              )}
            </Section>

            <Section title="Buffer Snapshot">
              <Row label="Zone" value={(liveState.lastMessage as any)?.zone ?? '—'} />
              <Row
                label="Active Blocks"
                value={
                  Array.isArray((liveState.lastMessage as any)?.activeBlocks)
                    ? (liveState.lastMessage as any).activeBlocks.join(', ')
                    : '—'
                }
              />
            </Section>

            <Section title="Projection">
              <Row label="Active Entries" value={liveState.projection.activeEntries} />
              <Row label="Total Entries" value={liveState.projection.totalEntries} />
              <Row label="Dominant Category" value={liveState.projection.dominantCategory ?? '—'} />
              <Row
                label="Strongest Fear"
                value={liveState.projection.strongestFear?.content ?? '—'}
              />
              <Row
                label="Strongest Hope"
                value={liveState.projection.strongestHope?.content ?? '—'}
              />
              <Row label="Active Goals" value={liveState.projection.activeGoals.length} />
            </Section>

            <Section title="UserDat">
              <Row label="Total Sessions" value={liveState.totalSessions} />
              <Row label="Last Session" value={liveState.lastSessionDate} />
              <Row label="User Type" value={liveState.userType} />
            </Section>

            <Section title="VSP / Self-Direction">
              <Row label="VSP (Elias)" value={liveState.vsp ?? '—'} />
              <Row
                label="Self-Direction (Kim)"
                value={
                  liveState.eigenRegieLatest
                    ? `${liveState.eigenRegieLatest.userInput}/100 (${liveState.eigenRegieLatest.timestamp.split('T')[0]})`
                    : '—'
                }
              />
            </Section>

            <Section title="Intervention Continuity">
              <Row label="Type" value={liveState.intervention?.lastInterventionType ?? '—'} />
              <Row label="Goal" value={liveState.intervention?.interventionGoal ?? '—'} />
              <Row label="Turns Active" value={liveState.intervention?.turnsActive ?? '—'} />
              <Row label="Effectiveness" value={liveState.intervention?.effectivenessScore ?? '—'} />
              <Row label="Last Response" value={liveState.intervention?.lastUserResponse ?? '—'} />
            </Section>
          </>
        ) : null}

        {/* Utilities */}
        <View style={[styles.utilities, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: 12 }]}>
            Utilities
          </Text>
          <UtilButton
            label="Clear Elias Projection"
            color={colors.warning}
            onPress={handleClearEliasProjection}
          />
          <UtilButton
            label="Clear Kim Projection"
            color={colors.warning}
            onPress={handleClearKimProjection}
          />
          <UtilButton
            label="Clear UserDat (irreversible)"
            color={colors.error}
            onPress={handleClearUserDat}
          />
          <UtilButton
            label="Clear Session Log"
            color={colors.muted}
            onPress={handleClearLog}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

// ── Copy All Tab ──
function CopyAllTab({ liveState, events, colors, traceBlocks }: { liveState: any; events: any[]; colors: any; traceBlocks: readonly string[] }) {
  const [copied, setCopied] = useState(false);

  const buildFullText = useCallback(() => {
    // Primary: engine trace blocks (the full per-message decision log)
    const traceExport = getFullTraceExport();
    if (traceExport) return traceExport;
    // Fallback: old-style dump if no trace blocks yet
    const lines: string[] = [];
    lines.push('=== RECOFREE DEBUG DUMP (no trace blocks yet) ===');
    lines.push(`Timestamp: ${new Date().toISOString()}`);
    lines.push(`User Type: ${liveState.userType}`);
    lines.push(`Total Sessions: ${liveState.totalSessions}`);
    lines.push(`Budget Status: ${liveState.budgetStatus}`);
    lines.push('');
    if (events.length > 0) {
      lines.push('── SESSION EVENTS ──');
      events.forEach((event: any) => {
        const time = event.timestamp.split('T')[1]?.split('.')[0] ?? '';
        lines.push(`[${time}] ${event.type}: ${formatEventDataCompact(event)}`);
      });
    }
    lines.push('=== END ===');
    return lines.join('\n');
  }, [liveState, events]);

  const handleCopyAll = useCallback(async () => {
    const text = buildFullText();
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('[DebugLog] Copy all failed:', e);
    }
  }, [buildFullText]);

  return (
    <View style={{ gap: 16, paddingVertical: 16 }}>
      <Text style={[styles.sectionTitle, { color: colors.primary, textAlign: 'center' }]}>
        Copy All Debug Info
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 16 }}>
        Copies all live state + session log as plain text. You can paste it in any external chat.
      </Text>
      <Pressable
        onPress={handleCopyAll}
        style={({ pressed }) => [
          styles.utilBtn,
          {
            borderColor: copied ? colors.success + '60' : colors.primary + '40',
            backgroundColor: copied ? colors.success + '15' : colors.primary + '10',
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={[styles.utilBtnText, { color: copied ? colors.success : colors.primary }]}>
          {copied ? '✓ Copied!' : 'Copy Full Debug Dump'}
        </Text>
      </Pressable>
      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text style={{ color: colors.muted, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }} numberOfLines={30}>
          {buildFullText()}
        </Text>
      </View>
    </View>
  );
}

// ── Utility Button ──
function UtilButton({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.utilBtn,
        { borderColor: color + '40', backgroundColor: color + '10', opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.utilBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ── Format event data for log list ──
function formatEventDataCompact(event: { type: string; data: Record<string, unknown> }): string {
  const d = event.data;
  switch (event.type) {
    case 'session_start':
      return `user=${d.userType ?? '?'}`;
    case 'session_end':
      return `msgs=${d.messageCount ?? 0} dur=${d.durationMs ?? '?'}ms`;
    case 'message_processed': {
      const blocks = Array.isArray(d.activeBlocks) ? (d.activeBlocks as string[]).join(',') : '';
      return `#${d.messageIndex} zone=${d.zone} model=${d.model} tok≈${d.estimatedTokens} mod=${d.dominantModule} risk=${d.riskScore} [${blocks}]`;
    }
    case 'zone_shift':
      return `${d.from} → ${d.to} (${d.reason ?? '?'})`;
    case 'projection_signal':
      if (d.action === 'reinforced') return `reinforced ${d.count ?? 0} entries`;
      return `${d.category ?? '?'}: "${d.content ?? '?'}" str=${d.strength ?? '?'}`;
    case 'crisis_detected':
      return `level=${d.level} risk=${d.riskScore} src=${d.source ?? '?'}`;
    case 'model_selected':
      return `${d.model} (${d.reason ?? '?'})`;
    default:
      return JSON.stringify(d).slice(0, 120);
  }
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  backBtn: { fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  refreshBtn: { fontSize: 14, fontWeight: '500' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  content: { flex: 1 },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: { fontSize: 12, fontWeight: '500', flex: 1 },
  value: { fontSize: 12, fontWeight: '600', flex: 1, textAlign: 'right' },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  logCount: { fontSize: 12 },
  copyBtn: { fontSize: 13, fontWeight: '600' },
  emptyLog: { fontSize: 14, textAlign: 'center', marginTop: 40 },
  logList: { gap: 6 },
  logEntry: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  logEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logTime: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  logType: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  logData: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  utilities: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  utilBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  utilBtnText: { fontSize: 13, fontWeight: '600' },
  confidenceBar: {
    width: 60,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  confidenceFill: {
    height: 6,
    borderRadius: 3,
  },
});
