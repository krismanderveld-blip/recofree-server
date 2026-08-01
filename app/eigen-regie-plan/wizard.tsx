/**
 * KERP01 — Eigen Regie Plan Wizard
 *
 * Multi-step wizard that guides the user through building their plan:
 * 1. Intro + source selection (manual / AI-generated from backpack)
 * 2. Per-zone: signals, body signals, thoughts, behaviour
 * 3. Per-zone: what helps, boundary actions
 * 4. Per-zone: anchor sentence
 * 5. Triggers & boundary rules
 * 6. Main anchor sentence
 * 7. Review & confirm
 */

import { useState, useCallback } from 'react';
import { Text, View, ScrollView, TextInput, Pressable, Platform, StyleSheet, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { colors as dc } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import type { EigenRegiePlan, EigenRegieZoneId, EigenRegieZoneEntry, EigenRegieTrigger } from '@/lib/engine/kim/kerp01-types';
import { DEFAULT_EIGEN_REGIE_PLAN } from '@/lib/engine/kim/kerp01-types';
import { callGenerateEigenRegiePlan, convertProposalToPlan } from '@/lib/engine/kim/kerp01-generate-client';

const ZONES: { id: EigenRegieZoneId; color: string; emoji: string; label: string; description: string }[] = [
  { id: 'donkergroen', color: '#16A34A', emoji: '🌿', label: 'Vrij van verslaving', description: 'Stabiel, geen drang. Hoe voelt dat voor jou?' },
  { id: 'lichtgroen', color: '#4ADE80', emoji: '🌱', label: 'Terug naar verslaving', description: 'Eerste subtiele signalen. Wat merk je als eerste?' },
  { id: 'geel', color: '#EAB308', emoji: '⚖️', label: 'Wisselzone', description: 'Spanning tussen oud en nieuw. Wat doe je dan?' },
  { id: 'oranje', color: '#F97316', emoji: '🔥', label: 'Rond de ander', description: 'Relaties triggeren. Welke patronen herken je?' },
  { id: 'rood', color: '#EF4444', emoji: '🚨', label: 'Verlies van regie', description: 'Hoog risico. Wat heb je dan nodig?' },
];

type WizardStep =
  | { type: 'intro' }
  | { type: 'zone_signals'; zoneIndex: number }
  | { type: 'zone_helps'; zoneIndex: number }
  | { type: 'zone_anchor'; zoneIndex: number }
  | { type: 'triggers' }
  | { type: 'main_anchor' }
  | { type: 'review' };

function getStepSequence(): WizardStep[] {
  const steps: WizardStep[] = [{ type: 'intro' }];
  for (let i = 0; i < 5; i++) {
    steps.push({ type: 'zone_signals', zoneIndex: i });
    steps.push({ type: 'zone_helps', zoneIndex: i });
    steps.push({ type: 'zone_anchor', zoneIndex: i });
  }
  steps.push({ type: 'triggers' });
  steps.push({ type: 'main_anchor' });
  steps.push({ type: 'review' });
  return steps;
}

const STEPS = getStepSequence();

export default function WizardScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { updateEigenRegiePlan, getEigenRegiePlan, getBackpack } = useUser();
  const existingPlan = getEigenRegiePlan();

  const [stepIndex, setStepIndex] = useState(0);
  const [plan, setPlan] = useState<EigenRegiePlan>(existingPlan ?? { ...DEFAULT_EIGEN_REGIE_PLAN });

  // AI generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isAiGenerated, setIsAiGenerated] = useState(false);

  // Temp state for current inputs
  const [tempSignals, setTempSignals] = useState('');
  const [tempBodySignals, setTempBodySignals] = useState('');
  const [tempThoughts, setTempThoughts] = useState('');
  const [tempBehaviour, setTempBehaviour] = useState('');
  const [tempWhatHelps, setTempWhatHelps] = useState('');
  const [tempBoundaryActions, setTempBoundaryActions] = useState('');
  const [tempAnchor, setTempAnchor] = useState('');
  const [tempMainAnchor, setTempMainAnchor] = useState(plan.mainAnchorSentence);
  const [tempTrigger, setTempTrigger] = useState('');
  const [tempHealthyResponse, setTempHealthyResponse] = useState('');
  const [tempRule, setTempRule] = useState('');

  const currentStep = STEPS[stepIndex];
  const totalSteps = STEPS.length;
  const progress = (stepIndex + 1) / totalSteps;

  const loadZoneForEditing = useCallback((zoneIndex: number) => {
    const zoneId = ZONES[zoneIndex].id;
    const entry = plan.zones[zoneId];
    setTempSignals(entry.signals.join('\n'));
    setTempBodySignals(entry.bodySignals.join('\n'));
    setTempThoughts(entry.thoughts.join('\n'));
    setTempBehaviour(entry.behaviour.join('\n'));
    setTempWhatHelps(entry.whatHelps.join('\n'));
    setTempBoundaryActions(entry.boundaryActions.join('\n'));
    setTempAnchor(entry.anchorSentence);
  }, [plan]);

  const saveZoneSignals = useCallback((zoneIndex: number) => {
    const zoneId = ZONES[zoneIndex].id;
    const entry = plan.zones[zoneId];
    const updated: EigenRegieZoneEntry = {
      ...entry,
      signals: tempSignals.split('\n').map(s => s.trim()).filter(Boolean),
      bodySignals: tempBodySignals.split('\n').map(s => s.trim()).filter(Boolean),
      thoughts: tempThoughts.split('\n').map(s => s.trim()).filter(Boolean),
      behaviour: tempBehaviour.split('\n').map(s => s.trim()).filter(Boolean),
    };
    setPlan(prev => ({ ...prev, zones: { ...prev.zones, [zoneId]: updated } }));
  }, [plan, tempSignals, tempBodySignals, tempThoughts, tempBehaviour]);

  const saveZoneHelps = useCallback((zoneIndex: number) => {
    const zoneId = ZONES[zoneIndex].id;
    const entry = plan.zones[zoneId];
    const updated: EigenRegieZoneEntry = {
      ...entry,
      whatHelps: tempWhatHelps.split('\n').map(s => s.trim()).filter(Boolean),
      boundaryActions: tempBoundaryActions.split('\n').map(s => s.trim()).filter(Boolean),
    };
    setPlan(prev => ({ ...prev, zones: { ...prev.zones, [zoneId]: updated } }));
  }, [plan, tempWhatHelps, tempBoundaryActions]);

  const saveZoneAnchor = useCallback((zoneIndex: number) => {
    const zoneId = ZONES[zoneIndex].id;
    const entry = plan.zones[zoneId];
    const updated: EigenRegieZoneEntry = { ...entry, anchorSentence: tempAnchor.trim() };
    setPlan(prev => ({ ...prev, zones: { ...prev.zones, [zoneId]: updated } }));
  }, [plan, tempAnchor]);

  // ─── AI Generation ──────────────────────────────────────────────
  const handleAIGenerate = useCallback(async () => {
    const backpack = getBackpack();
    if (!backpack?.kimBackpack) {
      setGenerateError('Geen levensverhaal gevonden. Vul eerst je rugzak in.');
      return;
    }

    const kimSections = backpack.kimBackpack;
    const lifeStorySections = [
      { title: 'Mijn verhaal', content: kimSections.my_story || '' },
      { title: 'De relatie', content: kimSections.the_relationship || '' },
      { title: 'De impact', content: kimSections.the_impact || '' },
      { title: 'Mijn grenzen', content: kimSections.my_boundaries || '' },
      { title: 'Mijn kracht', content: kimSections.my_strength || '' },
    ].filter(s => s.content.trim().length > 0);

    if (lifeStorySections.length === 0) {
      setGenerateError('Geen levensverhaal gevonden. Vul eerst je rugzak in.');
      return;
    }

    // Gather known patterns from extracted entities if available
    const knownTriggers: string[] = [];
    const knownPatterns: string[] = [];

    const entities = (backpack as unknown as Record<string, unknown>)['extractedEntities'] as
      | { patterns?: Array<{ description: string }>; events?: Array<{ description: string; isTriggerSource?: boolean }> }
      | undefined;

    if (entities?.patterns) {
      for (const p of entities.patterns) {
        knownPatterns.push(p.description);
      }
    }
    if (entities?.events) {
      for (const e of entities.events) {
        if (e.isTriggerSource) {
          knownTriggers.push(e.description);
        }
      }
    }

    setIsGenerating(true);
    setGenerateError(null);

    if (Platform.OS !== 'web') {
      const Haptics = require('expo-haptics');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const result = await callGenerateEigenRegiePlan({
        lifeStorySections,
        knownTriggers: knownTriggers.length > 0 ? knownTriggers : undefined,
        knownPatterns: knownPatterns.length > 0 ? knownPatterns : undefined,
        intakeContext: backpack.intakeContext?.initialContext || undefined,
        userName: undefined, // Privacy: don't send name to LLM
        language: 'nl',
      });

      if (!result.success) {
        setGenerateError(result.error || 'Generatie mislukt. Probeer opnieuw.');
        return;
      }

      const proposedPlan = convertProposalToPlan(result);
      if (!proposedPlan || !proposedPlan.zones) {
        setGenerateError('AI gaf een onvolledig plan terug. Probeer opnieuw of vul handmatig in.');
        return;
      }

      // Merge AI proposals into the plan state
      setPlan(prev => ({
        ...prev,
        zones: proposedPlan.zones ?? prev.zones,
        triggers: proposedPlan.triggers ?? prev.triggers,
        boundaryRules: proposedPlan.boundaryRules ?? prev.boundaryRules,
        mainAnchorSentence: proposedPlan.mainAnchorSentence ?? prev.mainAnchorSentence,
      }));
      setTempMainAnchor(proposedPlan.mainAnchorSentence ?? '');
      setIsAiGenerated(true);

      if (Platform.OS !== 'web') {
        const Haptics = require('expo-haptics');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGenerateError(`Fout: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  }, [getBackpack]);

  const handleNext = useCallback(() => {
    // Save current step data
    if (currentStep.type === 'zone_signals') saveZoneSignals(currentStep.zoneIndex);
    if (currentStep.type === 'zone_helps') saveZoneHelps(currentStep.zoneIndex);
    if (currentStep.type === 'zone_anchor') saveZoneAnchor(currentStep.zoneIndex);
    if (currentStep.type === 'main_anchor') setPlan(prev => ({ ...prev, mainAnchorSentence: tempMainAnchor.trim() }));

    const nextIndex = stepIndex + 1;
    if (nextIndex >= STEPS.length) return;

    // Pre-load next step data
    const nextStep = STEPS[nextIndex];
    if (nextStep.type === 'zone_signals' || nextStep.type === 'zone_helps' || nextStep.type === 'zone_anchor') {
      loadZoneForEditing(nextStep.zoneIndex);
    }

    setStepIndex(nextIndex);
  }, [currentStep, stepIndex, saveZoneSignals, saveZoneHelps, saveZoneAnchor, tempMainAnchor, loadZoneForEditing]);

  const handleBack = useCallback(() => {
    if (stepIndex === 0) {
      router.back();
      return;
    }
    // Save current step data before going back
    if (currentStep.type === 'zone_signals') saveZoneSignals(currentStep.zoneIndex);
    if (currentStep.type === 'zone_helps') saveZoneHelps(currentStep.zoneIndex);
    if (currentStep.type === 'zone_anchor') saveZoneAnchor(currentStep.zoneIndex);

    const prevIndex = stepIndex - 1;
    const prevStep = STEPS[prevIndex];
    if (prevStep.type === 'zone_signals' || prevStep.type === 'zone_helps' || prevStep.type === 'zone_anchor') {
      loadZoneForEditing(prevStep.zoneIndex);
    }
    setStepIndex(prevIndex);
  }, [stepIndex, currentStep, saveZoneSignals, saveZoneHelps, saveZoneAnchor, loadZoneForEditing, router]);

  const handleFinish = useCallback(async () => {
    const finalPlan: EigenRegiePlan = {
      ...plan,
      mainAnchorSentence: tempMainAnchor.trim(),
      lastUpdated: new Date().toISOString(),
      source: {
        createdFrom: isAiGenerated ? 'life_story_wizard' : 'wizard',
        usedBackpackSections: isAiGenerated
          ? ['my_story', 'the_relationship', 'the_impact', 'my_boundaries', 'my_strength']
          : [],
        generatedAt: new Date().toISOString(),
        userReviewed: true,
      },
    };
    await updateEigenRegiePlan(finalPlan);
    if (Platform.OS !== 'web') {
      const Haptics = require('expo-haptics');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.back();
  }, [plan, tempMainAnchor, updateEigenRegiePlan, router, isAiGenerated]);

  const addTrigger = useCallback(() => {
    const text = tempTrigger.trim();
    if (!text) return;
    const trigger: EigenRegieTrigger = {
      trigger: text,
      lossOfRegiePattern: 'Nog te beschrijven',
      healthyResponse: tempHealthyResponse.trim() || 'Nog niet ingevuld',
    };
    setPlan(prev => ({ ...prev, triggers: [...prev.triggers, trigger] }));
    setTempTrigger('');
    setTempHealthyResponse('');
  }, [tempTrigger, tempHealthyResponse]);

  const addRule = useCallback(() => {
    const text = tempRule.trim();
    if (!text) return;
    setPlan(prev => ({ ...prev, boundaryRules: [...prev.boundaryRules, text] }));
    setTempRule('');
  }, [tempRule]);

  // ─── Render Steps ──────────────────────────────────────────

  const renderIntro = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepEmoji, { fontSize: 48 }]}>📋</Text>
      <Text style={[styles.stepTitle, { color: dc.textPrimary }]}>{t('kerp.wizard.title')}</Text>
      <Text style={[styles.stepDescription, { color: dc.textSecondary }]}>
        In de volgende stappen bouw je stap voor stap jouw persoonlijke plan op.{'\n\n'}
        Per zone vul je in:{'\n'}
        • Welke signalen je herkent{'\n'}
        • Wat je helpt om regie te houden{'\n'}
        • Een ankerzin die je kracht geeft{'\n\n'}
        Je kunt altijd later nog aanpassen.
      </Text>

      {/* AI Generation Button */}
      <View style={styles.aiSection}>
        <Pressable
          onPress={handleAIGenerate}
          disabled={isGenerating}
          style={({ pressed }) => [
            styles.aiButton,
            { opacity: pressed || isGenerating ? 0.7 : 1 },
          ]}
        >
          {isGenerating ? (
            <View style={styles.aiButtonContent}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.aiButtonText}>{t('kerp.wizard.generating')}</Text>
            </View>
          ) : (
            <View style={styles.aiButtonContent}>
              <Text style={{ fontSize: 20 }}>✨</Text>
              <Text style={styles.aiButtonText}>{t('kerp.wizard.ai_generate')}</Text>
            </View>
          )}
        </Pressable>
        <Text style={[styles.aiHint, { color: dc.textTertiary }]}>
          Genereert een voorstel op basis van je levensverhaal. Je kunt alles nog aanpassen.
        </Text>
        {generateError && (
          <Text style={styles.aiError}>{generateError}</Text>
        )}
        {isAiGenerated && !generateError && (
          <View style={styles.aiSuccessBanner}>
            <Text style={styles.aiSuccessText}>
              ✓ Plan gegenereerd — controleer en pas aan in de volgende stappen
            </Text>
          </View>
        )}
      </View>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={[styles.dividerText, { color: dc.textTertiary }]}>{t('kerp.wizard.or')}</Text>
        <View style={styles.dividerLine} />
      </View>

      <Text style={[styles.manualHint, { color: dc.textSecondary }]}>
        Druk op "Volgende" om handmatig stap voor stap in te vullen.
      </Text>
    </View>
  );

  const renderZoneSignals = (zoneIndex: number) => {
    const zone = ZONES[zoneIndex];
    return (
      <View style={styles.stepContent}>
        <View style={[styles.zoneBadge, { backgroundColor: zone.color }]}>
          <Text style={{ fontSize: 24 }}>{zone.emoji}</Text>
          <Text style={styles.zoneBadgeText}>{zone.label}</Text>
        </View>
        {isAiGenerated && (
          <View style={styles.aiNotice}>
            <Text style={styles.aiNoticeText}>{t('kerp.wizard.ai_notice')}</Text>
          </View>
        )}
        <Text style={[styles.stepDescription, { color: dc.textSecondary }]}>{zone.description}</Text>
        <Text style={[styles.fieldLabel, { color: dc.textPrimary }]}>{t('kerp.wizard.signals')}</Text>
        <TextInput
          value={tempSignals}
          onChangeText={setTempSignals}
          placeholder="Bijv. onrust, slecht slapen..."
          placeholderTextColor={dc.textTertiary}
          style={[styles.textArea, { color: dc.textPrimary }]}
          multiline
        />
        <Text style={[styles.fieldLabel, { color: dc.textPrimary }]}>{t('kerp.wizard.body_signals')}</Text>
        <TextInput
          value={tempBodySignals}
          onChangeText={setTempBodySignals}
          placeholder="Bijv. spanning in schouders..."
          placeholderTextColor={dc.textTertiary}
          style={[styles.textArea, { color: dc.textPrimary }]}
          multiline
        />
        <Text style={[styles.fieldLabel, { color: dc.textPrimary }]}>{t('kerp.wizard.thoughts')}</Text>
        <TextInput
          value={tempThoughts}
          onChangeText={setTempThoughts}
          placeholder="Bijv. 'Eén keer kan geen kwaad'..."
          placeholderTextColor={dc.textTertiary}
          style={[styles.textArea, { color: dc.textPrimary }]}
          multiline
        />
        <Text style={[styles.fieldLabel, { color: dc.textPrimary }]}>{t('kerp.wizard.behaviour')}</Text>
        <TextInput
          value={tempBehaviour}
          onChangeText={setTempBehaviour}
          placeholder="Bijv. terugtrekken, sneller boos..."
          placeholderTextColor={dc.textTertiary}
          style={[styles.textArea, { color: dc.textPrimary }]}
          multiline
        />
      </View>
    );
  };

  const renderZoneHelps = (zoneIndex: number) => {
    const zone = ZONES[zoneIndex];
    return (
      <View style={styles.stepContent}>
        <View style={[styles.zoneBadge, { backgroundColor: zone.color }]}>
          <Text style={{ fontSize: 24 }}>{zone.emoji}</Text>
          <Text style={styles.zoneBadgeText}>{zone.label} — Wat helpt</Text>
        </View>
        {isAiGenerated && (
          <View style={styles.aiNotice}>
            <Text style={styles.aiNoticeText}>{t('kerp.wizard.ai_notice')}</Text>
          </View>
        )}
        <Text style={[styles.fieldLabel, { color: dc.textPrimary }]}>{t('kerp.wizard.what_helps')}</Text>
        <TextInput
          value={tempWhatHelps}
          onChangeText={setTempWhatHelps}
          placeholder="Bijv. wandelen, bellen met vriend..."
          placeholderTextColor={dc.textTertiary}
          style={[styles.textArea, { color: dc.textPrimary }]}
          multiline
        />
        <Text style={[styles.fieldLabel, { color: dc.textPrimary }]}>{t('kerp.wizard.boundary_actions')}</Text>
        <TextInput
          value={tempBoundaryActions}
          onChangeText={setTempBoundaryActions}
          placeholder="Bijv. situatie verlaten, nee zeggen..."
          placeholderTextColor={dc.textTertiary}
          style={[styles.textArea, { color: dc.textPrimary }]}
          multiline
        />
      </View>
    );
  };

  const renderZoneAnchor = (zoneIndex: number) => {
    const zone = ZONES[zoneIndex];
    return (
      <View style={styles.stepContent}>
        <View style={[styles.zoneBadge, { backgroundColor: zone.color }]}>
          <Text style={{ fontSize: 24 }}>{zone.emoji}</Text>
          <Text style={styles.zoneBadgeText}>{zone.label} — Ankerzin</Text>
        </View>
        {isAiGenerated && (
          <View style={styles.aiNotice}>
            <Text style={styles.aiNoticeText}>{t('kerp.wizard.ai_notice')}</Text>
          </View>
        )}
        <Text style={[styles.stepDescription, { color: dc.textSecondary }]}>
          Eén zin die je herinnert aan je kracht als je in deze zone bent.
        </Text>
        <TextInput
          value={tempAnchor}
          onChangeText={setTempAnchor}
          placeholder="Bijv. 'Ik kies voor mezelf, ook als het moeilijk is'"
          placeholderTextColor={dc.textTertiary}
          style={[styles.input, { color: dc.textPrimary }]}
          returnKeyType="done"
        />
      </View>
    );
  };

  const renderTriggers = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: dc.textPrimary }]}>{t('kerp.wizard.triggers_title')}</Text>
      {isAiGenerated && (
        <View style={styles.aiNotice}>
          <Text style={styles.aiNoticeText}>{t('kerp.wizard.ai_notice')}</Text>
        </View>
      )}
      <Text style={[styles.stepDescription, { color: dc.textSecondary }]}>
        Wat trekt je richting oud gedrag? En welke afspraken maak je met jezelf?
      </Text>

      {/* Existing triggers */}
      {plan.triggers.map((t, idx) => (
        <View key={idx} style={styles.triggerItem}>
          <Text style={[styles.triggerText, { color: dc.textPrimary }]}>• {t.trigger}</Text>
          {t.healthyResponse !== 'Nog niet ingevuld' && (
            <Text style={[styles.counterText, { color: dc.textSecondary }]}>  ↩ {t.healthyResponse}</Text>
          )}
        </View>
      ))}

      {/* Add trigger */}
      <TextInput
        value={tempTrigger}
        onChangeText={setTempTrigger}
        placeholder="Beschrijf een trigger..."
        placeholderTextColor={dc.textTertiary}
        style={[styles.input, { color: dc.textPrimary, marginTop: 12 }]}
        returnKeyType="next"
      />
      <TextInput
        value={tempHealthyResponse}
        onChangeText={setTempHealthyResponse}
        placeholder="Gezonde reactie (optioneel)..."
        placeholderTextColor={dc.textTertiary}
        style={[styles.input, { color: dc.textPrimary, marginTop: 8 }]}
        returnKeyType="done"
        onSubmitEditing={addTrigger}
      />
      <Pressable onPress={addTrigger} style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]}>
        <Text style={{ color: dc.primary, fontWeight: '600' }}>{t('kerp.wizard.add_trigger')}</Text>
      </Pressable>

      {/* Boundary rules */}
      <Text style={[styles.fieldLabel, { color: dc.textPrimary, marginTop: 20 }]}>{t('kerp.wizard.boundary_rules')}</Text>
      {plan.boundaryRules.map((r, idx) => (
        <Text key={idx} style={[styles.ruleText, { color: dc.textPrimary }]}>• {r}</Text>
      ))}
      <TextInput
        value={tempRule}
        onChangeText={setTempRule}
        placeholder="Bijv. 'Ik drink niet als ik alleen ben'"
        placeholderTextColor={dc.textTertiary}
        style={[styles.input, { color: dc.textPrimary, marginTop: 8 }]}
        returnKeyType="done"
        onSubmitEditing={addRule}
      />
      <Pressable onPress={addRule} style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]}>
        <Text style={{ color: dc.primary, fontWeight: '600' }}>{t('kerp.wizard.add_rule')}</Text>
      </Pressable>
    </View>
  );

  const renderMainAnchor = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepEmoji, { fontSize: 48 }]}>⚓</Text>
      <Text style={[styles.stepTitle, { color: dc.textPrimary }]}>{t('kerp.wizard.anchor_title')}</Text>
      {isAiGenerated && (
        <View style={styles.aiNotice}>
          <Text style={styles.aiNoticeText}>{t('kerp.wizard.ai_notice')}</Text>
        </View>
      )}
      <Text style={[styles.stepDescription, { color: dc.textSecondary }]}>
        Eén zin die alles samenvat. Je kompas als het moeilijk wordt.
      </Text>
      <TextInput
        value={tempMainAnchor}
        onChangeText={setTempMainAnchor}
        placeholder="Bijv. 'Ik verdien een leven zonder verslaving'"
        placeholderTextColor={dc.textTertiary}
        style={[styles.input, { color: dc.textPrimary, fontSize: 16 }]}
        returnKeyType="done"
      />
    </View>
  );

  const renderReview = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepEmoji, { fontSize: 48 }]}>✅</Text>
      <Text style={[styles.stepTitle, { color: dc.textPrimary }]}>{t('kerp.wizard.done_title')}</Text>
      <Text style={[styles.stepDescription, { color: dc.textSecondary }]}>
        Je Eigen Regie Plan is opgebouwd.{isAiGenerated ? ' AI heeft je geholpen — je hebt alles kunnen controleren.' : ''} Je kunt het altijd later aanpassen.
      </Text>
      {plan.mainAnchorSentence || tempMainAnchor ? (
        <View style={[styles.reviewAnchor, { backgroundColor: dc.surfaceKim }]}>
          <Text style={[styles.reviewAnchorLabel, { color: dc.textTertiary }]}>{t('kerp.wizard.your_anchor')}</Text>
          <Text style={[styles.reviewAnchorText, { color: dc.primary }]}>
            "{tempMainAnchor || plan.mainAnchorSentence}"
          </Text>
        </View>
      ) : null}
      <View style={styles.reviewStats}>
        {ZONES.map(zone => {
          const entry = plan.zones[zone.id];
          const count = entry.signals.length + entry.whatHelps.length;
          return (
            <View key={zone.id} style={[styles.reviewZone, { borderLeftColor: zone.color }]}>
              <Text style={{ fontSize: 16 }}>{zone.emoji}</Text>
              <Text style={[styles.reviewZoneText, { color: dc.textPrimary }]}>{zone.label}</Text>
              <Text style={[styles.reviewZoneCount, { color: dc.textTertiary }]}>{count} items</Text>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep.type) {
      case 'intro': return renderIntro();
      case 'zone_signals': return renderZoneSignals(currentStep.zoneIndex);
      case 'zone_helps': return renderZoneHelps(currentStep.zoneIndex);
      case 'zone_anchor': return renderZoneAnchor(currentStep.zoneIndex);
      case 'triggers': return renderTriggers();
      case 'main_anchor': return renderMainAnchor();
      case 'review': return renderReview();
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: dc.primary }]} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {renderCurrentStep()}
        </ScrollView>

        {/* Navigation */}
        <View style={styles.navBar}>
          <Pressable onPress={handleBack} style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.navBtnText, { color: dc.textSecondary }]}>
              {stepIndex === 0 ? 'Annuleren' : '← Vorige'}
            </Text>
          </Pressable>

          {currentStep.type === 'review' ? (
            <Pressable onPress={handleFinish} style={({ pressed }) => [styles.navBtnPrimary, { backgroundColor: dc.primary, opacity: pressed ? 0.9 : 1 }]}>
              <Text style={styles.navBtnPrimaryText}>{t('kerp.wizard.save_plan')}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={handleNext} style={({ pressed }) => [styles.navBtnPrimary, { backgroundColor: dc.primary, opacity: pressed ? 0.9 : 1 }]}>
              <Text style={styles.navBtnPrimaryText}>{t('kerp.wizard.next')}</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  progressBar: { height: 4, backgroundColor: '#e0e0e0' },
  progressFill: { height: 4, borderRadius: 2 },
  stepContent: { paddingTop: 20 },
  stepEmoji: { textAlign: 'center', marginBottom: 12 },
  stepTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  stepDescription: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 20 },
  zoneBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginBottom: 12, alignSelf: 'flex-start' },
  zoneBadgeText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  textArea: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 14, minHeight: 44 },
  triggerItem: { marginBottom: 6 },
  triggerText: { fontSize: 14 },
  counterText: { fontSize: 12 },
  ruleText: { fontSize: 14, marginBottom: 4 },
  addBtn: { paddingVertical: 8, marginTop: 8 },
  reviewAnchor: { padding: 16, borderRadius: 12, marginBottom: 16 },
  reviewAnchorLabel: { fontSize: 12, marginBottom: 4 },
  reviewAnchorText: { fontSize: 16, fontWeight: '600', fontStyle: 'italic' },
  reviewStats: { gap: 8 },
  reviewZone: { flexDirection: 'row', alignItems: 'center', gap: 10, borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 8 },
  reviewZoneText: { flex: 1, fontSize: 14, fontWeight: '500' },
  reviewZoneCount: { fontSize: 12 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fff' },
  navBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  navBtnText: { fontSize: 15, fontWeight: '500' },
  navBtnPrimary: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  navBtnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  // AI generation styles
  aiSection: { marginTop: 24, marginBottom: 8 },
  aiButton: { backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' },
  aiButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  aiHint: { fontSize: 12, textAlign: 'center', marginTop: 8 },
  aiError: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 8 },
  aiSuccessBanner: { backgroundColor: '#ECFDF5', borderRadius: 8, padding: 12, marginTop: 10 },
  aiSuccessText: { color: '#059669', fontSize: 13, fontWeight: '500', textAlign: 'center' },
  aiNotice: { backgroundColor: '#EEF2FF', borderRadius: 8, padding: 8, marginBottom: 12 },
  aiNoticeText: { color: '#4F46E5', fontSize: 12, fontWeight: '500', textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e0e0e0' },
  dividerText: { fontSize: 13 },
  manualHint: { fontSize: 13, textAlign: 'center' },
});
