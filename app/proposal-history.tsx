/**
 * DIST01 — Proposal History Screen
 *
 * Shows all proposals (accepted, rejected, dismissed, expired, auto-saved)
 * with timestamps, target documents, and the text that was written.
 * Accessible from Profile → "Inzichten & voorstellen".
 */
import { useCallback, useEffect, useState } from 'react';
import { Text, View, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors as dc, spacing, radius, typography, cardStyles } from '@/constants/design';
import { useUser } from '@/lib/user-context';
import { createProposalStore } from '@/lib/engine/shared/dist01-proposal-store';
import type { DistillationProposal, ProposalStatus } from '@/lib/engine/shared/dist01-proposal-types';
import { getTargetDocumentLabel, getTargetFieldLabel } from '@/lib/engine/shared/dist01-proposal-generator';
import { useTranslation } from '@/lib/i18n';
import { LocalDeviceTimeService } from '@/lib/core/time';

// ─── Filter Tabs ──────────────────────────────────────────────────────────

type FilterTab = 'all' | 'accepted' | 'rejected' | 'auto_saved' | 'expired';

const FILTER_TABS: { key: FilterTab; labelKey: string }[] = [
  { key: 'all', labelKey: 'proposal_history.filter.all' },
  { key: 'accepted', labelKey: 'proposal_history.filter.accepted' },
  { key: 'rejected', labelKey: 'proposal_history.filter.rejected' },
  { key: 'auto_saved', labelKey: 'proposal_history.filter.auto_saved' },
  { key: 'expired', labelKey: 'proposal_history.filter.expired' },
];

// ─── Status Badge ─────────────────────────────────────────────────────────

function getStatusColor(status: ProposalStatus): string {
  switch (status) {
    case 'accepted':
    case 'edited':
      return dc.success;
    case 'rejected':
      return dc.danger;
    case 'dismissed':
      return dc.textTertiary;
    case 'expired':
      return dc.warning;
    case 'pending':
      return dc.primary;
    default:
      return dc.textSecondary;
  }
}

function getStatusLabel(status: ProposalStatus, t: (key: string) => string): string {
  switch (status) {
    case 'accepted': return t('proposal_history.status.accepted');
    case 'edited': return t('proposal_history.status.edited');
    case 'rejected': return t('proposal_history.status.rejected');
    case 'dismissed': return t('proposal_history.status.dismissed');
    case 'expired': return t('proposal_history.status.expired');
    case 'pending': return t('proposal_history.status.pending');
    default: return status;
  }
}

