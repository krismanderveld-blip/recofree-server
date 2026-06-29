/**
 * ScrollWheelTimePicker
 *
 * iOS-style scroll wheel time picker with two columns (hours + minutes).
 * Selected value is large/white in center, adjacent values are smaller/grey.
 * Uses FlatList with snapToInterval for native scroll feel.
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Platform } from 'react-native';
import { useColors } from '@/hooks/use-colors';

const ITEM_HEIGHT = 80;
const VISIBLE_ITEMS = 3; // show 1 above, selected, 1 below
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

// Generate arrays
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

interface WheelColumnProps {
  data: number[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
}

function WheelColumn({ data, selectedIndex, onIndexChange }: WheelColumnProps) {
  const colors = useColors();
  const flatListRef = useRef<FlatList>(null);
  const [isScrolling, setIsScrolling] = useState(false);

  // Scroll to initial position on mount
  useEffect(() => {
    if (flatListRef.current && !isScrolling) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: selectedIndex * ITEM_HEIGHT,
          animated: false,
        });
      }, 50);
    }
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (event: any) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
      if (clampedIndex !== selectedIndex) {
        onIndexChange(clampedIndex);
      }
      setIsScrolling(false);
    },
    [data.length, selectedIndex, onIndexChange],
  );

  const handleScrollBeginDrag = useCallback(() => {
    setIsScrolling(true);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: number; index: number }) => {
      const isSelected = index === selectedIndex;
      const distance = Math.abs(index - selectedIndex);

      let opacity = 0.25;
      let fontSize = 32;
      let fontWeight: '400' | '700' = '400';

      if (isSelected) {
        opacity = 1;
        fontSize = 56;
        fontWeight = '700';
      } else if (distance === 1) {
        opacity = 0.35;
        fontSize = 36;
        fontWeight = '400';
      }

      return (
        <View style={[styles.item, { height: ITEM_HEIGHT }]}>
          <Text
            style={{
              fontSize,
              fontWeight,
              color: colors.foreground,
              opacity,
            }}
          >
            {pad(item)}
          </Text>
        </View>
      );
    },
    [selectedIndex, colors.foreground],
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  return (
    <View style={[styles.columnContainer, { height: PICKER_HEIGHT }]}>
      <FlatList
        ref={flatListRef}
        data={data}
        keyExtractor={(item) => String(item)}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollBeginDrag={handleScrollBeginDrag}
        contentContainerStyle={{
          paddingTop: ITEM_HEIGHT, // 1 empty slot above
          paddingBottom: ITEM_HEIGHT, // 1 empty slot below
        }}
        initialScrollIndex={selectedIndex > 0 ? selectedIndex : undefined}
        {...(Platform.OS === 'web' ? {} : { nestedScrollEnabled: true })}
      />
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface ScrollWheelTimePickerProps {
  /** Current value in "HH:MM" format. Defaults to "07:00" if not provided. */
  value?: string;
  /** Called when user scrolls to a new time */
  onChange: (time: string) => void;
}

export function ScrollWheelTimePicker({ value, onChange }: ScrollWheelTimePickerProps) {
  const colors = useColors();

  // Parse current value (default to 07:00 if undefined)
  const safeValue = value ?? '07:00';
  const parts = safeValue.split(':');
  const currentHour = parseInt(parts[0] ?? '7', 10) || 0;
  const currentMinute = parseInt(parts[1] ?? '0', 10) || 0;

  const handleHourChange = useCallback(
    (index: number) => {
      const newTime = `${pad(index)}:${pad(currentMinute)}`;
      onChange(newTime);
    },
    [currentMinute, onChange],
  );

  const handleMinuteChange = useCallback(
    (index: number) => {
      const newTime = `${pad(currentHour)}:${pad(index)}`;
      onChange(newTime);
    },
    [currentHour, onChange],
  );

  return (
    <View style={styles.container}>
      <WheelColumn
        data={HOURS}
        selectedIndex={currentHour}
        onIndexChange={handleHourChange}
      />
      <View style={styles.separatorContainer}>
        <Text
          style={[
            styles.separator,
            { color: colors.foreground },
          ]}
        >
          :
        </Text>
      </View>
      <WheelColumn
        data={MINUTES}
        selectedIndex={currentMinute}
        onIndexChange={handleMinuteChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnContainer: {
    width: 100,
    overflow: 'hidden',
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  separatorContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    fontSize: 48,
    fontWeight: '600',
  },
});
