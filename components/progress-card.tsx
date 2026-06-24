/**
 * ProgressCard — Local progress visibility component for Mood tab.
 *
 * Shows persona-separated progress data:
 * - Elias: Mood/craving/focus trends, sobriety streak, active modules, signals
 * - Kim: Stress/boundary/burden/self-care trends, active modules, signals
 *
 * Rules:
 * - No scores or rankings
 * - No comparison with other users
 * - No gamification elements
 * - Only shows data already available in local storage
 * - Streaks never create shame or pressure
 * - Negative signals are never "failure"
 */

import { useState, useMemo } from 'react';
import { Text, View, Pressable, StyleSheet } from 'react-native';
import { useUser } from '@/lib/user-context';
import { useColors } from '@/hooks/use-colors';
import { colors as dc, spacing, radius, typography } from '@/constants/design';
import {
  computeEliasProgress,
  detectEliasProgress,
  type EliasProgressSummary,
  type ComputedTrend,
  type TrendDirection,
} from '@/lib/engine/elias/elias-progress-tracker';
import {
  computeKimProgress,
  detectKimProgress,
  type KimProgressSummary,
} from '@/lib/engine/kim/kim-progress-tracker';
import { useTranslation, tStatic } from '@/lib/i18n';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function trendArrow(direction: TrendDirection): string {
  switch (direction) {
    case 'DOWN': return tStatic('progress_card.trend_arrow.down');
    case 'UP': return tStatic('progress_card.trend_arrow.up');
    case 'STABLE': return tStatic('progress_card.trend_arrow.stable');
    case 'MIXED': return tStatic('progress_card.trend_arrow.mixed');
    case 'INSUFFICIENT_DATA': return tStatic('progress_card.trend_arrow.insufficient_data');
  }
}

function trendColor(direction: TrendDirection, isPositive: boolean): string {
  if (direction === 'INSUFFICIENT_DATA' || direction === 'STABLE' || direction === 'MIXED') {
    return '#9CA3AF';
  }
  if (isPositive) {
    return direction === 'UP' ? dc.success : dc.moodOrange;
  }
  return direction === 'DOWN' ? dc.success : dc.moodOrange;
}

function interpretationLabel(interpretation: string): string {
  switch (interpretation) {
    case 'softened': return tStatic('progress_card.interpretation.softened');
    case 'increased': return tStatic('progress_card.interpretation.increased');
    case 'stable': return tStatic('progress_card.interpretation.stable');
    case 'not_enough_data': return tStatic('progress_card.interpretation.not_enough_data');
    default: return '';
  }
}

const POSITIVE_KEYS = new Set(['focus', 'selfCare']);

// ─── Trend Row ───────────────────────────────────────────────────────────────

function TrendRow({ trend }: { trend: ComputedTrend }) {
  const isPositive = POSITIVE_KEYS.has(trend.key);
  const color = trendColor(trend.direction, isPositive);
  const arrow = trendArrow(trend.direction);

  return (
    <View style={styles.trendRow}>
      <View style={styles.trendLabelContainer}>
        <Text style={[styles.trendLabel, { color: dc.textPrimary }]}>{trend.label}</Text>
      </View>
      <View style={styles.trendValueContainer}>
        <Text style={[styles.trendArrow, { color }]}>{arrow}</Text>
        <Text style={[styles.trendInterpretation, { color }]}>
          {interpretationLabel(trend.interpretation)}
        </Text>
      </View>
    </View>
  );
}

// ─── Signal Summary ──────────────────────────────────────────────────────────

