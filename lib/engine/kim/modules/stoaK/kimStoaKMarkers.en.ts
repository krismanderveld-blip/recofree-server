/**
 * STOA-K EN Markers — English marker patterns for stoic reflective framework detection
 */

export const EN_STOA_K_CONTROL_DISTINCTION: RegExp[] = [
  /\bi cannot change (?:him|her)\b/i,
  /\bi cannot control (?:his|her) (?:behavior|behaviour|recovery)\b/i,
  /\bwhat can i (?:actually\s+)?(?:still\s+)?do\b/i,
  /\bwhat is (?:still\s+)?mine\b/i,
  /\bwhat is my responsibility\b/i,
  /\bwhat is not my responsibility\b/i,
  /\bwhat can i influence\b/i,
  /\bwhat can i not influence\b/i,
];

export const EN_STOA_K_CONTROL_LOOP: RegExp[] = [
  /\bi keep (?:trying to\s+)?control(?:ling)? (?:him|her)\b/i,
  /\bi keep managing everything\b/i,
  /\bi keep taking over\b/i,
  /\bi keep steering\b/i,
  /\bi try to steer (?:his|her) choices\b/i,
  /\bi cannot let go of control\b/i,
  /\bi know i cannot save (?:him|her) but i keep trying\b/i,
];

export const EN_STOA_K_LETTING_GO: RegExp[] = [
  /\bhow do i let go\b/i,
  /\bhow do i let (?:him|her) go without (?:abandoning|leaving) (?:him|her)\b/i,
  /\bletting go feels like giving (?:him|her) up\b/i,
  /\bacceptance feels like giving up\b/i,
  /\bi want to stay involved without losing myself\b/i,
  /\bi want to care without rescuing\b/i,
];

export const EN_STOA_K_VALUES: RegExp[] = [
  /\bwhat are my values (?:here|in this)\b/i,
  /\bhow do i stay true to myself\b/i,
  /\bwhat kind of (?:partner|parent) do i want to be\b/i,
  /\bwhat is my compass\b/i,
  /\bwhat do i want to act from\b/i,
  /\bhow do i act from my values\b/i,
  /\bi want to stay calm without becoming cold\b/i,
];

export const EN_STOA_K_ACCEPTANCE: RegExp[] = [
  /\bhow do i accept what i cannot change\b/i,
  /\bhow do i accept (?:this|it) without approving (?:it|of it)\b/i,
  /\bacceptance feels like indifference\b/i,
  /\bi do not want to become indifferent\b/i,
  /\bi want peace without pushing my feelings away\b/i,
  /\bi do not want to become hard\b/i,
  /\bi want to stay involved without control\b/i,
];

export const EN_STOA_K_BOUNDARY_CONTROL: RegExp[] = [
  /\ba boundary is something i do\b/i,
  /\bboundaries without control\b/i,
  /\bwhat is my boundary\b/i,
  /\bwhich boundary (?:helps|fits) me\b/i,
];

export const EN_STOA_K_RESPONSIBILITY: RegExp[] = [
  /\bwhat is my responsibility and what is not\b/i,
  /\bwhere does my responsibility end\b/i,
  /\bi am not responsible for (?:his|her) (?:recovery|choices|behavior)\b/i,
  /\bseparate responsibility\b/i,
];

export const EN_STOA_K_DEEPER_REFLECTION: RegExp[] = [
  /\bstoic(?:ally)? (?:look|think|reflect)\b/i,
  /\bthink deeper about (?:control|letting go|values)\b/i,
  /\bhow do i live with what i cannot control\b/i,
  /\bwhat can i control and what (?:can i\s+)?not\b/i,
];

export const EN_STOA_K_FAST_GROUNDING: RegExp[] = [
  /\bgive me (?:something\s+)?(?:stoic|quick) (?:to calm|to ground)\b/i,
  /\bi need something (?:quick\s+)?(?:stoic\s+)?to calm (?:me\s+)?down\b/i,
  /\bquick (?:grounding|calming)\b/i,
];
