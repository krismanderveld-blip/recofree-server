import { detectShortModuleTrigger } from '../lib/engine/elias/short-module-detector';

// ─── Test Dutch phrases ───
const dutchTests: [string, string | null][] = [
  // M05 - Structurele eenzaamheid
  ['ik voel me zo eenzaam', 'M05'],
  ['niemand wil contact met mij, ik ben alleen', 'M05'],
  // M06 - Vertrouwensbreuk
  ['ik kan niemand meer vertrouwen', 'M06'],
  ['ze hebben me verraden', 'M06'],
  // M07 - Paniek bij nabijheid
  ['ik krijg paniek als iemand dichtbij komt', 'M07'],
  // M08 - Slaapstoornis
  ['ik kan niet slapen, lig de hele nacht wakker', 'M08'],
  ['ik heb last van slapeloosheid', 'M08'],
  // M09 - Interne druk / perfectionisme
  ['alles moet perfect zijn, ik leg mezelf zoveel druk op', 'M09'],
  // M13 - Verlies van ouder
  ['mijn moeder is overleden en ik kan het niet verwerken', 'M13'],
  ['ik mis mijn vader zo erg, het verlies doet nog steeds pijn', 'M13'],
  // M16 - Overbelasting
  ['ik sta op ontploffen, het is te veel', 'M16'],
  // M17 - Traumatische kindervaring
  ['vroeger als kind was het thuis niet veilig, dat trauma draag ik nog', 'M17'],
  // M19 - Schaamte door afwijzing
  ['ik schaam me zo na die afwijzing', 'M19'],
  // M20 - Verinnerlijkte verwerping
  ['ik ben waardeloos, ik stel niks voor', 'M20'],
  // M21 - Verlatingsangst
  ['ik ben bang dat iedereen me verlaat', 'M21'],
  // M22 - Onzichtbaarheid
  ['niemand ziet me, ik ben onzichtbaar', 'M22'],
  // M27 - Overcontrole
  ['ik moet alles onder controle houden', 'M27'],
  // M29 - Emotionele instabiliteit
  ['mijn emoties zijn zo instabiel en wisselend', 'M29'],
  // M33 - Controleverlies na confrontatie
  ['na die confrontatie ben ik ontploft van woede', 'M33'],
  // M34 - Zelfmedicatie
  ['ik gebruik alcohol om de onrust te verdoven', 'M34'],
  // M41 - Schuld na terugval
  ['ik voel me zo schuldig na mijn terugval', 'M41'],
  // M42 - Autonoom maar uitgeput
  ['ik doe alles alleen en ben uitgeput', 'M42'],
  // M45 - Seksueel trauma
  ['ik heb seksueel trauma en walg van aanraking', 'M45'],
  // M50 - Craving uit verveling
  ['uit verveling krijg ik craving, die leegte', 'M50'],
  // M52 - Masker van vrolijkheid
  ['ik doe altijd vrolijk maar het is een masker', 'M52'],
  // M55 - Zelfhaat bij kwetsbaarheid
  ['ik haat mezelf als ik kwetsbaar ben en moet huilen', 'M55'],
  // M63 - Isolatie als veiligheid
  ['ik isoleer me want dat voelt veilig', 'M63'],
  // M69 - Constant scannen
  ['ik ben altijd waakzaam en alert, constant aan het scannen', 'M69'],
  // M73 - Vluchten in gedachten
  ['ik leef in mijn hoofd, altijd aan het piekeren en analyseren', 'M73'],
  // M75 - Eenzaamheid naar gebruik
  ['als ik eenzaam ben wil ik gebruiken', 'M75'],
  // M76 - Existentieel zwart gat
  ['alles voelt zinloos en leeg, existentieel', 'M76'],
  // M80 - Wens naar verdoving
  ['ik wil niks meer voelen, alles verdoven', 'M80'],
  // M82 - Steeds opnieuw beginnen
  ['na mijn terugval moet ik weer opnieuw beginnen', 'M82'],
  // M84 - Grensoverschrijding als norm
  ['die grensoverschrijding voelde normaal', 'M84'],
];

// ─── Test English phrases ───
const englishTests: [string, string | null][] = [
  ['I feel so lonely and isolated', 'M05'],
  ['I cannot trust anyone anymore, betrayal', 'M06'],
  ['I have panic attacks when someone gets close', 'M07'],
  ['I cannot sleep at night, insomnia', 'M08'],
  ['my perfectionism is killing me, so much pressure', 'M09'],
  ['I am grieving the loss of my mother', 'M13'],
  ['I feel overwhelmed and about to explode', 'M16'],
  ['my childhood trauma still affects me', 'M17'],
  ['I feel worthless and defective', 'M20'],
  ['I am afraid of abandonment', 'M21'],
  ['I use alcohol to numb the pain', 'M34'],
  ['I had a relapse and feel so guilty', 'M41'],
  ['I am exhausted from doing everything alone', 'M42'],
  ['I feel empty and crave something out of boredom', 'M50'],
  ['I always wear a mask, pretending to be cheerful', 'M52'],
];

