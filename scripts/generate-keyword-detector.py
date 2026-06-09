"""
Generate a keyword-based short module detector.
Maps Dutch and English keywords to short module IDs.
Each module gets 3-5 regex patterns based on its tags and theme.
"""
import re

with open('lib/engine/elias/short-module-prompts.ts', 'r') as f:
    content = f.read()

entries = re.split(r"  \{\n    id: '", content)[1:]
modules = []
for entry in entries:
    m_id = entry[:3]
    name_match = re.search(r"name: '([^']+)'", entry)
    tags_match = re.search(r'detected_tags bevat: ([^\n]+)', entry)
    if name_match and tags_match:
        name = name_match.group(1)
        tags = [t.strip() for t in tags_match.group(1).split(',')]
        modules.append((m_id, name, tags))

# For each module, create keyword patterns based on the tag names
# Tags like 'structural_loneliness' → keywords: ['loneliness', 'lonely', 'eenzaam', 'alleen']
# We'll create a mapping of tag → keywords (Dutch + English)

TAG_KEYWORDS = {
    # M05 - Loneliness
    'structural_loneliness': ['eenzaam', 'lonely', 'loneliness', 'alleen staan'],
    'no_real_connection': ['geen verbinding', 'no connection', 'niemand dichtbij'],
    'nobody_would_miss_me': ['niemand mist', 'nobody miss', 'niet gemist'],
    'social_disconnection': ['sociaal geïsoleerd', 'disconnected', 'afgesloten'],
    'existential_isolation': ['existentieel alleen', 'fundamenteel alleen'],
    # M06 - Trust
    'trust_rupture': ['vertrouwen gebroken', 'trust broken', 'vertrouwensbreuk'],
    'nobody_can_be_trusted': ['niemand vertrouwen', 'trust nobody', 'kan niemand vertrouwen'],
    'all_bonds_break': ['elke band breekt', 'bonds break', 'iedereen vertrekt'],
    'betrayal_expectation': ['verraden', 'betrayed', 'verraad'],
    'attachment_mistrust': ['hechting', 'attachment', 'wantrouwen'],
    # M07 - Closeness panic
    'closeness_panic': ['nabijheid paniek', 'closeness panic', 'te dichtbij'],
    'attachment_alarm': ['hechtingsangst', 'attachment fear'],
    'intimacy_shutdown': ['intimiteit', 'intimacy', 'shutdown'],
    'proximity_trigger': ['dichtbij komen', 'proximity'],
    'relational_freeze': ['bevriezen', 'freeze', 'verstijf'],
    # M08 - Sleep (M13 in our numbering)
    'sleep_disturbance': ['slaap', 'sleep', 'slapen', 'wakker'],
    'use_to_sleep': ['gebruik om te slapen', 'drink to sleep', 'middel.*slaap'],
    'night_craving': ['nacht.*craving', 'avond.*trek', 'night.*urge'],
    'insomnia_risk': ['insomnia', 'slapeloosheid', 'niet.*slapen'],
    'circadian_disruption': ['dag-nacht', 'ritme', 'circadian'],
    # M09 - Perfectionism
    'perfectionism': ['perfecti', 'perfect'],
    'internal_pressure': ['druk', 'pressure', 'moeten'],
    'never_enough': ['nooit genoeg', 'never enough', 'niet goed genoeg'],
    'all_or_nothing_recovery': ['alles of niets', 'all or nothing'],
    'punitive_self_control': ['streng.*zelf', 'self.*punish', 'zelfkritiek'],
    # M16 - Grief
    'parental_loss': ['ouder verloren', 'parent.*loss', 'vader.*dood', 'moeder.*dood'],
    'unfinished_grief': ['rouw', 'grief', 'verlies', 'gemis'],
    'grief_guilt': ['schuld.*dood', 'guilt.*death', 'schuld.*verlies'],
    'mother_loss': ['moeder.*verloren', 'mother.*loss', 'mama.*dood'],
    'father_loss': ['vader.*verloren', 'father.*loss', 'papa.*dood'],
    'unresolved_bereavement': ['onverwerkt.*verlies', 'unresolved.*grief'],
    # M17 - Overload
    'overload': ['overbelast', 'overload', 'te veel'],
    'explosion_risk': ['ontplof', 'explode', 'barst'],
    'too_much_at_once': ['te veel tegelijk', 'too much'],
    'acute_pressure': ['acute druk', 'acute pressure'],
    'overstimulation': ['overprikkeld', 'overstimulated'],
    'emotional_overload': ['emotioneel.*te veel', 'emotional.*overload'],
    # M19 - Childhood trauma
    'childhood_trauma': ['kindertijd', 'childhood', 'vroeger', 'opgegroeid'],
    'old_alarm': ['oud alarm', 'old alarm', 'vroeger.*alarm'],
    'inner_child_activation': ['inner child', 'innerlijk kind', 'klein.*voelen'],
    'early_schema_trigger': ['schema.*vroeg', 'early.*pattern'],
    'past_present_overlap': ['verleden.*heden', 'past.*present', 'toen.*nu'],
    # M20 - Rejection shame
    'rejection_shame': ['afwijzing.*schaamte', 'rejection.*shame'],
    'self_disgust': ['walging', 'disgust', 'walg.*zelf'],
    'abandonment_shame': ['verlaten.*schaamte', 'abandoned.*shame'],
    'relational_shame': ['schaamte.*relatie', 'shame.*relationship'],
    'identity_attack_after_rejection': ['wie ben ik', 'identity.*attack'],
    # M21 - Worthlessness
    'internalized_rejection': ['afwijzing.*geloof', 'internalized.*rejection'],
    'worthlessness': ['waardeloos', 'worthless', 'niks waard'],
    'defectiveness_schema': ['defect', 'kapot', 'broken'],
    'not_worth_recovery': ['herstel.*niet waard', 'not worth.*recovery'],
    'no_place_in_world': ['geen plek', 'no place', 'nergens thuis'],
    # M22 - Abandonment fear
    'abandonment_fear': ['verlating', 'abandonment', 'verlaten worden'],
    'fear_of_being_left': ['bang.*verlaten', 'fear.*left', 'weggaan'],
    'attachment_panic': ['hechtingspaniek', 'attachment panic'],
    'relational_alarm': ['relatie.*alarm', 'relational alarm'],
    'they_always_leave': ['altijd.*weggaan', 'always leave', 'iedereen gaat weg'],
    # M23 - Invisibility
    'invisibility': ['onzichtbaar', 'invisible', 'niet gezien'],
    'nobody_sees_me': ['niemand ziet', 'nobody sees', 'niet gezien'],
    'unseen_pain': ['pijn.*onzichtbaar', 'unseen pain'],
    'emotional_invisibility': ['emotioneel.*onzichtbaar'],
    'disappearing_self': ['verdwijn', 'disappear'],
    # M25 - Intimacy as danger
    'intimacy_as_danger': ['intimiteit.*gevaar', 'intimacy.*danger'],
    'engulfment_fear': ['opgeslokt', 'engulfed', 'verslonden'],
    'autonomy_threat': ['autonomie.*bedreigd', 'autonomy.*threat'],
    'closeness_as_control': ['nabijheid.*controle', 'closeness.*control'],
    'relational_fusion_fear': ['versmelten', 'fusion', 'eigen identiteit.*verlies'],
    # M26 - Outsider
    'permanent_outsider': ['buitenstaander', 'outsider', 'er niet bij horen'],
    'nowhere_belonging': ['nergens.*thuishoren', 'nowhere.*belong'],
    'outsider_identity': ['altijd.*buiten', 'always.*outside'],
    'not_part_of_anything': ['nergens bij', 'not part of'],
    'social_alienation': ['vervreemd', 'alienated', 'vervreemding'],
    # M27 - Misunderstood
    'chronically_misunderstood': ['niet begrepen', 'misunderstood', 'begrijpt.*niet'],
    'not_getting_me': ['snapt.*niet', 'doesn.*understand'],
    'invalidation': ['invalidatie', 'invalidated', 'niet serieus'],
    'defensive_exhaustion': ['moe.*uitleggen', 'tired.*explaining'],
    'misread_identity': ['verkeerd.*gezien', 'misread'],
    # M29 - Overcontrol
    'overcontrol': ['controle', 'control', 'grip'],
    'perfectionistic_control': ['perfect.*controle', 'perfectionistic'],
    'rigid_recovery': ['rigide.*herstel', 'rigid.*recovery'],
    'control_as_survival': ['controle.*overleven', 'control.*survival'],
    'fear_of_losing_control': ['controle.*verliezen', 'losing.*control', 'bang.*controle'],
    # M30 - Emotional instability
    'emotional_instability': ['emotioneel.*instabiel', 'emotional.*instability'],
    'rapid_state_shift': ['snel.*wisselen', 'rapid.*shift', 'mood.*swing'],
    'affective_swing': ['stemming.*wisselt', 'affective.*swing'],
    'emotional_whiplash': ['emotioneel.*heen.*weer', 'emotional.*whiplash'],
    'unstable_self_state': ['instabiel.*zelf', 'unstable.*self'],
    # M33 - Social overload
    'fear_of_closeness': ['angst.*nabijheid', 'fear.*closeness'],
    'social_overload': ['sociaal.*overbelast', 'social.*overload', 'te veel mensen'],
    'too_many_people': ['te veel mensen', 'too many people'],
    'proximity_overload': ['nabijheid.*te veel'],
    'connection_ambivalence': ['verbinding.*ambivalent', 'connection.*ambivalent'],
    # M34 - Anger/confrontation
    'confrontation_trigger': ['confrontatie', 'confrontation'],
    'loss_of_control': ['controle.*verlies', 'loss.*control', 'kwijt.*controle'],
    'criticism_reactivity': ['kritiek', 'criticism', 'aangevallen'],
    'shame_rage': ['schaamte.*woede', 'shame.*rage'],
    'explosive_response': ['ontplof', 'explosive', 'uitbarsting'],
    # M35 - Self-medication
    'self_medication': ['zelfmedicatie', 'self.*medicat'],
    'use_to_calm': ['gebruik.*kalmeren', 'use.*calm', 'drinken.*rust'],
    'inner_restlessness': ['innerlijke.*onrust', 'inner.*restless', 'onrustig'],
    'sedation_seeking': ['verdoven', 'sedate', 'dempen'],
    'medication_misuse_risk': ['medicatie.*misbruik', 'medication.*misuse'],
    # M40 - Relapse
    'relapse_shame': ['terugval.*schaamte', 'relapse.*shame', 'hervallen.*schaamte'],
    'use_after_progress': ['gebruik.*na.*vooruitgang', 'used.*after.*progress'],
    'failure_identity': ['mislukkeling', 'failure', 'gefaald'],
    'hidden_use': ['stiekem.*gebruik', 'hidden.*use', 'verborgen.*gebruik'],
    'post_relapse_despair': ['wanhoop.*terugval', 'despair.*relapse'],
    # M41 - Body shame
    'body_shame': ['lichaam.*schaamte', 'body.*shame'],
    'physical_disgust': ['walging.*lichaam', 'physical.*disgust'],
    'body_as_evidence': ['lichaam.*bewijs', 'body.*evidence'],
    'somatic_shame': ['somatisch.*schaamte', 'somatic.*shame'],
    'disconnection_from_body': ['los.*lichaam', 'disconnected.*body'],
    # M42 - Identity loss
    'identity_loss': ['identiteit.*verloren', 'identity.*loss', 'wie ben ik'],
    'who_am_i_without_use': ['wie.*zonder.*gebruik', 'who.*without.*using'],
    'role_confusion': ['rol.*verwarring', 'role.*confusion'],
    'empty_self': ['leeg.*van binnen', 'empty.*self', 'leegte'],
    'no_personality_left': ['geen persoonlijkheid', 'no personality'],
    # M43 - Guilt
    'guilt_accumulation': ['schuld.*ophoping', 'guilt.*accumulation'],
    'moral_injury': ['morele.*verwonding', 'moral.*injury'],
    'unforgivable_self': ['onvergeeflijk', 'unforgivable'],
    'guilt_as_identity': ['schuld.*identiteit', 'guilt.*identity'],
    'chronic_guilt': ['chronische.*schuld', 'chronic.*guilt', 'altijd.*schuldig'],
    # M44 - Parentification
    'parentification': ['parentificatie', 'parentifi'],
    'role_reversal': ['rolwisseling', 'role.*reversal'],
    'caretaker_exhaustion': ['zorgen.*moe', 'caretaker.*exhaust'],
    'lost_childhood': ['verloren.*kindertijd', 'lost.*childhood'],
    'boundary_inability': ['grens.*niet.*stellen', 'boundary.*inability'],
    # M45 - Suicidal ideation
    'passive_suicidal_ideation': ['dood.*willen', 'want.*die', 'niet.*meer.*willen'],
    'life_fatigue': ['levensmoe', 'life.*fatigue', 'moe.*leven'],
    'disappearance_wish': ['verdwijnen.*wens', 'wish.*disappear', 'weg.*willen'],
    'meaninglessness': ['zinloos', 'meaningless', 'geen.*zin'],
    'burden_to_others': ['last.*anderen', 'burden.*others', 'beter.*zonder.*mij'],
    # M46 - Financial stress
    'financial_stress': ['financieel', 'financial', 'geld.*stress'],
    'debt_shame': ['schulden.*schaamte', 'debt.*shame'],
    'poverty_trap': ['armoede', 'poverty', 'geen.*geld'],
    'financial_chaos': ['financieel.*chaos', 'financial.*chaos'],
    'money_as_trigger': ['geld.*trigger', 'money.*trigger'],
    # M47 - Dissociation
    'dissociation': ['dissociatie', 'dissociat', 'afwezig'],
    'derealization': ['derealisatie', 'derealization', 'onwerkelijk'],
    'depersonalization': ['depersonalisatie', 'depersonalization'],
    'emotional_numbing': ['gevoelloos', 'numb', 'niets voelen'],
    'consciousness_gaps': ['gaten.*geheugen', 'memory.*gaps', 'blackout'],
    # M49 - Chronic pain
    'chronic_pain': ['chronische.*pijn', 'chronic.*pain'],
    'pain_as_trigger': ['pijn.*trigger', 'pain.*trigger'],
    'body_betrayal': ['lichaam.*verraad', 'body.*betrayal'],
    'pain_medication_risk': ['pijnmedicatie', 'pain.*medication'],
    'suffering_without_relief': ['lijden.*zonder.*verlichting'],
    # M50 - Shame spiral
    'shame_spiral': ['schaamte.*spiraal', 'shame.*spiral'],
    'toxic_shame': ['toxische.*schaamte', 'toxic.*shame'],
    'shame_as_identity': ['schaamte.*identiteit', 'shame.*identity'],
    'shame_avoidance': ['schaamte.*vermijden', 'shame.*avoid'],
    'shame_rage_cycle': ['schaamte.*woede.*cyclus'],
    # M51 - Codependency
    'codependency': ['codependent', 'co-afhankelijk', 'medeafhankelijk'],
    'enmeshment': ['verstrengeling', 'enmeshment'],
    'self_sacrifice': ['zelfopoffering', 'self.*sacrifice'],
    'identity_through_other': ['identiteit.*ander', 'identity.*through.*other'],
    'boundary_dissolution': ['grens.*oploss', 'boundary.*dissolut'],
    # M52 - Anger at self
    'self_directed_anger': ['woede.*zelf', 'anger.*self', 'boos.*mezelf'],
    'self_punishment': ['zelfstraf', 'self.*punish'],
    'self_harm_urge': ['zelfbeschadiging', 'self.*harm', 'snijden'],
    'internal_aggression': ['interne.*agressie', 'internal.*aggress'],
    'self_destruction': ['zelfdestructie', 'self.*destruct'],
    # M53 - Existential crisis
    'existential_crisis': ['existentieel', 'existential'],
    'meaning_void': ['zinloosheid', 'meaning.*void', 'geen.*betekenis'],
    'purpose_loss': ['doel.*verloren', 'purpose.*loss'],
    'cosmic_insignificance': ['onbeduidend', 'insignificant'],
    'recovery_futility': ['herstel.*zinloos', 'recovery.*futile'],
    # M54 - Relational grief
    'relational_grief': ['relationeel.*verlies', 'relational.*grief'],
    'friendship_loss': ['vriendschap.*verloren', 'friendship.*loss'],
    'community_loss': ['gemeenschap.*verloren', 'community.*loss'],
    'social_death': ['sociaal.*dood', 'social.*death'],
    'network_collapse': ['netwerk.*ingestort', 'network.*collapse'],
    # M55 - Ambivalence about recovery
    'recovery_ambivalence': ['ambivalent.*herstel', 'ambivalent.*recovery'],
    'miss_the_substance': ['mis.*middel', 'miss.*substance', 'mis.*drinken'],
    'nostalgia_for_use': ['nostalgie.*gebruik', 'nostalgia.*use'],
    'recovery_doubt': ['twijfel.*herstel', 'doubt.*recovery'],
    'secret_longing': ['stiekem.*verlangen', 'secret.*longing'],
}

