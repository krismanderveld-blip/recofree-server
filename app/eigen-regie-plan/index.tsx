/**
 * KERP01 — Eigen Regie Plan Overview Screen
 *
 * Shows the 5-zone bar + zone cards with summary content.
 * Tapping a zone card navigates to the zone detail/edit screen.
 * Includes access to wizard and export.
 */

import { useCallback, useMemo, useState } from 'react';
import { Text, View, ScrollView, Pressable, Alert, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { useColors } from '@/hooks/use-colors';
import { colors as dc, spacing, radius, typography } from '@/constants/design';
import { HomeButton } from '@/components/home-button';
import type { EigenRegieZoneId, EigenRegiePlan } from '@/lib/engine/kim/kerp01-types';
import { DEFAULT_EIGEN_REGIE_PLAN } from '@/lib/engine/kim/kerp01-types';
import { isPlanFilled } from '@/lib/engine/kim/kerp01-storage';

const ZONE_CONFIG: { id: EigenRegieZoneId; color: string; emoji: string; shortLabel: string }[] = [
  { id: 'donkergroen', color: '#16A34A', emoji: '🌿', shortLabel: 'Vrij' },
  { id: 'lichtgroen', color: '#4ADE80', emoji: '🌱', shortLabel: 'Terug' },
  { id: 'geel', color: '#EAB308', emoji: '⚖️', shortLabel: 'Wissel' },
  { id: 'oranje', color: '#F97316', emoji: '🔥', shortLabel: 'Rond ander' },
  { id: 'rood', color: '#EF4444', emoji: '🚨', shortLabel: 'Verlies' },
];

export default function EigenRegiePlanScreen() {
  const { getEigenRegiePlan, state } = useUser();
  const colors = useColors();
  const router = useRouter();
  const plan = getEigenRegiePlan() ?? DEFAULT_EIGEN_REGIE_PLAN;
  const filled = isPlanFilled(plan);

  const handleZonePress = useCallback((zoneId: EigenRegieZoneId) => {
    router.push(`/eigen-regie-plan/zone?id=${zoneId}` as any);
  }, [router]);

  const handleWizard = useCallback(() => {
    router.push('/eigen-regie-plan/wizard' as any);
  }, [router]);

  const handleExport = useCallback(() => {
    router.push('/eigen-regie-plan/export' as any);
  }, [router]);

  const handleTriggers = useCallback(() => {
    router.push('/eigen-regie-plan/triggers' as any);
  }, [router]);

  return (
    <ScreenContainer className="p-4" edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <HomeButton />
          <Text style={[styles.title, { color: dc.textPrimary }]}>Mijn Eigen Regie Plan</Text>
          <Text style={[styles.subtitle, { color: dc.textTertiary }]}>
            Jouw persoonlijke plan voor zelfrichting en grenzen
          </Text>
        </View>

        {/* Zone Bar */}
        <View style={styles.zoneBar}>
          {ZONE_CONFIG.map(zone => {
            const entry = plan.zones[zone.id];
            const hasContent = entry.signals.length > 0 || entry.whatHelps.length > 0;
            return (
              <Pressable
                key={zone.id}
                onPress={() => handleZonePress(zone.id)}
                style={({ pressed }) => [
                  styles.zoneBarItem,
                  { backgroundColor: zone.color, opacity: pressed ? 0.8 : (hasContent ? 1 : 0.4) },
                ]}
              >
                <Text style={styles.zoneBarEmoji}>{zone.emoji}</Text>
                <Text style={styles.zoneBarLabel}>{zone.shortLabel}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Main Anchor Sentence */}
        {plan.mainAnchorSentence ? (
          <View style={[styles.anchorCard, { backgroundColor: dc.surfaceKim }]}>
            <Text style={[styles.anchorLabel, { color: dc.textTertiary }]}>Mijn ankerzin</Text>
            <Text style={[styles.anchorText, { color: dc.textPrimary }]}>"{plan.mainAnchorSentence}"</Text>
          </View>
        ) : null}

        {/* Zone Cards */}
        {ZONE_CONFIG.map(zone => {
          const entry = plan.zones[zone.id];
          const hasContent = entry.signals.length > 0 || entry.whatHelps.length > 0 || entry.anchorSentence !== '';
          return (
            <Pressable
              key={zone.id}
              onPress={() => handleZonePress(zone.id)}
              style={({ pressed }) => [
                styles.zoneCard,
                { borderLeftColor: zone.color, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <View style={styles.zoneCardHeader}>
                <Text style={styles.zoneCardEmoji}>{zone.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.zoneCardTitle, { color: dc.textPrimary }]}>{entry.label || zone.shortLabel}</Text>
                  <Text style={[styles.zoneCardMeaning, { color: dc.textTertiary }]} numberOfLines={2}>
                    {entry.userMeaning || 'Nog niet ingevuld'}
                  </Text>
                </View>
                <Text style={{ color: dc.textTertiary, fontSize: 18 }}>›</Text>
              </View>
              {hasContent && (
                <View style={styles.zoneCardContent}>
                  {entry.signals.length > 0 && (
                    <Text style={[styles.zoneCardDetail, { color: dc.textSecondary }]} numberOfLines={1}>
                      Signalen: {entry.signals.slice(0, 2).join(', ')}
                    </Text>
                  )}
                  {entry.whatHelps.length > 0 && (
                    <Text style={[styles.zoneCardDetail, { color: dc.textSecondary }]} numberOfLines={1}>
                      Wat helpt: {entry.whatHelps.slice(0, 2).join(', ')}
                    </Text>
                  )}
                  {entry.anchorSentence && (
                    <Text style={[styles.zoneCardAnchor, { color: dc.primary }]} numberOfLines={1}>
                      ⚓ {entry.anchorSentence}
                    </Text>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}

        {/* Triggers & Boundary Rules */}
        <Pressable
          onPress={handleTriggers}
          style={({ pressed }) => [styles.actionCard, { opacity: pressed ? 0.9 : 1, backgroundColor: dc.surfaceKim }]}
        >
          <Text style={[styles.actionCardTitle, { color: dc.textPrimary }]}>
            🎯 Triggers & Grensregels
          </Text>
          <Text style={[styles.actionCardSubtitle, { color: dc.textTertiary }]}>
            {plan.triggers.length} triggers · {plan.boundaryRules.length} grensregels
          </Text>
        </Pressable>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleWizard}
            style={({ pressed }) => [styles.primaryButton, { backgroundColor: dc.primary, opacity: pressed ? 0.9 : 1 }]}
          >
            <Text style={styles.primaryButtonText}>
              {filled ? '🔄 Plan opnieuw opbouwen' : '✨ Plan opbouwen met wizard'}
            </Text>
          </Pressable>

          {filled && (
            <Pressable
              onPress={handleExport}
              style={({ pressed }) => [styles.secondaryButton, { borderColor: dc.primary, opacity: pressed ? 0.9 : 1 }]}
            >
              <Text style={[styles.secondaryButtonText, { color: dc.primary }]}>
                📤 Exporteren (delen met therapeut)
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', marginTop: 12 },
  subtitle: { fontSize: 14, marginTop: 4 },
  zoneBar: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  zoneBarItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  zoneBarEmoji: { fontSize: 18 },
  zoneBarLabel: { fontSize: 10, color: '#fff', fontWeight: '600', marginTop: 2 },
  anchorCard: { padding: 16, borderRadius: 12, marginBottom: 16 },
  anchorLabel: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
  anchorText: { fontSize: 16, fontStyle: 'italic', fontWeight: '500' },
  zoneCard: { backgroundColor: '#fff', borderLeftWidth: 4, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  zoneCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  zoneCardEmoji: { fontSize: 24 },
  zoneCardTitle: { fontSize: 15, fontWeight: '600' },
  zoneCardMeaning: { fontSize: 12, marginTop: 2 },
  zoneCardContent: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  zoneCardDetail: { fontSize: 12, marginBottom: 3 },
  zoneCardAnchor: { fontSize: 12, fontWeight: '500', marginTop: 4 },
  actionCard: { padding: 16, borderRadius: 12, marginBottom: 16 },
  actionCardTitle: { fontSize: 15, fontWeight: '600' },
  actionCardSubtitle: { fontSize: 12, marginTop: 4 },
  actions: { marginTop: 20, gap: 12 },
  primaryButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1.5 },
  secondaryButtonText: { fontSize: 15, fontWeight: '600' },
});
