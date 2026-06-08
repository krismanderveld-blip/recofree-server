import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { colors as dc, radius, shadows } from "@/constants/design";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 68 + bottomPadding;

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
          bottom: Platform.OS === "web" ? 12 : Math.max(insets.bottom, 12),
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
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="mood"
        options={{
          title: "Mood",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: "Diary",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="book.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="backpack"
        options={{
          title: "Backpack",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="backpack.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="bubble.left.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
