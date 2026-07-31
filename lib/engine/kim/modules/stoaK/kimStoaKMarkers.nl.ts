/**
 * STOA-K NL Markers — Dutch marker patterns for stoic reflective framework detection
 */

export const NL_STOA_K_CONTROL_DISTINCTION: RegExp[] = [
  /\bik kan (?:hem|haar) niet veranderen\b/i,
  /\bik kan (?:zijn|haar) (?:gedrag|herstel|verslaving) niet controleren\b/i,
  /\bwat kan ik (?:eigenlijk\s+)?(?:nog|wel) doen\b/i,
  /\bwat is (?:nog\s+)?(?:van mij|mijn verantwoordelijkheid)\b/i,
  /\bwat is niet mijn verantwoordelijkheid\b/i,
  /\bwat kan ik (?:wel\s+)?be[ïi]nvloeden\b/i,
  /\bwat kan ik niet be[ïi]nvloeden\b/i,
  /\bwat is nog van mij\b/i,
  /\bwat ligt (?:nog\s+)?in mijn handen\b/i,
];

export const NL_STOA_K_CONTROL_LOOP: RegExp[] = [
  /\bik blijf (?:proberen\s+)?(?:hem|haar) te controleren\b/i,
  /\bik blijf alles (?:regelen|overnemen)\b/i,
  /\bik blijf sturen\b/i,
  /\bik probeer (?:zijn|haar) keuzes te sturen\b/i,
  /\bik kan (?:het\s+)?controleren niet loslaten\b/i,
  /\bik weet dat ik (?:hem|haar) niet kan redden maar ik blijf (?:het\s+)?proberen\b/i,
  /\bik blijf (?:proberen\s+)?alles te controleren\b/i,
];

export const NL_STOA_K_LETTING_GO: RegExp[] = [
  /\bhoe laat ik (?:los|(?:hem|haar) los)\b/i,
  /\bhoe laat ik (?:hem|haar) los zonder (?:hem|haar) te laten vallen\b/i,
  /\bloslaten voelt (?:alsof|als) (?:ik\s+)?(?:hem|haar) opgeef\b/i,
  /\baanvaarden voelt (?:als|alsof) opgeven\b/i,
  /\bik wil betrokken blijven zonder mezelf kwijt te raken\b/i,
  /\bik wil zorgen zonder te redden\b/i,
  /\bloslaten (?:zonder|maar niet) (?:laten vallen|opgeven)\b/i,
];

export const NL_STOA_K_VALUES: RegExp[] = [
  /\bwat zijn mijn waarden\b/i,
  /\bhoe blijf ik trouw aan mezelf\b/i,
  /\bwat voor (?:partner|ouder|moeder|vader) wil ik zijn\b/i,
  /\bwat is mijn kompas\b/i,
  /\bwaar wil ik naar handelen\b/i,
  /\bhoe handel ik vanuit mijn waarden\b/i,
  /\bik wil rustig blijven zonder koud te worden\b/i,
  /\bvanuit welke waarde\b/i,
];

export const NL_STOA_K_ACCEPTANCE: RegExp[] = [
  /\bhoe accepteer ik wat ik niet kan veranderen\b/i,
  /\bhoe aanvaard ik (?:dit|het) zonder (?:het\s+)?goed te praten\b/i,
  /\baanvaarding voelt (?:als|alsof) onverschilligheid\b/i,
  /\bik wil niet onverschillig worden\b/i,
  /\bik wil rust zonder mijn gevoelens weg te duwen\b/i,
  /\bik wil niet harder worden\b/i,
  /\bik wil betrokken blijven zonder controle\b/i,
  /\baccepteren zonder goedkeuren\b/i,
  /\baanvaarden zonder goedpraten\b/i,
];

export const NL_STOA_K_BOUNDARY_CONTROL: RegExp[] = [
  /\been grens (?:is\s+)?(?:iets\s+)?(?:wat|dat) (?:ik|van mij)\b/i,
  /\bgrenzen zonder controle\b/i,
  /\bgrenzen zonder (?:hem|haar) te sturen\b/i,
  /\bwat is mijn grens\b/i,
  /\bwelke grens (?:helpt|past bij) mij\b/i,
];

export const NL_STOA_K_RESPONSIBILITY: RegExp[] = [
  /\bwat is mijn verantwoordelijkheid en wat niet\b/i,
  /\bwaar houdt mijn verantwoordelijkheid op\b/i,
  /\bik ben niet verantwoordelijk voor (?:zijn|haar) (?:herstel|keuzes|gedrag)\b/i,
  /\bverantwoordelijkheid scheiden\b/i,
];

export const NL_STOA_K_DEEPER_REFLECTION: RegExp[] = [
  /\bstoicijns (?:leren\s+)?kijken\b/i,
  /\bdieper nadenken over (?:controle|loslaten|waarden)\b/i,
  /\bhoe leef ik met wat ik niet kan controleren\b/i,
  /\bwat kan ik controleren en wat niet\b/i,
];

export const NL_STOA_K_FAST_GROUNDING: RegExp[] = [
  /\bgeef me (?:snel\s+)?iets (?:stoicijns|om te kalmeren)\b/i,
  /\bik heb nu (?:snel\s+)?iets nodig om te kalmeren\b/i,
  /\bsnel (?:grounding|kalmeren|tot rust)\b/i,
];
