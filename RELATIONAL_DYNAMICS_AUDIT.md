# Relational Dynamics Cluster Audit — ROL-K01, VETR02-K, LEUGEN-K01

## Audit Criteria (11 points)

| # | Criterium | ROL-K01 | VETR02-K | LEUGEN-K01 |
|---|-----------|---------|----------|------------|
| 1 | Kim kiest geen kant | PASS | PASS | PASS |
| 2 | Kim kiest voor herstel/veiligheid/verbinding | PASS | PASS | PASS |
| 3 | Naaste niet verantwoordelijk voor herstel afhankelijke | PASS | PASS | PASS |
| 4 | Minimaliseert relationele schade niet | PASS | PASS (harm awareness added) | PASS (repeated_trust_damage validated) |
| 5 | Demoniseert afhankelijke niet | PASS | PASS | PASS (no "pathological liar" label) |
| 6 | Forceert geen verbinding bij safety | PASS | PASS | PASS (coercive_or_dangerous = safety-first) |
| 7 | Forceert geen perspectief bij RELATIONAL_HARM_PATTERN | PASS | PASS (explicit: "Do NOT start with perspective-taking") | PASS (explicit: "Do NOT start with maybe they lied from shame") |
| 8 | Herstelvoorwaarden bij herhaald vertrouwenstrauma | N/A (not trust module) | PASS (repair conditions mentioned) | PASS (explicit template with repair conditions) |
| 9 | K05 bridge/repair path bij gewone frictie | NEEDS PATCH | NEEDS PATCH | NEEDS PATCH |
| 10 | Geen vaste persoonsnamen | PASS | PASS | PASS |
| 11 | Geen diagnose of label | PASS | PASS | PASS |

## Findings

### ROL-K01 — Rolverwarring

**Status: MOSTLY COMPLIANT — 1 gap**

The prompt correctly:
- Validates suppressed emotions without shame
- Does not blame the caregiver for the care role
- Does not tell caregiver to "just relax"
- Does not make the loved one responsible for Kim's regulation
- Does not pressure forgiveness/separation

**Gap (criterion 9):** No explicit instruction for K05 bridge/repair path at normal friction. The prompt focuses on emotion validation but does not include a connection question or repair path when the user mentions a boundary without bridge.

**NOT problematic (no patch needed for criteria 1-8, 10-11):**
- Does NOT frame as "jij bent de redder" or "jij houdt dit in stand"
- Does NOT use fixed person names
- Does NOT diagnose

### VETR02-K — Vertrouwensherstel bij afwezigheid

**Status: MOSTLY COMPLIANT — 1 gap**

The prompt correctly:
- Has RELATIONAL HARM AWARENESS section
- Does NOT minimize patterns
- Does NOT start with perspective-taking at repeated trust damage
- Validates hypervigilance as normal protective response
- Mentions repair conditions

**Gap (criterion 9):** No explicit K05 bridge/repair path instruction for normal friction (single absence without pattern). The prompt handles harm patterns well but doesn't explicitly require a connection question at normal friction.

### LEUGEN-K01 — Leugens en vertrouwensbreuk

**Status: MOSTLY COMPLIANT — 1 gap**

The prompt correctly:
- Has 5-category lie classification
- Does NOT fill in intent at "unknown"
- Activates harm-layer at repeated_trust_damage
- Activates safety-first at coercive_or_dangerous_lie
- Shows impact first at shame_avoidance_lie, then cautious perspective
- Does NOT excuse lying
- Does NOT demonize ("pathological liar" is forbidden)
- Does NOT absolutely acquit the caregiver
- Has explicit repair condition template

**Gap (criterion 9):** No explicit K05 bridge/repair path instruction for single_lie_low_harm (normal friction). At low-harm lies, the prompt allows perspective opening but doesn't require a connection question or repair path.

## Recommended Patches

All three modules need a small addition: a RELATIONAL CONNECTION CHECK section that requires:
- At normal friction: connection question or bridge sentence
- At RELATIONAL_HARM_PATTERN: repair conditions first (already present in VETR02-K and LEUGEN-K01)
- At safety: safety first (already present)

This is a minor addition, not a rewrite. The modules are already largely compliant with the new stance.
