/**
 * Short Module Detector — Keyword-based routing for M05-M85.
 *
 * Architecture (international, no LLM call):
 * 1. Tokenize user input → lowercase words
 * 2. Translate common Dutch/German/French/Spanish words to English concepts via TRANSLATION_MAP
 * 3. Match translated concepts against MODULE_KEYWORDS (English-only)
 * 4. Module with highest score wins (threshold = 1)
 *
 * This runs BEFORE GPT — it's a fast heuristic, not a semantic classifier.
 * The GPT model itself will do the final clinical annotation.
 */

// ─── TRANSLATION MAP: Common non-English words → English concept words ───
// Allows the detector to work for international users without an LLM call.
const TRANSLATION_MAP: Record<string, string[]> = {
  // ── Dutch → English ──
  eenzaam: ['lonely', 'loneliness'],
  eenzaamheid: ['loneliness'],
  alleen: ['alone', 'lonely'],
  isolatie: ['isolation', 'self-protection', 'retreat'],
  isoleer: ['isolation', 'self-protection', 'retreat'],
  geïsoleerd: ['isolated', 'isolation'],
  afgezonderd: ['isolated', 'retreat'],
  niemand: ['nobody'],
  verbinding: ['connection'],
  contact: ['connection'],
  vertrouwen: ['trust', 'trust-broken'],
  vertrouwensbreuk: ['trust', 'rupture', 'betrayal'],
  wantrouwen: ['distrust', 'mistrust'],
  breuk: ['rupture', 'break'],
  gebroken: ['broken'],
  verraden: ['betrayed', 'betrayal'],
  verraad: ['betrayal'],
  paniek: ['panic'],
  paniekaanval: ['panic', 'attack'],
  angst: ['fear', 'anxiety'],
  bang: ['afraid', 'fear'],
  angstig: ['anxious', 'fear'],
  nabijheid: ['closeness', 'proximity'],
  dichtbij: ['close', 'closeness'],
  intimiteit: ['intimacy'],
  intiem: ['intimate', 'intimacy'],
  hechting: ['attachment'],
  gehecht: ['attached', 'attachment'],
  slaap: ['sleep', 'insomnia', 'cant-sleep'],
  slapen: ['sleep', 'cant-sleep'],
  wakker: ['awake', 'sleep', 'awake-at-night', 'insomnia'],
  insomnie: ['insomnia', 'sleep'],
  nacht: ['night', 'sleep'],
  slapeloosheid: ['insomnia', 'sleep', 'cant-sleep'],
  nachtmerrie: ['nightmare', 'sleep'],
  moe: ['tired', 'fatigue', 'exhausted', 'fatigue-relapse'],
  vermoeid: ['tired', 'fatigue'],
  uitgeput: ['exhausted', 'exhaustion'],
  druk: ['pressure'],
  prestatiedruk: ['pressure', 'performance'],
  perfectionisme: ['perfectionism'],
  perfect: ['perfectionism', 'perfect'],
  falen: ['failure', 'fail'],
  gefaald: ['failed', 'failure'],
  mislukt: ['failed', 'failure'],
  mislukking: ['failure'],
  zelfkritiek: ['self-criticism'],
  rouw: ['grief', 'mourning'],
  verdriet: ['grief', 'sadness'],
  verlies: ['loss'],
  verloren: ['lost', 'loss'],
  dood: ['death', 'suicidal'],
  overlijden: ['death', 'loss'],
  ouder: ['parent'],
  moeder: ['mother', 'parent'],
  vader: ['father', 'parent'],
  overbelast: ['overloaded', 'overwhelmed'],
  overweldigd: ['overwhelmed'],
  overspoeld: ['overwhelmed'],
  ontploffen: ['explode', 'explosion'],
  ontploft: ['explode', 'explosion'],
  uitbarsting: ['outburst', 'explosion'],
  trauma: ['trauma'],
  traumatisch: ['traumatic', 'trauma'],
  kindertijd: ['childhood'],
  vroeger: ['childhood', 'past'],
  opgegroeid: ['childhood', 'upbringing'],
  kind: ['child', 'childhood'],
  afwijzing: ['rejection'],
  afgewezen: ['rejected', 'rejection'],
  schaamte: ['shame'],
  schaam: ['shame'],
  schamen: ['shame'],
  walging: ['disgust'],
  zelfwalging: ['self-disgust', 'shame'],
  waardeloos: ['worthless', 'worthlessness'],
  nutteloos: ['worthless', 'useless'],
  verlating: ['abandonment'],
  verlaten: ['abandoned', 'abandonment'],
  achterlaten: ['abandoned'],
  onzichtbaar: ['invisible', 'invisibility'],
  buitenstaander: ['outsider'],
  erbij: ['belonging'],
  horen: ['belonging'],
  begrepen: ['understood', 'misunderstood'],
  begrijpt: ['understood', 'misunderstood'],
  misbegrepen: ['misunderstood'],
  controle: ['control'],
  overcontrole: ['overcontrol', 'control'],
  grip: ['control', 'grip'],
  instabiel: ['unstable', 'instability'],
  instabiliteit: ['instability'],
  wisselend: ['unstable', 'fluctuating'],
  woede: ['anger', 'rage'],
  boos: ['angry', 'anger'],
  kwaad: ['angry', 'anger'],
  razend: ['furious', 'rage'],
  confrontatie: ['confrontation'],
  schuld: ['guilt', 'blame-shifting', 'darvo'],
  schuldig: ['guilty', 'guilt'],
  schuldgevoel: ['guilt'],
  medicatie: ['medication', 'self-medication'],
  middelen: ['substances', 'self-medication'],
  alcohol: ['alcohol', 'substances', 'self-medication'],
  drugs: ['drugs', 'substances', 'self-medication'],
  cannabis: ['cannabis', 'substances'],
  benzo: ['benzodiazepines', 'substances'],
  pillen: ['pills', 'substances'],
  verdoving: ['numbing', 'self-medication', 'switch-off'],
  verdoven: ['numbing', 'numb', 'switch-off', 'feel-nothing', 'self-medication'],
  verdoofd: ['numb', 'numbing', 'body-shock'],
  terugval: ['relapse'],
  hervallen: ['relapse'],
  craving: ['craving'],
  trek: ['craving'],
  zucht: ['craving', 'urge'],
  drang: ['urge', 'craving'],
  verlangen: ['craving', 'longing'],
  verantwoordelijk: ['responsible', 'responsibility'],
  verantwoordelijkheid: ['responsibility'],
  zorgen: ['caring', 'worry', 'responsibility'],
  ambivalent: ['ambivalent', 'ambivalence', 'conflicted', 'torn'],
  twijfel: ['doubt', 'ambivalence', 'doubtful', 'mixed-feelings'],
  lichaam: ['body'],
  lichamelijk: ['physical', 'body'],
  identiteit: ['identity'],
  parentificatie: ['parentification', 'role-reversal', 'caretaker-child'],
  financieel: ['financial', 'financial-control', 'financial-dependency', 'money-as-power'],
  geld: ['money', 'financial'],
  schulden: ['debt', 'financial', 'hidden-debt', 'financial-shame', 'money-manipulation'],
  dissociatie: ['dissociation'],
  afwezig: ['absent', 'dissociation'],
  pijn: ['pain'],
  afhankelijk: ['dependent', 'dependency', 'codependency', 'financial-dependency', 'economic-abuse', 'financial-isolation'],
  afhankelijkheid: ['dependency'],
  medeafhankelijk: ['codependent', 'codependency'],
  existentieel: ['existential'],
  zinloos: ['meaningless', 'pointless'],
  betekenisloos: ['meaningless'],
  nostalgie: ['nostalgia'],
  gevoelloos: ['numb', 'numbing'],
  leegte: ['emptiness', 'void'],
  leeg: ['empty', 'emptiness'],
  grens: ['boundary'],
  grenzen: ['boundaries', 'boundary'],
  grensoverschrijding: ['boundary-violation', 'violation', 'deserved', 'inevitable'],
  kwetsbaar: ['vulnerable', 'vulnerability'],
  kwetsbaarheid: ['vulnerability'],
  waakzaam: ['vigilant', 'hypervigilance', 'night-vigilance'],
  alert: ['alert', 'hypervigilance'],
  hoede: ['guard', 'hypervigilance'],
  vermijden: ['avoidance', 'avoid'],
  vermijding: ['avoidance'],
  ontwijken: ['avoidance', 'avoid'],
  sabotage: ['sabotage'],
  saboteren: ['sabotage'],
  onrust: ['restlessness', 'unrest'],
  onrustig: ['restless'],
  verveling: ['boredom'],
  saai: ['bored', 'boredom'],
  jaloezie: ['jealousy'],
  jaloers: ['jealous', 'jealousy'],
  vergelijken: ['comparison', 'compare'],
  stilstand: ['stagnation'],
  vastgelopen: ['stuck', 'stagnation'],
  vast: ['stuck'],
  hulp: ['help'],
  hulpeloos: ['helpless', 'helplessness'],
  machteloos: ['powerless', 'powerlessness'],
  hopeloos: ['hopeless', 'hopelessness'],
  wanhoop: ['despair', 'hopelessness'],
  relatie: ['relationship', 'relation'],
  partner: ['partner', 'relationship'],
  masker: ['mask'],
  vrolijk: ['cheerful', 'mask'],
  lachen: ['laugh', 'mask'],
  humor: ['humor', 'mask'],
  symbiose: ['symbiosis'],
  zelfhaat: ['self-hatred', 'self-hate'],
  haat: ['hatred', 'hate'],
  minachting: ['contempt'],
  huilen: ['crying', 'tears'],
  afstand: ['distance'],
  terugtrekken: ['withdraw', 'distance'],
  afsluiten: ['shut-down', 'distance'],
  verwachting: ['expectation'],
  doorzien: ['seen-through', 'exposed'],
  ontmaskerd: ['exposed', 'unmasked'],
  kalmeren: ['calm', 'regulate'],
  reguleren: ['regulate', 'regulation'],
  maatschappij: ['society'],
  systeem: ['system', 'society'],
  veilig: ['safe', 'safety', 'safe-alone'],
  veiligheid: ['safety'],
  spiritueel: ['spiritual', 'spirituality'],
  geloof: ['faith', 'spirituality'],
  zin: ['meaning', 'purpose'],
  zingeving: ['meaning', 'purpose'],
  bestaansrecht: ['right-to-exist'],
  overbodig: ['superfluous', 'unnecessary'],
  hoofd: ['head', 'overthinking'],
  piekeren: ['rumination', 'overthinking'],
  nadenken: ['thinking', 'overthinking'],
  reflectie: ['reflection'],
  zelfreflectie: ['self-reflection', 'reflection'],
  spiegel: ['mirror', 'reflection'],
  gebruik: ['substance-use', 'using'],
  gebruiken: ['substance-use', 'using'],
  automatisch: ['automatic', 'autopilot'],
  automatisme: ['automatism', 'autopilot'],
  opnieuw: ['again', 'restart', 'rebuilding-trust'],
  beginnen: ['start', 'restart'],
  seksueel: ['sexual'],
  seks: ['sexual'],
  aanraking: ['touch', 'sexual'],
  drift: ['impulse', 'urge'],
  impulsief: ['impulsive', 'impulse'],
  bestaan: ['existence', 'exist'],
  volhouden: ['persevere', 'endure'],
  opgeven: ['give-up', 'quit'],
  stoppen: ['stop', 'quit', 'want-to-stop-but'],
  weigeren: ['refuse', 'rejection'],
  regressie: ['regression'],
  klein: ['small', 'regression'],
  scannen: ['scanning', 'hypervigilance'],
  vluchten: ['flee', 'escape'],
  vlucht: ['flee', 'escape'],
  fantaseren: ['fantasy', 'escape'],
  analyseren: ['analyzing', 'overthinking'],

  // ── German → English ──
  einsamkeit: ['loneliness'],
  einsam: ['lonely'],
  schlaf: ['sleep'],
  schlafen: ['sleep'],
  müde: ['tired', 'fatigue'],
  vertrauen: ['trust'],
  scham: ['shame'],
  wut: ['anger', 'rage'],
  trauer: ['grief', 'mourning'],
  verlust: ['loss'],
  kontrolle: ['control'],
  panik: ['panic'],
  rückfall: ['relapse'],
  sucht: ['addiction', 'craving'],
  beziehung: ['relationship'],
  grenze: ['boundary'],
  hilflos: ['helpless'],
  hoffnungslos: ['hopeless'],
  leer: ['empty', 'emptiness'],
  erschöpft: ['exhausted'],
  überwältigt: ['overwhelmed'],
  perfektionismus: ['perfectionism'],
  identität: ['identity'],
  vermeidung: ['avoidance'],
  dissoziation: ['dissociation'],
  einsamkeit2: ['loneliness'],

  // ── French → English ──
  solitude: ['loneliness'],
  seul: ['alone', 'lonely'],
  confiance: ['trust'],
  honte: ['shame'],
  culpabilité: ['guilt'],
  colère: ['anger'],
  deuil: ['grief', 'mourning'],
  perte: ['loss'],
  panique: ['panic'],
  sommeil: ['sleep'],
  fatigue: ['fatigue', 'tired'],
  contrôle: ['control'],
  abandon: ['abandonment'],
  rejet: ['rejection'],
  rechute: ['relapse'],
  relation: ['relationship'],
  limite: ['boundary'],
  vide: ['emptiness', 'void'],
  désespoir: ['despair', 'hopelessness'],
  perfectionnisme: ['perfectionism'],
  traumatisme: ['trauma'],
  dissociation: ['dissociation'],
  épuisé: ['exhausted'],

  // ── Spanish → English ──
  soledad: ['loneliness'],
  solo: ['alone'],
  confianza: ['trust'],
  vergüenza: ['shame'],
  culpa: ['guilt'],
  ira: ['anger'],
  duelo: ['grief'],
  pérdida: ['loss'],
  pánico: ['panic'],
  sueño: ['sleep'],
  cansancio: ['fatigue', 'tired'],
  abandono: ['abandonment'],
  rechazo: ['rejection'],
  recaída: ['relapse'],
  relación: ['relationship'],
  límite: ['boundary'],
  vacío: ['emptiness', 'void'],
  desesperación: ['despair', 'hopelessness'],
  perfeccionismo: ['perfectionism'],
  disociación: ['dissociation'],
  agotado: ['exhausted'],
  // ── Dutch: FALE01 (relapse/failure) ──
  teruggevallen: ['relapse', 'fell-back'],
  uitgegleden: ['slipped', 'lapse'],
  gedronken: ['drank-again', 'used-again'],
  gebruikt: ['used-again', 'using-again'],
  toegegeven: ['craving-gave-in', 'slipped'],
  // ── Dutch: VERG01 (forgiveness/guilt) ──
  vergeving: ['forgiveness', 'self-forgiveness'],
  vergeven: ['forgiveness', 'self-forgiveness', 'forgiveness-pressure'],
  zelfvergeving: ['self-forgiveness'],
  onvergeeflijk: ['unforgivable'],
  zelfbestraffing: ['self-punishment', 'self-blame'],
  straf: ['deserve-punishment', 'self-punishment'],
  // ── Dutch: ROUW01 (grief/loss) ──
  rouwen: ['grief', 'mourning'],
  kwijt: ['loss', 'lost-myself'],
  kwijtgeraakt: ['lost-myself', 'loss'],
  gemist: ['missed-moments'],
  afgepakt: ['taken-away'],
  // ── Dutch: IDEN01 (identity) ──
  verslaafde: ['just-an-addict'],
  patient: ['only-a-patient'],
  patiënt: ['only-a-patient'],
  // ── Dutch: ZINK01 (meaning/purpose) ──
  doel: ['purpose'],
  waarvoor: ['what-is-the-point', 'why-bother'],
  // ── Dutch: TERV01 (relapse analysis) ──
  terugvalanalyse: ['relapse-chain', 'relapse-analysis'],
  keten: ['the-chain', 'relapse-chain'],
  foutgelopen: ['what-went-wrong', 'how-it-went-wrong'],
  gebruikte: ['before-i-used'],
  // ── Dutch: MI02 (ambivalence/motivational interviewing) ──
  dubbel: ['ambivalent', 'torn'],
  klaar: ['not-ready-yet'],
  // ── Dutch: SLAAP01 (sleep and addiction recovery) ──
  nachtelijk: ['nighttime', 'night-craving'],
  vermoeidheid: ['fatigue-relapse'],
  slaapangst: ['sleep-anxiety'],
  nachtcraving: ['night-craving'],
  ontwenning: ['withdrawal-sleep'],

  slaapschuld: ['sleep-guilt'],
  slaaphygiene: ['sleep-hygiene'],
  // ── Dutch: BEDR01 (betrayal discovery acute shock) ──
  bedrogen: ['betrayed', 'betrayal-discovery', 'partner-betrayal'],
  ontdekt: ['discovered', 'discovery-just-happened', 'betrayal-discovery'],
  vreemdgegaan: ['cheated', 'infidelity', 'partner-betrayal'],
  ontrouw: ['infidelity', 'unfaithful', 'partner-betrayal'],
  overspel: ['adultery', 'infidelity', 'partner-betrayal'],
  shock: ['shock', 'acute-shock', 'body-shock'],
  geschokt: ['shocked', 'acute-shock'],
  bevroren: ['frozen', 'body-shock', 'acute-shock'],
  trillen: ['shaking', 'body-dysregulation', 'body-shock'],
  misselijk: ['nauseous', 'body-dysregulation'],
  // ── Dutch: VETR01 (trust repair after betrayal) ──
  vertrouwensherstel: ['trust-repair', 'rebuilding-trust'],
  herstel: ['repair', 'trust-repair', 'rebuilding'],
  vergiffenis: ['forgiveness', 'forgiveness-pressure'],
  tweede: ['second-chance', 'trust-repair'],
  kans: ['second-chance', 'trust-repair'],
  geloven: ['believe-again', 'trust-repair'],
  // ── Dutch: GASL01 (gaslighting recognition) ──
  gaslighting: ['gaslighting', 'reality-distortion', 'manipulation'],
  gek: ['crazy-making', 'gaslighting', 'self-doubt'],
  gekgemaakt: ['crazy-making', 'gaslighting'],
  manipulatie: ['manipulation', 'gaslighting'],
  manipulatief: ['manipulation', 'gaslighting'],
  verdraaien: ['twisting', 'reality-distortion', 'darvo'],
  verdraaid: ['twisted', 'reality-distortion'],
  waarheid: ['truth', 'reality-anchoring', 'fact-anchoring'],
  realiteit: ['reality', 'reality-distortion', 'reality-anchoring'],
  inbeelding: ['imagining', 'self-doubt', 'crazy-making'],
  overdrijven: ['exaggerating', 'minimizing', 'gaslighting'],
  // ── Dutch: CDP01 (codependentie patroon) ──
  codependent: ['codependency', 'self-loss', 'relational-fusion'],
  zelfverlies: ['self-loss', 'identity-collapse', 'codependency'],
  versmelting: ['relational-fusion', 'codependency', 'identity-collapse'],
  redden: ['rescue-compulsion', 'over-responsibility', 'codependency'],
  egoistisch: ['self-care-guilt', 'codependency', 'over-responsibility'],
  meegaan: ['emotional-dependency', 'codependency', 'relational-fusion'],
  // ── Dutch: RNW01 (rouw naaste) ──
  // Note: 'rouw' (line 65), 'rouwen' (line 337), 'vroeger' (line 83) already exist—extend via MODULE_KEYWORDS match
  rouwnaaste: ['ambiguous-grief', 'grief-living-person', 'miss-old-person'],
  levenderouw: ['ambiguous-grief', 'grief-living-person', 'who-they-were'],
  herkennen: ['person-before-addiction', 'miss-old-person', 'who-they-were'],
  acceptatiedruk: ['forced-acceptance', 'acceptance-pressure', 'ambiguous-grief'],
  terugkomen: ['false-hope', 'person-before-addiction', 'who-they-were'],
  // ── Dutch: PAR01 (parentificatie) ──
  ouderlijkkind: ['parentification', 'caretaker-child', 'lost-childhood'],
  moestenzorgen: ['parentification', 'hyper-responsibility', 'childhood-burden'],
  geenkindertijd: ['lost-childhood', 'adult-too-early', 'invisible-child'],
  volwassenzijn: ['adult-too-early', 'role-reversal', 'hyper-responsibility'],
  zorgenvoor: ['caretaker-child', 'parentification', 'instrumental-parentification'],
  // ── Dutch: FIN01 (financiële afhankelijkheid) ──
  geldcontrole: ['financial-control', 'money-as-power', 'spending-control'],
  eigenrekening: ['financial-isolation', 'no-own-account', 'financial-dependency'],
  magniets: ['spending-control', 'economic-abuse', 'financial-control'],
  // ── Dutch: ISO01 (isolatie en sociale terugtrekking) ──
  niemandbelasten: ['burden-fear', 'social-withdrawal', 'isolation'],
  schaamtepraten: ['shame-about-talking', 'social-withdrawal'],
  geensociaal: ['no-social-contact', 'isolation', 'social-withdrawal'],
  zieniemanmeer: ['no-social-contact', 'social-withdrawal', 'isolation'],
  alleendragen: ['burden-fear', 'isolation', 'protective-isolation'],
  geenenergievoormenesen: ['exhaustion-isolation', 'social-withdrawal'],
  contactkosteveel: ['exhaustion-isolation', 'social-withdrawal'],
  alleenzijnveiliger: ['protective-isolation', 'social-withdrawal'],
  lastzijn: ['burden-fear', 'isolation'],
  angstvooroordeel: ['fear-of-judgment', 'shame-about-talking'],
};