# Generate TypeScript file with keyword patterns
lines = []
lines.append('/**')
lines.append(' * Short Module Keyword Detector')
lines.append(' * Auto-generated: maps Dutch/English keywords to short module IDs.')
lines.append(' * Used by the buffer to detect short module triggers from user text.')
lines.append(' */')
lines.append('')
lines.append('interface KeywordRule {')
lines.append('  moduleId: string;')
lines.append('  patterns: RegExp[];')
lines.append('}')
lines.append('')
lines.append('const KEYWORD_RULES: KeywordRule[] = [')

for m_id, name, tags in modules:
    # Collect all keywords for this module's tags
    all_patterns = []
    for tag in tags:
        if tag in TAG_KEYWORDS:
            for kw in TAG_KEYWORDS[tag]:
                all_patterns.append(kw)
    
    if all_patterns:
        # Take up to 8 patterns per module
        patterns = all_patterns[:8]
        pattern_strs = ', '.join([f"/{p.replace('*', '.*')}/i" for p in patterns])
        lines.append(f"  {{ moduleId: '{m_id}', patterns: [{pattern_strs}] }},")

lines.append('];')
lines.append('')
lines.append('/**')
lines.append(' * Detect if user text matches any short module keywords.')
lines.append(' * Returns the best matching module ID or null.')
lines.append(' */')
lines.append('export function detectShortModuleTrigger(text: string): string | null {')
lines.append('  const lower = text.toLowerCase();')
lines.append('  let bestModule: string | null = null;')
lines.append('  let bestScore = 0;')
lines.append('')
lines.append('  for (const rule of KEYWORD_RULES) {')
lines.append('    let score = 0;')
lines.append('    for (const pattern of rule.patterns) {')
lines.append('      if (pattern.test(lower)) score++;')
lines.append('    }')
lines.append('    if (score > bestScore) {')
lines.append('      bestScore = score;')
lines.append('      bestModule = rule.moduleId;')
lines.append('    }')
lines.append('  }')
lines.append('')
lines.append('  // Require at least 1 keyword match')
lines.append('  return bestScore >= 1 ? bestModule : null;')
lines.append('}')
lines.append('')

with open('lib/engine/elias/short-module-keyword-detector.ts', 'w') as f:
    f.write('\n'.join(lines))

print(f"Generated short-module-keyword-detector.ts with {sum(1 for m in modules if any(t in TAG_KEYWORDS for t in m[2]))} module rules")