function SignalSummary({ signals }: { signals: { softened: string[]; increased: string[]; stable: string[]; insufficientData: string[] } }) {
  const hasSoftened = signals.softened.length > 0;
  const hasIncreased = signals.increased.length > 0;

  if (!hasSoftened && !hasIncreased) return null;

  return (
    <View style={styles.signalContainer}>
      {hasSoftened && (
        <View style={[styles.signalBadge, { backgroundColor: dc.success + '15', borderColor: dc.success + '40' }]}>
          <Text style={[styles.signalText, { color: dc.success }]}>
            {tStatic('progress_card.signal.softened_prefix')}{signals.softened.join(', ')}
          </Text>
        </View>
      )}
      {hasIncreased && (
        <View style={[styles.signalBadge, { backgroundColor: dc.moodOrange + '15', borderColor: dc.moodOrange + '40' }]}>
          <Text style={[styles.signalText, { color: dc.moodOrange }]}>
            {tStatic('progress_card.signal.increased_prefix')}{signals.increased.join(', ')}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Active Modules ──────────────────────────────────────────────────────────

function ActiveModulesRow({ modules }: { modules: { moduleId: string; count: number }[] }) {
  if (modules.length === 0) return null;

  return (
    <View style={styles.modulesContainer}>
      <Text style={styles.sectionLabel}>{tStatic('progress_card.active_modules.title')}</Text>
      <View style={styles.modulesRow}>
        {modules.map((m) => (
          <View key={m.moduleId} style={styles.moduleBadge}>
            <Text style={styles.moduleText}>{m.moduleId}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Elias Progress Card ─────────────────────────────────────────────────────

function EliasProgressContent({ summary }: { summary: EliasProgressSummary }) {
  const [showWindow, setShowWindow] = useState<'7' | '30'>('7');
  const trends = showWindow === '7' ? summary.windows.days7 : summary.windows.days30;

  return (
    <View style={styles.contentContainer}>
      {/* Window Toggle */}
      <View style={styles.windowToggle}>
        <Pressable
          onPress={() => setShowWindow('7')}
          style={({ pressed }) => [
            styles.windowButton,
            showWindow === '7' && styles.windowButtonActive,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.windowButtonText, showWindow === '7' && styles.windowButtonTextActive]}>
            {tStatic('progress_card.elias.window.7_days')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setShowWindow('30')}
          style={({ pressed }) => [
            styles.windowButton,
            showWindow === '30' && styles.windowButtonActive,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.windowButtonText, showWindow === '30' && styles.windowButtonTextActive]}>
            {tStatic('progress_card.elias.window.30_days')}
          </Text>
        </Pressable>
      </View>

      {/* Trends */}
      <View style={styles.trendsContainer}>
        {trends.map((t) => (
          <TrendRow key={t.key} trend={t} />
        ))}
      </View>

      {/* Signal Summary */}
      <SignalSummary signals={summary.negativeSignals} />

      {/* Sobriety */}
      {summary.sobriety.sobrietyDate && (
        <View style={styles.sobrietyContainer}>
          <Text style={styles.sectionLabel}>{tStatic('progress_card.elias.sobriety.title')}</Text>
          <Text style={styles.sobrietyText}>{summary.sobriety.displayCopy}</Text>
        </View>
      )}

      {/* Active Modules */}
      <ActiveModulesRow modules={summary.activeModules} />

      {/* Projection Movement */}
      {(summary.projectionMovement.fearCount > 0 || summary.projectionMovement.hopeCount > 0) && (
        <View style={styles.projectionContainer}>
          <Text style={styles.sectionLabel}>{tStatic('progress_card.elias.inner_landscape.title')}</Text>
          {summary.projectionMovement.strongestHope && (
            <Text style={[styles.projectionText, { color: dc.success }]}>
              {tStatic('progress_card.elias.inner_landscape.hope_prefix')}{summary.projectionMovement.strongestHope}
            </Text>
          )}
          {summary.projectionMovement.strongestFear && (
            <Text style={[styles.projectionText, { color: dc.moodOrange }]}>
              {tStatic('progress_card.elias.inner_landscape.fear_prefix')}{summary.projectionMovement.strongestFear}
            </Text>
          )}
        </View>
      )}

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>
        {tStatic('progress_card.elias.disclaimer')}
      </Text>
    </View>
  );
}

// ─── Kim Progress Card ───────────────────────────────────────────────────────

function KimProgressContent({ summary }: { summary: KimProgressSummary }) {
  const [showWindow, setShowWindow] = useState<'7' | '30'>('7');
  const trends = showWindow === '7' ? summary.windows.days7 : summary.windows.days30;

  return (
    <View style={styles.contentContainer}>
      {/* Window Toggle */}
      <View style={styles.windowToggle}>
        <Pressable
          onPress={() => setShowWindow('7')}
          style={({ pressed }) => [
            styles.windowButton,
            showWindow === '7' && styles.windowButtonActive,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.windowButtonText, showWindow === '7' && styles.windowButtonTextActive]}>
            {tStatic('progress_card.kim.window.7_days')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setShowWindow('30')}
          style={({ pressed }) => [
            styles.windowButton,
            showWindow === '30' && styles.windowButtonActive,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.windowButtonText, showWindow === '30' && styles.windowButtonTextActive]}>
            {tStatic('progress_card.kim.window.30_days')}
          </Text>
        </Pressable>
      </View>

      {/* Trends */}
      <View style={styles.trendsContainer}>
        {trends.map((t) => (
          <TrendRow key={t.key} trend={t} />
        ))}
      </View>

      {/* Signal Summary */}
      <SignalSummary signals={summary.negativeSignals} />

      {/* Self-care */}
      <View style={styles.selfCareContainer}>
        <Text style={styles.sectionLabel}>{tStatic('progress_card.kim.self_care.title')}</Text>
        <Text style={styles.selfCareText}>{summary.selfCare.displayCopy}</Text>
      </View>

      {/* Active Modules */}
      <ActiveModulesRow modules={summary.activeModules} />

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>
        {tStatic('progress_card.kim.disclaimer')}
      </Text>
    </View>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function ProgressCard() {
  const { state, getUserDat } = useUser();
  const colors = useColors();
  const userType = state.userType ?? 'elias';
  const userDat = getUserDat();
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  const progressData = useMemo(() => {
    if (!userDat) return null;
    const now = new Date().toISOString();
    const moodHistory = userDat.moodHistory ?? [];
    const moduleUsage = userDat.moduleUsage ?? [];
    const repeatingPatterns = userDat.repeatingPatterns ?? [];

    if (userType === 'elias') {
      const input = {
        intakeCompleted: (userDat.totalSessions ?? 0) > 0,
        crisisProtocolStatus: 'CLEAR' as const,
        requestContext: 'progress_screen' as const,
        moodHistory,
        sobrietyDate: userDat.sobrietyDate ?? null,
        moduleUsage,
        repeatingPatterns,
        projection: null, // Projection loaded separately if needed
        timestampIso: now,
      };

      const detection = detectEliasProgress(input);
      if (detection.activationStatus !== 'ACTIVE') return null;
      return computeEliasProgress(input);
    } else {
      const input = {
        intakeCompleted: (userDat.totalSessions ?? 0) > 0,
        crisisProtocolStatus: 'CLEAR' as const,
        requestContext: 'progress_screen' as const,
        moodHistory,
        moduleUsage,
        repeatingPatterns,
        timestampIso: now,
      };

      const detection = detectKimProgress(input);
      if (detection.activationStatus !== 'ACTIVE') return null;
      return computeKimProgress(input);
    }
  }, [userDat, userType]);

  if (!progressData) return null;

  // Check if there's any meaningful data to show
  const hasMeaningfulData = progressData.windows.days7.some(
    (t) => t.direction !== 'INSUFFICIENT_DATA'
  );
  if (!hasMeaningfulData) return null;

  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerIcon}>{t('progress_card.header.icon')}</Text>
            <Text style={[styles.headerTitle, { color: dc.textPrimary }]}>{t('progress_card.header.title')}</Text>
          </View>
          <Text style={[styles.expandArrow, { color: dc.textTertiary }]}>
            {expanded ? t('progress_card.header.expand_arrow') : t('progress_card.header.collapse_arrow')}
          </Text>
        </View>
      </Pressable>

      {expanded && (
        progressData.persona === 'elias'
          ? <EliasProgressContent summary={progressData as EliasProgressSummary} />
          : <KimProgressContent summary={progressData as KimProgressSummary} />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: spacing.cardPadding,
    borderWidth: 1,
    marginBottom: spacing.cardGap,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  expandArrow: {
    fontSize: 12,
  },
  contentContainer: {
    marginTop: 16,
    gap: 16,
  },
  windowToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  windowButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  windowButtonActive: {
    backgroundColor: dc.primary + '15',
  },
  windowButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  windowButtonTextActive: {
    color: dc.primary,
  },
  trendsContainer: {
    gap: 10,
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendLabelContainer: {
    flex: 1,
  },
  trendLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  trendValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendArrow: {
    fontSize: 16,
    fontWeight: '700',
  },
  trendInterpretation: {
    fontSize: 11,
    fontWeight: '500',
  },
  signalContainer: {
    gap: 8,
  },
  signalBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  signalText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sobrietyContainer: {
    gap: 4,
  },
  sobrietyText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  selfCareContainer: {
    gap: 4,
  },
  selfCareText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  modulesContainer: {
    gap: 8,
  },
  modulesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  moduleBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  moduleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  projectionContainer: {
    gap: 4,
  },
  projectionText: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  disclaimer: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 4,
  },
});