// ─── MODULE KEYWORDS: English concept words per module ───
// Each module has 5-10 strong English concept words that define its theme.
// A match of 1+ concepts triggers the module. Higher scores win ties.
const MODULE_KEYWORDS: Record<string, string[]> = {
  M05: ['lonely', 'loneliness', 'alone', 'isolated', 'isolation', 'nobody', 'disconnected', 'connection'],
  M06: ['trust', 'betrayal', 'betrayed', 'distrust', 'mistrust', 'rupture', 'broken', 'bond', 'trust-broken'],
  M07: ['panic', 'closeness', 'proximity', 'freeze', 'shutdown', 'overwhelmed', 'too-close'],
  M08: ['sleep', 'insomnia', 'awake', 'night', 'tired', 'nightmare', 'restless'],
  M09: ['perfectionism', 'perfect', 'pressure', 'performance', 'self-criticism', 'never-enough', 'failure'],
  M13: ['grief', 'mourning', 'loss', 'parent', 'mother', 'father', 'death', 'bereavement'],
  M16: ['overloaded', 'overwhelmed', 'explode', 'explosion', 'too-much', 'outburst', 'overstimulation'],
  M17: ['childhood', 'trauma', 'past', 'upbringing', 'child', 'flashback', 'triggered'],
  M19: ['shame', 'rejection', 'rejected', 'self-disgust', 'humiliation', 'worthless'],
  M20: ['worthless', 'worthlessness', 'defective', 'useless', 'not-worth', 'identity'],
  M21: ['abandonment', 'abandoned', 'leave', 'left', 'fear', 'attachment', 'clingy'],
  M22: ['invisible', 'invisibility', 'unseen', 'overlooked', 'ignored', 'nobody-sees'],
  M23: ['intimacy', 'danger', 'closeness', 'engulfment', 'autonomy', 'suffocating', 'fusion'],
  M25: ['outsider', 'belonging', 'nowhere', 'misfit', 'excluded', 'outcast'],
  M26: ['misunderstood', 'nobody-understands', 'unheard', 'dismissed', 'invalidated'],
  M27: ['overcontrol', 'control', 'grip', 'rigid', 'structure', 'survival', 'micromanage'],
  M29: ['unstable', 'instability', 'fluctuating', 'mood-swings', 'emotional', 'chaos', 'volatile'],
  M30: ['closeness', 'fear', 'social', 'overstimulation', 'people', 'too-many', 'withdraw'],
  M33: ['confrontation', 'explosion', 'outburst', 'anger', 'rage', 'lost-control', 'verbal'],
  M34: ['self-medication', 'substances', 'alcohol', 'cannabis', 'benzodiazepines', 'drugs', 'numbing', 'pills', 'restlessness', 'unrest'],
  M35: ['responsibility', 'caring', 'others', 'burden', 'parentification', 'caretaker', 'everyone-else'],
  M40: ['ambivalence', 'closeness', 'longing', 'overloaded', 'push-pull', 'want-but-cant'],
  M41: ['guilt', 'relapse', 'shame', 'self-attack', 'failed', 'disappointed'],
  M42: ['exhausted', 'exhaustion', 'autonomous', 'alone', 'self-reliant', 'burned-out', 'everything-alone'],
  M43: ['rejection', 'repetition', 'pattern', 'old-wound', 'again', 'always-rejected'],
  M44: ['failure', 'identity', 'loser', 'worthless', 'never-succeed', 'defective'],
  M45: ['sexual', 'trauma', 'violation', 'touch', 'body', 'disgust', 'sexual-abuse', 'groping'],
  M46: ['impulse', 'urge', 'explosion', 'uncontrollable', 'rage', 'outburst', 'snap'],
  M47: ['existence', 'shame', 'self-hatred', 'should-not-exist', 'wrong', 'burden', 'mistake'],
  M49: ['relapse', 'repeated', 'pattern', 'cant-maintain', 'again', 'cycle', 'endure'],
  M50: ['craving', 'boredom', 'emptiness', 'void', 'flat', 'nothing-to-do', 'restless'],
  M51: ['child', 'parentification', 'strong', 'carry', 'too-young', 'responsibility', 'caretaker'],
  M52: ['mask', 'cheerful', 'humor', 'laugh', 'facade', 'pretend', 'hide'],
  M53: ['symbiosis', 'parent', 'mother', 'father', 'enmeshed', 'stuck', 'child-role'],
  M54: ['perfectionism', 'survival', 'perfect', 'control', 'performance', 'driven', 'never-rest'],
  M55: ['self-hatred', 'self-hate', 'vulnerability', 'crying', 'weak', 'contempt', 'ashamed-of-feelings'],
  M56: ['distance', 'withdraw', 'shut-down', 'after-closeness', 'flee', 'pull-back', 'cold'],
  M57: ['expectation', 'failure', 'hopeless', 'pointless', 'doomed', 'wont-work', 'pessimism'],
  M58: ['panic', 'no-reason', 'physical', 'tension', 'anxiety', 'body', 'sudden', 'unexplained'],
  M59: ['exposed', 'seen-through', 'unmasked', 'afraid', 'discovered', 'secret', 'facade'],
  M60: ['never-enough', 'trying', 'failing', 'exhausted', 'not-good-enough', 'effort', 'futile'],
  M61: ['regulate', 'nobody-helps', 'unreachable', 'alone', 'calm', 'co-regulation', 'cant-be-reached'],
  M62: ['society', 'system', 'misfit', 'excluded', 'bureaucracy', 'not-fitting', 'institution'],
  M63: ['isolation', 'safety', 'self-protection', 'withdraw', 'hiding', 'retreat', 'safe-alone'],
  M64: ['relationship', 'pattern', 'repetition', 'old-pattern', 'attract', 'push-pull', 'dependency'],
  M65: ['mother', 'rescue', 'carry', 'symbiosis', 'need', 'caretaker', 'longing', 'hold'],
  M66: ['identity', 'confusion', 'pressure', 'who-am-i', 'lost', 'unstable', 'dont-know'],
  M67: ['help', 'refuse', 'rejection', 'protection', 'stubborn', 'wont-accept', 'push-away'],
  M68: ['relationship', 'regression', 'small', 'dependent', 'child', 'helpless', 'clingy'],
  M69: ['hypervigilance', 'scanning', 'alert', 'watching', 'guard', 'suspicious', 'reading-signals'],
  M70: ['spirituality', 'faith', 'meaning', 'purpose', 'lost', 'emptiness', 'direction'],
  M71: ['guilt', 'help', 'asking', 'burden', 'shame', 'undeserving', 'too-much'],
  M72: ['right-to-exist', 'superfluous', 'unnecessary', 'should-not-be-here', 'invisible', 'burden'],
  M73: ['overthinking', 'rumination', 'head', 'analyzing', 'fantasy', 'escape', 'intellectualizing'],
  M74: ['reflection', 'self-reflection', 'avoidance', 'afraid', 'mirror', 'confronting', 'resist'],
  M75: ['loneliness', 'craving', 'substance-use', 'using', 'drink', 'lonely-use', 'escape'],
  M76: ['existential', 'emptiness', 'void', 'meaningless', 'pointless', 'purpose', 'hopelessness'],
  M77: ['mask', 'facade', 'pretend', 'fine', 'expectation', 'reality', 'inside-outside'],
  M78: ['relapse', 'hiding', 'secret', 'mask', 'pretend', 'concealing', 'lying'],
  M79: ['relationship', 'control', 'lost', 'boundaries', 'identity', 'enmeshed', 'confused'],
  M80: ['numbing', 'numb', 'feel-nothing', 'switch-off', 'escape', 'void', 'self-medication'],
  M81: ['automatic', 'autopilot', 'reflex', 'substance-use', 'unconscious', 'habit', 'pattern'],
  M82: ['restart', 'again', 'zero', 'relapse', 'failure', 'beginning', 'cycle', 'stagnation'],
  M83: ['guilt', 'no-reason', 'unexplained', 'innocent', 'vague', 'constant', 'diffuse'],
  M84: ['boundary-violation', 'violation', 'normal', 'deserved', 'inevitable', 'normalized', 'accepted-abuse', 'abuse'],
  M85: ['mirror', 'relationship', 'self-hatred', 'shame', 'eyes-of-other', 'reflection', 'contempt'],
  // ── Phase 2 Advanced Modules ──
  FALE01: ['relapse', 'failed', 'failure', 'fell-back', 'used-again', 'slipped', 'lapse', 'craving-gave-in', 'drank-again', 'using-again'],
  VERG01: ['forgiveness', 'self-forgiveness', 'guilt', 'shame', 'deserve-punishment', 'unforgivable', 'self-blame', 'self-punishment', 'cannot-forgive-myself'],
  ROUW01: ['grief', 'loss', 'lost-years', 'mourning', 'missed-moments', 'taken-away', 'too-late', 'lost-myself', 'lost-relationship'],
  IDEN01: ['identity', 'who-am-i', 'just-an-addict', 'no-identity', 'lost-myself', 'without-addiction', 'role-fusion', 'only-a-patient'],
  ZINK01: ['meaning', 'purpose', 'pointless', 'meaningless', 'why-bother', 'empty-inside', 'nothing-to-live-for', 'existential', 'what-is-the-point'],
  TERV01: ['relapse-chain', 'trigger-analysis', 'what-went-wrong', 'understand-relapse', 'the-chain', 'before-i-used', 'relapse-analysis', 'how-it-went-wrong', 'want-to-understand'],
  MI02: ['ambivalent', 'want-but-not', 'part-of-me', 'doubtful', 'mixed-feelings', 'not-ready-yet', 'want-to-stop-but', 'torn', 'conflicted'],
  SLAAP01: ['sleep', 'insomnia', 'cant-sleep', 'night-craving', 'sleep-anxiety', 'fatigue-relapse', 'withdrawal-sleep', 'nighttime', 'awake-at-night', 'sleep-hygiene', 'night-vigilance', 'sleep-guilt'],
  // ── Kim P2 Advanced Modules ──
  BEDR01: ['betrayal-discovery', 'partner-betrayal', 'infidelity', 'cheated', 'acute-shock', 'body-shock', 'discovery-just-happened', 'body-dysregulation', 'shaking', 'frozen', 'nauseous', 'shocked'],
  VETR01: ['trust-repair', 'rebuilding-trust', 'second-chance', 'believe-again', 'forgiveness-pressure', 'boundary-after-betrayal', 'timeline-pressure', 'trust-again', 'partner-mind-reading', 'relationship-meaning'],
  GASL01: ['gaslighting', 'reality-distortion', 'crazy-making', 'manipulation', 'darvo', 'self-doubt', 'fact-anchoring', 'reality-anchoring', 'twisting', 'blame-shifting', 'information-asymmetry', 'minimizing'],
  // ── Kim P3 Advanced Modules ──
  CDP01: ['self-loss', 'codependency', 'relational-fusion', 'identity-collapse', 'rescue-compulsion', 'emotional-dependency', 'over-responsibility', 'control-from-fear', 'self-care-guilt', 'without-him-i-am-nothing'],
  RNW01: ['ambiguous-grief', 'grief-living-person', 'miss-old-person', 'person-before-addiction', 'relationship-as-it-was', 'false-hope', 'forced-acceptance', 'grief-permission', 'future-loss', 'who-they-were'],
  // ── Kim P4 Advanced Modules ──
  PAR01: ['parentification', 'role-reversal', 'lost-childhood', 'caretaker-child', 'emotional-parentification', 'instrumental-parentification', 'hyper-responsibility', 'childhood-burden', 'adult-too-early', 'invisible-child'],
  FIN01: ['financial-control', 'financial-dependency', 'money-as-power', 'economic-abuse', 'financial-isolation', 'spending-control', 'hidden-debt', 'financial-shame', 'money-manipulation', 'no-own-account'],
  // ── Kim P5 Advanced Modules ──
  ISO01: ['social-withdrawal', 'isolation', 'shame-about-talking', 'burden-fear', 'protective-isolation', 'exhaustion-isolation', 'no-social-contact', 'fear-of-judgment', 'advice-fatigue', 'painful-loneliness'],
};

