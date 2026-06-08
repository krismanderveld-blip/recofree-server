import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { SymbolViewProps } from "expo-symbols";

interface AnimatedTabIconProps {
  name: SymbolViewProps["name"];
  color: string;
  size?: number;
  focused: boolean;
}

/**
 * Animated tab bar icon with subtle scale + opacity transition on focus change.
 * Uses react-native-reanimated for smooth 60fps animations.
 */
export function AnimatedTabIcon({ name, color, size = 24, focused }: AnimatedTabIconProps) {
  const scale = useSharedValue(focused ? 1 : 0.85);
  const opacity = useSharedValue(focused ? 1 : 0.6);

  useEffect(() => {
    scale.value = withTiming(focused ? 1 : 0.85, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(focused ? 1 : 0.6, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [focused, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <IconSymbol size={size} name={name} color={color} />
    </Animated.View>
  );
}