// ─── Time Formatting ──────────────────────────────────────────────────────

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'zojuist';
  if (diffMin < 60) return `${diffMin} min geleden`;
  if (diffHr < 24) return `${diffHr} uur geleden`;
  if (diffDays < 7) return `${diffDays} dag${diffDays > 1 ? 'en' : ''} geleden`;
  return new Date(isoDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

// ─── Main Screen ──────────────────────────────────────────────────────────

export default function ProposalHistoryScreen() {
  const { state } = useUser();
  const router = useRouter();
  const { t } = useTranslation();
  const [proposals, setProposals] = useState<DistillationProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  // Load proposals
  useEffect(() => {
    (async () => {
      try {
        const persona = (state.userType === 'elias' ? 'elias' : 'kim') as 'elias' | 'kim';
        const store = createProposalStore();
        const data = await store.load(persona);
        // Sort by most recent first
        const sorted = [...data.proposals].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setProposals(sorted);
      } catch (e) {
        console.warn('[ProposalHistory] Failed to load:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [state.userType]);

  // Filter proposals
  const filteredProposals = proposals.filter((p) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'accepted') return p.status === 'accepted' || p.status === 'edited';
    if (activeFilter === 'auto_saved') return p.autoSaveAllowed && p.status === 'accepted' && p.repeatedDetection?.autoSavedAt;
    return p.status === activeFilter;
  });

  // Stats
  const stats = {
    total: proposals.length,
    accepted: proposals.filter((p) => p.status === 'accepted' || p.status === 'edited').length,
    rejected: proposals.filter((p) => p.status === 'rejected').length,
    autoSaved: proposals.filter((p) => p.repeatedDetection?.autoSavedAt).length,
    pending: proposals.filter((p) => p.status === 'pending').length,
  };

  const renderProposalItem = useCallback(({ item }: { item: DistillationProposal }) => (
    <View style={styles.card}>
      {/* Header: status badge + time */}
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status, t)}
          </Text>
        </View>
        <Text style={styles.timeText}>{formatRelativeTime(item.updatedAt)}</Text>
      </View>

      {/* Content */}
      <Text style={styles.proposalText} numberOfLines={3}>
        {item.editedText || item.proposedUserFacingText}
      </Text>

      {/* Target info */}
      <View style={styles.targetRow}>
        <Text style={styles.targetLabel}>→ {getTargetDocumentLabel(item.targetDocument)}</Text>
        <Text style={styles.targetField}>{getTargetFieldLabel(item.targetField)}</Text>
      </View>

      {/* Auto-save indicator */}
      {item.repeatedDetection?.autoSavedAt && (
        <View style={styles.autoSaveBadge}>
          <Text style={styles.autoSaveText}>⚡ {t('proposal_history.auto_saved_label')}</Text>
        </View>
      )}

      {/* Detection count */}
      {item.repeatedDetection && item.repeatedDetection.detectionCount > 1 && (
        <Text style={styles.detectionCount}>
          {t('proposal_history.detected_times', { count: item.repeatedDetection.detectionCount })}
        </Text>
      )}
    </View>
  ), [t]);

  return (
    <ScreenContainer edges={['top', 'left', 'right']} className="flex-1 bg-background">
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="chevron.left.forwardslash.chevron.right" size={20} color={dc.primary} />
          <Text style={styles.backText}>{t('proposal_history.back')}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('proposal_history.title')}</Text>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.accepted}</Text>
          <Text style={styles.statLabel}>{t('proposal_history.stat.accepted')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.autoSaved}</Text>
          <Text style={styles.statLabel}>{t('proposal_history.stat.auto_saved')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.rejected}</Text>
          <Text style={styles.statLabel}>{t('proposal_history.stat.rejected')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>{t('proposal_history.stat.pending')}</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveFilter(tab.key)}
            style={[
              styles.filterTab,
              activeFilter === tab.key && styles.filterTabActive,
            ]}
          >
            <Text style={[
              styles.filterTabText,
              activeFilter === tab.key && styles.filterTabTextActive,
            ]}>
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={dc.primary} />
        </View>
      ) : filteredProposals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>{t('proposal_history.empty.title')}</Text>
          <Text style={styles.emptySubtitle}>{t('proposal_history.empty.subtitle')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProposals}
          keyExtractor={(item) => item.id}
          renderItem={renderProposalItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    ...typography.bodySmall,
    color: dc.primary,
    fontWeight: '600',
  },
  headerTitle: {
    ...typography.titleSmall,
    color: dc.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // offset for back button
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: dc.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  statNumber: {
    ...typography.titleSmall,
    color: dc.primary,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.caption,
    color: dc.textSecondary,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  filterTab: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: dc.surface,
  },
  filterTabActive: {
    backgroundColor: dc.primary,
  },
  filterTabText: {
    ...typography.caption,
    color: dc.textSecondary,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: dc.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: dc.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 11,
  },
  timeText: {
    ...typography.caption,
    color: dc.textTertiary,
  },
  proposalText: {
    ...typography.bodySmall,
    color: dc.textPrimary,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  targetLabel: {
    ...typography.caption,
    color: dc.primary,
    fontWeight: '500',
  },
  targetField: {
    ...typography.caption,
    color: dc.textTertiary,
  },
  autoSaveBadge: {
    marginTop: spacing.xs,
  },
  autoSaveText: {
    ...typography.caption,
    color: dc.success,
    fontWeight: '500',
  },
  detectionCount: {
    ...typography.caption,
    color: dc.textTertiary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.titleSmall,
    color: dc.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: dc.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