// ─── DETECTOR LOGIC ───

/**
 * Tokenize input text into words (split on whitespace and punctuation).
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s\-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3);
}

/**
 * Translate tokens to English concepts using TRANSLATION_MAP.
 * Returns a set of all English concept words found.
 */
function translateToEnglishConcepts(tokens: string[]): Set<string> {
  const concepts = new Set<string>();

  for (const token of tokens) {
    // The token itself might already be an English word
    concepts.add(token);

    // Direct lookup in translation map
    const translations = TRANSLATION_MAP[token];
    if (translations) {
      for (const t of translations) concepts.add(t);
    }

    // Partial match: check if a known translation key is contained in the token
    // (handles compound words like "slaapstoornis" containing "slaap")
    for (const [key, values] of Object.entries(TRANSLATION_MAP)) {
      if (key.length >= 4 && token.length > key.length && token.includes(key)) {
        for (const v of values) concepts.add(v);
      }
    }
  }

  return concepts;
}

/**
 * Detect the best matching short module for a user message.
 * Returns module ID (e.g., 'M05') or null if no strong match.
 *
 * Strategy:
 * - Tokenize input, translate to English concepts
 * - Score each module by how many of its keywords match
 * - Threshold = 1 (one strong concept match is sufficient)
 * - Highest score wins; ties broken by module order (first wins)
 */
