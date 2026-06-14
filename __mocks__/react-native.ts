// Mock for react-native in vitest (avoids Flow syntax parse error)
export const Platform = { OS: "web", select: (obj: any) => obj.web || obj.default };
export const StyleSheet = { create: (styles: any) => styles };
export const View = "View";
export const Text = "Text";
export const ScrollView = "ScrollView";
export const TouchableOpacity = "TouchableOpacity";
export const Pressable = "Pressable";
export const FlatList = "FlatList";
export const TextInput = "TextInput";
export const Image = "Image";
export const Alert = { alert: () => {} };
export const Dimensions = { get: () => ({ width: 375, height: 812 }) };
export const Animated = { View, Text, createAnimatedComponent: (c: any) => c, Value: class { constructor() {} } };
export const Keyboard = { dismiss: () => {}, addListener: () => ({ remove: () => {} }) };
export const AppState = { currentState: "active", addEventListener: () => ({ remove: () => {} }) };
export default { Platform, StyleSheet, View, Text };
