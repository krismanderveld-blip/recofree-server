/**
 * NotificationPermissionCard
 *
 * Shows the current notification permission status and allows the user
 * to request permission or open settings to grant it.
 * Also shows the bell toggle state and allows enabling/disabling notifications.
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Platform, Linking, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors as dc, spacing, typography, cardStyles } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import {
  getPermissionStatus,
  requestPermission,
  loadBellState,
  enableBell,
  disableBell,
} from '@/lib/features/dayStructure/permission-service';
import { isConfigured } from '@/lib/features/dayStructure/day-structure-service';
import {
  scheduleAllNotifications,
  cancelAllNotifications,
} from '@/lib/features/dayStructure/notification-service';
import { getDocument } from '@/lib/features/dayStructure/day-structure-service';
import type { BellState } from '@/lib/features/dayStructure/types';

export function NotificationPermissionCard() {
  const { t } = useTranslation();
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [bellState, setBellState] = useState<BellState>('not_configured');
  const [hasStructure, setHasStructure] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const loadState = useCallback(async () => {
    const status = await getPermissionStatus();
    setPermissionStatus(status);
    const bell = await loadBellState();
    setBellState(bell);
    const configured = await isConfigured();
    setHasStructure(configured);
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const handleRequestPermission = async () => {
    const result = await requestPermission();
    setPermissionStatus(result);
    if (result === 'granted') {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // Auto-enable bell if structure exists
      if (hasStructure) {
        const newBell = await enableBell();
        setBellState(newBell);
        // Schedule notifications
        const doc = await getDocument();
        await scheduleAllNotifications(doc.weekSchema);
      }
    } else {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const handleOpenSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const handleToggleBell = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (bellState === 'enabled') {
      await disableBell();
      setBellState('disabled');
      await cancelAllNotifications();
    } else {
      // Need permission first
      if (permissionStatus !== 'granted') {
        const result = await requestPermission();
        setPermissionStatus(result);
        if (result !== 'granted') {
          Alert.alert(
            t('profile.notifications.denied_title'),
            t('profile.notifications.denied_message'),
            [
              { text: t('profile.notifications.cancel'), style: 'cancel' },
              { text: t('profile.notifications.open_settings'), onPress: handleOpenSettings },
            ]
          );
          return;
        }
      }
      const newBell = await enableBell();
      setBellState(newBell);
      if (newBell === 'enabled') {
        const doc = await getDocument();
        await scheduleAllNotifications(doc.weekSchema);
      }
    }
  };

  // Status indicator
  const getStatusInfo = () => {
    if (permissionStatus === 'denied') {
      return {
        icon: '🔕',
        color: dc.danger,
        label: t('profile.notifications.status_denied'),
        description: t('profile.notifications.denied_help'),
      };
    }
    if (permissionStatus === 'undetermined') {
      return {
        icon: '🔔',
        color: dc.warning,
        label: t('profile.notifications.status_not_asked'),
        description: t('profile.notifications.not_asked_help'),
      };
    }
    // granted
    if (bellState === 'enabled') {
      return {
        icon: '🔔',
        color: dc.success,
        label: t('profile.notifications.status_active'),
        description: t('profile.notifications.active_help'),
      };
    }
    return {
      icon: '🔕',
      color: dc.textMuted,
      label: t('profile.notifications.status_disabled'),
      description: t('profile.notifications.disabled_help'),
    };
  };

  const status = getStatusInfo();

  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text style={{ ...typography.micro, color: dc.textTertiary, marginBottom: spacing.xs, fontWeight: '700', letterSpacing: 0.5 }}>
        {t('profile.notifications.section_title')}
      </Text>

      <View style={{
        ...cardStyles.default,
        gap: 12,
      }}>
        {/* Status row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: status.color + '15', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 16 }}>{status.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodyMedium, fontWeight: '600', color: dc.textPrimary }}>
              {status.label}
            </Text>
            <Text style={{ ...typography.caption, color: dc.textSecondary, marginTop: 2 }}>
              {status.description}
            </Text>
          </View>
        </View>

        {/* Action button */}
        {permissionStatus === 'undetermined' && (
          <Pressable
            onPress={handleRequestPermission}
            style={({ pressed }) => [{
              backgroundColor: dc.primary,
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 16,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            }]}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
              {t('profile.notifications.enable_button')}
            </Text>
          </Pressable>
        )}

        {permissionStatus === 'denied' && (
          <Pressable
            onPress={handleOpenSettings}
            style={({ pressed }) => [{
              backgroundColor: dc.danger + '15',
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: dc.danger + '30',
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            }]}
          >
            <Text style={{ color: dc.danger, fontWeight: '600', fontSize: 14 }}>
              {t('profile.notifications.open_settings')}
            </Text>
          </Pressable>
        )}

        {/* Test notification button */}
        {permissionStatus === 'granted' && bellState === 'enabled' && (
          <Pressable
            onPress={async () => {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: t('profile.notifications.test_title'),
                  body: t('profile.notifications.test_body'),
                  sound: true,
                },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
              });
              setTestSent(true);
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              setTimeout(() => setTestSent(false), 5000);
            }}
            style={({ pressed }) => [{
              backgroundColor: dc.primarySoft,
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: dc.primary + '30',
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            }]}
          >
            <Text style={{ fontSize: 14 }}>{testSent ? '✅' : '🔔'}</Text>
            <Text style={{ color: dc.primary, fontWeight: '600', fontSize: 14 }}>
              {testSent ? t('profile.notifications.test_sent') : t('profile.notifications.test_button')}
            </Text>
          </Pressable>
        )}

        {permissionStatus === 'granted' && hasStructure && (
          <Pressable
            onPress={handleToggleBell}
            style={({ pressed }) => [{
              backgroundColor: bellState === 'enabled' ? dc.success + '15' : dc.surface,
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: bellState === 'enabled' ? dc.success + '30' : dc.border,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            }]}
          >
            <IconSymbol
              name={bellState === 'enabled' ? 'bell.fill' : 'bell.slash.fill'}
              size={16}
              color={bellState === 'enabled' ? dc.success : dc.textSecondary}
            />
            <Text style={{
              color: bellState === 'enabled' ? dc.success : dc.textSecondary,
              fontWeight: '600',
              fontSize: 14,
            }}>
              {bellState === 'enabled'
                ? t('profile.notifications.toggle_off')
                : t('profile.notifications.toggle_on')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