export function detectShortModuleTrigger(text: string): string | null {
  if (!text || text.trim().length < 3) return null;

  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  const concepts = translateToEnglishConcepts(tokens);

  let bestModule: string | null = null;
  let bestScore = 0;

  for (const [moduleId, keywords] of Object.entries(MODULE_KEYWORDS)) {
    let score = 0;

    for (const kw of keywords) {
      if (concepts.has(kw)) {
        score++;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestModule = moduleId;
    }
  }

  // Threshold = 1: one strong keyword match is sufficient
  return bestScore >= 1 ? bestModule : null;
}

/**
 * Detect ISO01-specific concept signals from user text.
 * Returns a set of matched ISO01 concept keywords (e.g., 'social-withdrawal', 'burden-fear').
 * Used by the Kim P5 pipeline to populate ISO01 boolean signals from NL/EN text.
 */
export function detectISO01Signals(text: string): Set<string> {
  if (!text || text.trim().length < 3) return new Set();

  const tokens = tokenize(text);
  if (tokens.length === 0) return new Set();

  const concepts = translateToEnglishConcepts(tokens);
  const iso01Keywords = MODULE_KEYWORDS.ISO01 || [];
  const matched = new Set<string>();

  for (const kw of iso01Keywords) {
    if (concepts.has(kw)) {
      matched.add(kw);
    }
  }

  return matched;
}
