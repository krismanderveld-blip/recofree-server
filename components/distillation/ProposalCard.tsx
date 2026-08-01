/**
 * DIST01 — DistillationProposalCard
 *
 * In-chat UI component that shows a proposal to the user.
 * Displays:
 * - Source excerpt (rawUserTextExcerpt)
 * - Proposed destination (target document + field)
 * - Proposed text (editable)
 * - Action buttons: Toevoegen | Aanpassen | Niet nu | Niet bewaren
 *
 * Design: Subtle card that appears between chat messages.
 * Follows Apple HIG for inline suggestions.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { useTranslation } from '@/lib/i18n';
import type { DistillationProposal, ProposalUserAction } from '@/lib/engine/shared/dist01-proposal-types';
import {
  getTargetDocumentLabel,
  getTargetFieldLabel,
} from '@/lib/engine/shared/dist01-proposal-generator';

// ─── Props ────────────────────────────────────────────────────────────────

interface ProposalCardProps {
  proposal: DistillationProposal;
  onAction: (proposalId: string, action: ProposalUserAction, editedText?: string) => void;
  /** Whether the card is in compact mode (collapsed) */
  compact?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────

export function DistillationProposalCard({ proposal, onAction, compact = false }: ProposalCardProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(proposal.proposedUserFacingText);
  const [expanded, setExpanded] = useState(!compact);

  const destinationLabel = `${getTargetDocumentLabel(proposal.targetDocument)} — ${getTargetFieldLabel(proposal.targetField)}`;

  const handleAccept = useCallback(() => {
    onAction(proposal.id, 'accept');
  }, [proposal.id, onAction]);

  const handleEdit = useCallback(() => {
    if (isEditing) {
      // Submit edit
      onAction(proposal.id, 'edit', editText);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  }, [proposal.id, onAction, isEditing, editText]);

  const handleDismiss = useCallback(() => {
    onAction(proposal.id, 'dismiss');
  }, [proposal.id, onAction]);

  const handleReject = useCallback(() => {
    onAction(proposal.id, 'reject');
  }, [proposal.id, onAction]);

  if (!expanded) {
    return (
      <Pressable
        onPress={() => setExpanded(true)}
        style={({ pressed }) => [
          styles.compactContainer,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={styles.compactDot} />
        <Text style={[styles.compactText, { color: colors.muted }]} numberOfLines={1}>
          {t('distillation.proposal.suggestion_available')}
        </Text>
        <Text style={[styles.compactChevron, { color: colors.muted }]}>›</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerDot, { backgroundColor: colors.primary }]} />
        <Text style={[styles.headerText, { color: colors.muted }]}>
          {t('distillation.proposal.header')}
        </Text>
      </View>

      {/* Source excerpt */}
      <View style={[styles.excerptContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.excerptLabel, { color: colors.muted }]}>
          {t('distillation.proposal.source_label')}
        </Text>
        <Text style={[styles.excerptText, { color: colors.foreground }]} numberOfLines={3}>
          "{proposal.rawUserTextExcerpt}"
        </Text>
      </View>

      {/* Destination */}
      <View style={styles.destinationRow}>
        <Text style={[styles.destinationLabel, { color: colors.muted }]}>
          {t('distillation.proposal.destination_label')}
        </Text>
        <Text style={[styles.destinationValue, { color: colors.primary }]}>
          {destinationLabel}
        </Text>
      </View>

      {/* Proposed text (editable) */}
      <View style={styles.proposedTextContainer}>
        <Text style={[styles.proposedLabel, { color: colors.muted }]}>
          {t('distillation.proposal.proposed_text_label')}
        </Text>
        {isEditing ? (
          <TextInput
            style={[
              styles.editInput,
              {
                color: colors.foreground,
                backgroundColor: colors.background,
                borderColor: colors.primary,
              },
            ]}
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
            returnKeyType="done"
          />
        ) : (
          <Text style={[styles.proposedText, { color: colors.foreground }]}>
            {proposal.proposedUserFacingText}
          </Text>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {/* Primary: Toevoegen */}
        <Pressable
          onPress={handleAccept}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={[styles.primaryButtonText, { color: colors.background }]}>
            {t('distillation.proposal.action_accept')}
          </Text>
        </Pressable>

        {/* Secondary: Aanpassen */}
        <Pressable
          onPress={handleEdit}
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: colors.primary },
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
            {isEditing
              ? t('distillation.proposal.action_save_edit')
              : t('distillation.proposal.action_edit')}
          </Text>
        </Pressable>

        {/* Tertiary: Niet nu */}
        <Pressable
          onPress={handleDismiss}
          style={({ pressed }) => [
            styles.tertiaryButton,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={[styles.tertiaryButtonText, { color: colors.muted }]}>
            {t('distillation.proposal.action_dismiss')}
          </Text>
        </Pressable>

        {/* Tertiary: Niet bewaren */}
        <Pressable
          onPress={handleReject}
          style={({ pressed }) => [
            styles.tertiaryButton,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={[styles.tertiaryButtonText, { color: colors.error }]}>
            {t('distillation.proposal.action_reject')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  compactContainer: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0a7ea4',
  },
  compactText: {
    flex: 1,
    fontSize: 13,
  },
  compactChevron: {
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  excerptContainer: {
    borderRadius: 10,
    padding: 12,
  },
  excerptLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  excerptText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  destinationLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  destinationValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  proposedTextContainer: {
    gap: 4,
  },
  proposedLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  proposedText: {
    fontSize: 14,
    lineHeight: 20,
  },
  editInput: {
    fontSize: 14,
    lineHeight: 20,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tertiaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tertiaryButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
