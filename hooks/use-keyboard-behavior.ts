import { useEffect, useState } from "react";
import { Keyboard, type KeyboardAvoidingViewProps, Platform } from "react-native";

/**
 * Dynamic keyboard behavior hook.
 * Sets behavior to "height" (Android) or "padding" (iOS) when keyboard is visible,
 * and undefined when hidden. This prevents black space issues with edge-to-edge display.
 */
export function useKeyboardBehavior() {
  const defaultValue: KeyboardAvoidingViewProps["behavior"] =
    Platform.OS === "ios" ? "padding" : "height";
  const [behaviour, setBehaviour] =
    useState<KeyboardAvoidingViewProps["behavior"]>(defaultValue);

  useEffect(() => {
    const showListener = Keyboard.addListener("keyboardDidShow", () => {
      setBehaviour(defaultValue);
    });
    const hideListener = Keyboard.addListener("keyboardDidHide", () => {
      setBehaviour(undefined);
    });
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  return behaviour;
}
