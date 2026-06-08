export const themeColors: {
  primary: { light: string; dark: string };
  primarySoft: { light: string; dark: string };
  primaryDeep: { light: string; dark: string };
  secondary: { light: string; dark: string };
  secondarySoft: { light: string; dark: string };
  background: { light: string; dark: string };
  backgroundWarm: { light: string; dark: string };
  surface: { light: string; dark: string };
  surfaceBlue: { light: string; dark: string };
  surfaceKim: { light: string; dark: string };
  foreground: { light: string; dark: string };
  textSecondary: { light: string; dark: string };
  textTertiary: { light: string; dark: string };
  muted: { light: string; dark: string };
  border: { light: string; dark: string };
  borderSoft: { light: string; dark: string };
  eliasAccent: { light: string; dark: string };
  eliasAccentSoft: { light: string; dark: string };
  eliasAccentDeep: { light: string; dark: string };
  kimAccent: { light: string; dark: string };
  kimAccentSoft: { light: string; dark: string };
  kimAccentDeep: { light: string; dark: string };
  moodGreen: { light: string; dark: string };
  moodGreenSoft: { light: string; dark: string };
  moodYellow: { light: string; dark: string };
  moodYellowSoft: { light: string; dark: string };
  moodOrange: { light: string; dark: string };
  moodOrangeSoft: { light: string; dark: string };
  moodRed: { light: string; dark: string };
  moodRedSoft: { light: string; dark: string };
  success: { light: string; dark: string };
  successSoft: { light: string; dark: string };
  warning: { light: string; dark: string };
  warningSoft: { light: string; dark: string };
  error: { light: string; dark: string };
  dangerSoft: { light: string; dark: string };
  diaryAccent: { light: string; dark: string };
  diaryAccentSoft: { light: string; dark: string };
  backpackAccent: { light: string; dark: string };
  backpackAccentSoft: { light: string; dark: string };
};

declare const themeConfig: {
  themeColors: typeof themeColors;
};

export default themeConfig;