// ─── Run tests ───
console.log('=== SHORT MODULE DETECTOR TEST RESULTS ===\n');

let passed = 0;
let failed = 0;

function runTest(input: string, expected: string | null) {
  const result = detectShortModuleTrigger(input);
  const ok = result === expected;
  if (ok) {
    passed++;
    console.log(`  ✅ "${input.substring(0, 55)}..." → ${result}`);
  } else {
    failed++;
    console.log(`  ❌ "${input.substring(0, 55)}..." → ${result} (expected: ${expected})`);
  }
}

console.log('── Dutch Tests ──');
for (const [input, expected] of dutchTests) {
  runTest(input, expected);
}

console.log('\n── English Tests ──');
for (const [input, expected] of englishTests) {
  runTest(input, expected);
}

console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed out of ${passed + failed} tests ===`);

// ─── Coverage: test each module with a single strong English keyword ───
console.log('\n── Module Trigger Coverage (single keyword) ──');
const singleKeywordTests: [string, string][] = [
  ['lonely', 'M05'], ['trust', 'M06'], ['panic closeness', 'M07'], ['sleep insomnia', 'M08'],
  ['perfectionism pressure', 'M09'], ['grief parent', 'M13'], ['overwhelmed explode', 'M16'],
  ['childhood trauma', 'M17'], ['shame rejection', 'M19'], ['worthless defective', 'M20'],
  ['abandonment fear', 'M21'], ['invisible unseen', 'M22'], ['intimacy danger', 'M23'],
  ['outsider belonging', 'M25'], ['misunderstood dismissed', 'M26'], ['overcontrol rigid', 'M27'],
  ['unstable instability', 'M29'], ['social overstimulation', 'M30'], ['confrontation rage', 'M33'],
  ['self-medication substances alcohol', 'M34'], ['responsibility parentification', 'M35'],
  ['ambivalence closeness longing', 'M40'], ['guilt relapse', 'M41'], ['exhausted autonomous alone', 'M42'],
  ['rejection repetition old-wound', 'M43'], ['failure identity loser', 'M44'],
  ['sexual trauma violation', 'M45'], ['impulse explosion uncontrollable', 'M46'],
  ['existence shame self-hatred', 'M47'], ['relapse repeated cycle', 'M49'],
  ['craving boredom emptiness', 'M50'], ['child parentification caretaker', 'M51'],
  ['mask cheerful facade', 'M52'], ['symbiosis parent enmeshed', 'M53'],
  ['perfectionism survival driven', 'M54'], ['self-hatred vulnerability crying', 'M55'],
  ['distance withdraw shut-down', 'M56'], ['hopeless failure doomed', 'M57'],
  ['panic physical tension sudden', 'M58'], ['exposed seen-through unmasked', 'M59'],
  ['never-enough trying failing', 'M60'], ['regulate nobody-helps unreachable', 'M61'],
  ['society system misfit', 'M62'], ['isolation safety self-protection', 'M63'],
  ['relationship pattern repetition dependency', 'M64'], ['mother rescue symbiosis longing', 'M65'],
  ['identity confusion who-am-i', 'M66'], ['help refuse protection', 'M67'],
  ['relationship regression dependent child', 'M68'], ['hypervigilance scanning alert', 'M69'],
  ['spirituality faith meaning purpose', 'M70'], ['guilt help burden undeserving', 'M71'],
  ['right-to-exist superfluous unnecessary', 'M72'], ['overthinking rumination head', 'M73'],
  ['reflection avoidance mirror confronting', 'M74'], ['loneliness craving substance-use', 'M75'],
  ['existential emptiness void meaningless', 'M76'], ['mask facade pretend reality', 'M77'],
  ['relapse hiding secret concealing', 'M78'], ['relationship control boundaries identity', 'M79'],
  ['numbing numb feel-nothing escape', 'M80'], ['automatic autopilot reflex substance-use', 'M81'],
  ['restart again zero relapse cycle', 'M82'], ['guilt no-reason unexplained diffuse', 'M83'],
  ['boundary-violation violation abuse', 'M84'], ['mirror relationship self-hatred contempt', 'M85'],
];

let coveragePass = 0;
let coverageFail = 0;
for (const [input, expected] of singleKeywordTests) {
  const result = detectShortModuleTrigger(input);
  if (result === expected) {
    coveragePass++;
  } else {
    coverageFail++;
    console.log(`  ⚠️  ${expected}: "${input}" → ${result}`);
  }
}
console.log(`\n  Coverage: ${coveragePass}/66 modules trigger correctly with their keywords`);
console.log(`  Missing: ${coverageFail}/66 modules don't trigger correctly`);
