/**
 * RecoFree Design System Constants
 * Full design token set for the therapeutic recovery app.
 * Reference: RECOFREE_DESIGN_SPEC_MANUS_READY_V1
 */

export const colors = {
  primary: "#2196F3",
  primarySoft: "#E7F3FE",
  primaryMuted: "#8EC9F7",
  primaryDeep: "#1565C0",

  secondary: "#7FB9B3",
  secondarySoft: "#EAF6F4",
  secondaryMuted: "#B7DCD8",
  secondaryDeep: "#4F8F89",

  background: "#FAFBFC",
  backgroundWarm: "#FFFDF9",
  backgroundSoftBlue: "#F5FAFF",
  backgroundSoftAmber: "#FFF8ED",

  surface: "#FFFFFF",
  surfaceWarm: "#FFFDF8",
  surfaceBlue: "#F7FBFF",
  surfaceKim: "#FFF7EC",

  textPrimary: "#1F2933",
  textSecondary: "#52616B",
  textTertiary: "#7B8794",
  textMuted: "#9AA5B1",
  textInverse: "#FFFFFF",

  border: "#E6ECF1",
  borderSoft: "#EEF3F7",
  divider: "#EDF2F6",

  eliasAccent: "#2196F3",
  eliasAccentSoft: "#E7F3FE",
  eliasAccentMuted: "#B9DDFB",
  eliasAccentDeep: "#1565C0",

  kimAccent: "#F2A65A",
  kimAccentSoft: "#FFF1DF",
  kimAccentMuted: "#F8D2A8",
  kimAccentDeep: "#B96E1E",

  diaryAccent: "#9B8FE8",
  diaryAccentSoft: "#F0EEFF",

  backpackAccent: "#7FB9B3",
  backpackAccentSoft: "#EAF6F4",

  moodGreen: "#7BCFA6",
  moodGreenSoft: "#EAF8F1",
  moodYellow: "#F4D35E",
  moodYellowSoft: "#FFF8D7",
  moodOrange: "#F2A65A",
  moodOrangeSoft: "#FFF1DF",
  moodRed: "#E57373",
  moodRedSoft: "#FDECEC",
  moodBlue: "#8EC9F7",
  moodBlueSoft: "#E7F3FE",

  success: "#62B58F",
  successSoft: "#EAF8F1",
  warning: "#E6B84F",
  warningSoft: "#FFF7DA",
  danger: "#D96A6A",
  dangerSoft: "#FDECEC",
  info: "#2196F3",
  infoSoft: "#E7F3FE",

  shadow: "#1F2933",
  overlay: "rgba(31, 41, 51, 0.34)",
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
    shadowColor: "#1F2933",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  medium: {
    shadowColor: "#1F2933",
    shadowOpacity: 0.09,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  floating: {
    shadowColor: "#1F2933",
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
    shadowColor: "#1F2933",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  elias: {
    backgroundColor: colors.surfaceBlue,
    borderRadius: radius.xl,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: "#DCEEFE",
  },
  kim: {
    backgroundColor: colors.surfaceKim,
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
    borderColor: "#DCEEFE",
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
    borderColor: "#F3B8B8",
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
