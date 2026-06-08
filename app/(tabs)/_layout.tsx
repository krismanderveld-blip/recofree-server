import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { AnimatedTabIcon } from "@/components/animated-tab-icon";
import { Platform } from "react-native";
import { colors as dc, radius, shadows } from "@/constants/design";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 12);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: dc.primary,
        tabBarInactiveTintColor: dc.textTertiary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: bottomPadding,
          height: 68,
          backgroundColor: dc.surface,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: dc.borderSoft,
          borderTopWidth: 1,
          borderTopColor: dc.borderSoft,
          paddingHorizontal: 8,
          paddingTop: 10,
          paddingBottom: 10,
          ...shadows.floating,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon name="house.fill" color={color} size={24} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="mood"
        options={{
          title: "Mood",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon name="chart.bar.fill" color={color} size={24} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: "Diary",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon name="book.fill" color={color} size={24} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="backpack"
        options={{
          title: "Backpack",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon name="backpack.fill" color={color} size={24} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon name="bubble.left.fill" color={color} size={24} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon name="person.fill" color={color} size={24} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
