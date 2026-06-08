/**
 * RecoFree Design System Constants
 * "Rust & Herstel" theme — Saliegroen + Petrolblauw
 * Rustgevend • Veilig • Herstelgericht • Betrouwbaar
 */

export const colors = {
  primary: "#1F4E5F",
  primarySoft: "#E8F0F2",
  primaryMuted: "#4A8A9A",
  primaryDeep: "#163B49",

  secondary: "#A8C3A0",
  secondarySoft: "#EFF5ED",
  secondaryMuted: "#C4D9BE",
  secondaryDeep: "#4F6F52",

  background: "#F7F5F0",
  backgroundWarm: "#F7F5F0",
  backgroundSoftBlue: "#EFF5ED",
  backgroundSoftAmber: "#F7F5F0",

  surface: "#FFFFFF",
  surfaceWarm: "#F7F5F0",
  surfaceBlue: "#EFF5ED",
  surfaceKim: "#F7F5F0",

  textPrimary: "#2E2E2E",
  textSecondary: "#4F6F52",
  textTertiary: "#6B7B6E",
  textMuted: "#6B7B6E",
  textInverse: "#FFFFFF",

  border: "#EAEAEA",
  borderSoft: "#EAEAEA",
  divider: "#EAEAEA",

  eliasAccent: "#1F4E5F",
  eliasAccentSoft: "#E8F0F2",
  eliasAccentMuted: "#A3C4CC",
  eliasAccentDeep: "#163B49",

  kimAccent: "#4F6F52",
  kimAccentSoft: "#EFF5ED",
  kimAccentMuted: "#C4D9BE",
  kimAccentDeep: "#3A5A3D",

  diaryAccent: "#4F6F52",
  diaryAccentSoft: "#EFF5ED",

  backpackAccent: "#1F4E5F",
  backpackAccentSoft: "#E8F0F2",

  moodGreen: "#6B9E63",
  moodGreenSoft: "#EFF5ED",
  sliderTrack: "#C4C2BD",
  moodYellow: "#B89B3E",
  moodYellowSoft: "#F8F3E0",
  moodOrange: "#C4885A",
  moodOrangeSoft: "#F8EDE0",
  moodRed: "#B85C5C",
  moodRedSoft: "#F5E8E8",
  moodBlue: "#4A8A9A",
  moodBlueSoft: "#E8F0F2",

  success: "#4F6F52",
  successSoft: "#EFF5ED",
  warning: "#C4885A",
  warningSoft: "#F8EDE0",
  danger: "#B85C5C",
  dangerSoft: "#F5E8E8",
  info: "#1F4E5F",
  infoSoft: "#E8F0F2",

  shadow: "#2E2E2E",
  overlay: "rgba(46, 46, 46, 0.34)",
  transparent: "transparent",
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  screenHorizontal: 20,
  screenTop: 24,
  screenBottom: 28,
  cardPadding: 20,
  sectionGap: 24,
  cardGap: 16,
  inputPadding: 16,
  tabBarPadding: 10,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 34,
  pill: 999,
} as const;

export const shadows = {
  none: {
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  soft: {
    shadowColor: "#2E2E2E",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  medium: {
    shadowColor: "#2E2E2E",
    shadowOpacity: 0.09,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  floating: {
    shadowColor: "#2E2E2E",
    shadowOpacity: 0.12,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
} as const;

export const typography = {
  displayLarge: { fontSize: 34, lineHeight: 42, fontWeight: "700" as const },
  displayMedium: { fontSize: 30, lineHeight: 38, fontWeight: "700" as const },
  titleLarge: { fontSize: 26, lineHeight: 34, fontWeight: "700" as const },
  titleMedium: { fontSize: 22, lineHeight: 30, fontWeight: "600" as const },
  titleSmall: { fontSize: 20, lineHeight: 28, fontWeight: "600" as const },
  bodyLarge: { fontSize: 18, lineHeight: 28, fontWeight: "400" as const },
  bodyMedium: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  bodySmall: { fontSize: 14, lineHeight: 21, fontWeight: "400" as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" as const },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
  button: { fontSize: 16, lineHeight: 22, fontWeight: "600" as const },
  chat: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
} as const;

export const cardStyles = {
  default: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadows.soft,
  },
  large: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    shadowColor: "#2E2E2E",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  elias: {
    backgroundColor: colors.eliasAccentSoft,
    borderRadius: radius.xl,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.eliasAccentMuted,
  },
  kim: {
    backgroundColor: colors.kimAccentSoft,
    borderRadius: radius.xl,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.kimAccentMuted,
  },
} as const;

export const buttonStyles = {
  primaryElias: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.eliasAccent,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: colors.eliasAccent,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  primaryKim: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.kimAccent,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: colors.kimAccent,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  secondary: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  ghost: {
    minHeight: 48,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "transparent",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
} as const;

export const chatBubbleStyles = {
  elias: {
    alignSelf: "flex-start" as const,
    maxWidth: "84%" as unknown as number,
    backgroundColor: colors.eliasAccentSoft,
    borderColor: colors.eliasAccentMuted,
    borderWidth: 1,
    borderRadius: radius.lg,
    borderTopLeftRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  kim: {
    alignSelf: "flex-start" as const,
    maxWidth: "84%" as unknown as number,
    backgroundColor: colors.kimAccentSoft,
    borderColor: colors.kimAccentMuted,
    borderWidth: 1,
    borderRadius: radius.lg,
    borderTopLeftRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  user: {
    alignSelf: "flex-end" as const,
    maxWidth: "84%" as unknown as number,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    borderTopRightRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: colors.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  system: {
    alignSelf: "center" as const,
    maxWidth: "92%" as unknown as number,
    backgroundColor: colors.dangerSoft,
    borderColor: "#D4A0A0",
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
} as const;

export const moodSliderStyle = {
  trackHeight: 14,
  trackBorderRadius: 999,
  thumbSize: 34,
  thumbBorderWidth: 4,
  thumbBorderColor: colors.surface,
  thumbShadow: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  valueBubble: {
    width: 52,
    height: 32,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
} as const;

export const tabBarStyle = {
  position: "absolute" as const,
  left: 16,
  right: 16,
  bottom: 16,
  height: 76,
  backgroundColor: colors.surface,
  borderRadius: radius.xl,
  borderWidth: 1,
  borderColor: colors.borderSoft,
  paddingHorizontal: 10,
  paddingVertical: 8,
  ...shadows.floating,
} as const;

export const vspCardStyles = {
  base: {
    minHeight: 74,
    borderRadius: radius.xl,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  activeGreen: {
    backgroundColor: colors.moodGreenSoft,
    borderColor: colors.moodGreen,
    borderWidth: 2,
  },
  activeYellow: {
    backgroundColor: colors.moodYellowSoft,
    borderColor: colors.moodYellow,
    borderWidth: 2,
  },
  activeOrange: {
    backgroundColor: colors.moodOrangeSoft,
    borderColor: colors.moodOrange,
    borderWidth: 2,
  },
  activeRed: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderWidth: 2,
  },
} as const;

export const chipStyles = {
  base: {
    minHeight: 38,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeElias: {
    backgroundColor: colors.eliasAccentSoft,
    borderColor: colors.eliasAccentMuted,
  },
  activeKim: {
    backgroundColor: colors.kimAccentSoft,
    borderColor: colors.kimAccentMuted,
  },
} as const;

export const layout = {
  maxContentWidth: 640,
  minTouchTarget: 48,
  cardMinHeight: 92,
  headerHeight: 72,
  tabBarHeight: 76,
  bottomSafePadding: 20,
} as const;
