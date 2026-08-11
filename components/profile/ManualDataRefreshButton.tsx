/**
 * ManualDataRefreshButton — User-facing button to refresh local clinical data
 *
 * Triggers local refresh of Backpack analysis, VSP/ERP, DIST01, context.dat
 * so the next chat uses the most recent clinical context.
 *
 * NEVER sends raw data to GPT. Only refreshes local layers.
 */
import { useState } from 'react';
import { Text, View, Pressable, Platform, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useUser } from '@/lib/user-context';
import { runManualDataRefresh, loadManualRefreshState } from '@/lib/rugzak/manual-data-refresh';
import type { ManualDataRefreshOutput, ManualRefreshState } from '@/lib/rugzak/manual-data-refresh';
import { colors as dc, spacing, typography, cardStyles } from '@/constants/design';
import { LocalDeviceTimeService } from '@/lib/core/time';
import { useTranslation } from '@/lib/i18n';
import { useEffect } from 'react';

export function ManualDataRefreshButton() {
  const { state } = useUser();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ManualDataRefreshOutput | null>(null);
  const [lastRefresh, setLastRefresh] = useState<ManualRefreshState | null>(null);

  const persona = (state.userType === 'kim' ? 'kim' : 'elias') as 'elias' | 'kim';

  useEffect(() => {
    loadManualRefreshState().then(setLastRefresh).catch(() => {});
  }, []);

  const handleRefresh = async () => {
    if (loading) return;
    setLoading(true);
    setResult(null);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const output = await runManualDataRefresh({
        persona,
        refreshBackpack: true,
        refreshVsp: persona === 'elias',
        refreshErp: persona === 'kim',
        refreshDist01: true,
        refreshContextDat: true,
        forceNextChatCMD: true,
        reason: 'manual_user_refresh',
        nowLocal: LocalDeviceTimeService.now().utcIso,
      });

      setResult(output);
      setLastRefresh({
        lastUpdatedAtLocal: output.updatedAtLocal,
        persona,
        status: output.ok ? (output.errors.length > 0 ? 'partial' : 'success') : 'error',
        forceNextChatCMD: true,
      });

      if (Platform.OS !== 'web') {
        if (output.ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    } catch {
      setResult({ ok: false, refreshed: { backpackAnalysis: false, vspAnalysis: false, erpAnalysis: false, dist01: false, contextDat: false, cmdReadyForNextChat: false }, skipped: [], errors: [{ key: 'global', message: 'Unexpected error' }], updatedAtLocal: LocalDeviceTimeService.now().utcIso });
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (): string => {
    if (loading) return 'Gegevens worden bijgewerkt...';
    if (result) {
      if (result.ok && result.errors.length === 0) return 'Gegevens bijgewerkt. Je volgende gesprek gebruikt de meest recente context.';
      if (result.ok && result.errors.length > 0) return 'Gegevens gedeeltelijk bijgewerkt. Sommige onderdelen waren nog leeg of niet beschikbaar.';
      return 'Bijwerken lukte niet. Probeer het straks opnieuw.';
    }
    return '';
  };

  const getStatusColor = (): string => {
    if (!result) return dc.textSecondary;
    if (result.ok && result.errors.length === 0) return dc.success;
    if (result.ok) return dc.warning;
    return dc.danger;
  };

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Pressable
        onPress={handleRefresh}
        disabled={loading}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
      >
        <View style={{
          ...cardStyles.default,
          backgroundColor: loading ? dc.surface : dc.surface,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: dc.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
            {loading ? (
              <ActivityIndicator size="small" color={dc.primary} />
            ) : (
              <Text style={{ fontSize: 16 }}>{'🔄'}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodyMedium, fontWeight: '600', color: dc.textPrimary }}>
              Gegevens bijwerken
            </Text>
            <Text style={{ ...typography.caption, color: dc.textSecondary, marginTop: 2 }}>
              Werk Backpack, signaleringsplan en klinische context bij voor je volgende gesprek.
            </Text>
          </View>
        </View>
      </Pressable>

      {/* Status feedback */}
      {(loading || result) && (
        <View style={{ marginTop: spacing.xs, paddingHorizontal: spacing.sm }}>
          <Text style={{ ...typography.caption, color: getStatusColor() }}>
            {getStatusText()}
          </Text>
        </View>
      )}

      {/* Privacy note */}
      <View style={{ marginTop: spacing.xs, paddingHorizontal: spacing.sm }}>
        <Text style={{ ...typography.micro, color: dc.textMuted }}>
          Er wordt geen ruwe Backpack- of geheugendata rechtstreeks naar GPT gestuurd. RecoFree gebruikt alleen veilige, geselecteerde samenvatting waar nodig.
        </Text>
      </View>

      {/* Last refresh info */}
      {lastRefresh && !loading && !result && (
        <View style={{ marginTop: spacing.xs, paddingHorizontal: spacing.sm }}>
          <Text style={{ ...typography.micro, color: dc.textMuted }}>
            Laatst bijgewerkt: {new Date(lastRefresh.lastUpdatedAtLocal).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}
    </View>
  );
}
