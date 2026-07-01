import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "bubble.left.fill": "chat-bubble",
  "chart.bar.fill": "bar-chart",
  "book.fill": "menu-book",
  "person.fill": "person",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "exclamationmark.triangle.fill": "warning",
  "heart.fill": "favorite",
  "plus.circle.fill": "add-circle",
  "xmark.circle.fill": "cancel",
  "checkmark.circle.fill": "check-circle",
  "gear": "settings",
  "backpack.fill": "backpack",
  "stop.circle.fill": "stop-circle",
  "arrow.left": "arrow-back",
  "phone.fill": "phone",
  "clock.fill": "access-time",
  "moon.fill": "nightlight-round",
  "list.bullet": "format-list-bulleted",
  "checkmark": "check",
  "bell.fill": "notifications",
  "bell.slash.fill": "notifications-off",
  "pencil": "edit",
  "calendar": "calendar-today",
  "doc.on.doc.fill": "content-copy",
  "arrow.counterclockwise": "replay",
  "line.3.horizontal": "drag-handle",
  "arrow.up": "arrow-upward",
  "arrow.down": "arrow-downward",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
