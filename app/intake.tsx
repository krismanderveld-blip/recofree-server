import { useState } from 'react';
import {
  Text,
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import type { UserType, UrgencyLevel, StageOfChange, EigenRegieLevel } from '@/lib/ai/types';
import { STAGE_OF_CHANGE_OPTIONS, EIGEN_REGIE_INTAKE_OPTIONS } from '@/lib/ai/types';

type IntakeStep = 1 | 2 | 3;

const URGENCY_LEVELS: { label: string; value: UrgencyLevel; description: string }[] = [
  { label: 'Low', value: 'laag', description: 'I want to explore at my own pace' },
  { label: 'Medium', value: 'midden', description: 'I could use some support' },
  { label: 'High', value: 'hoog', description: 'I need help right now' },
];

/** Zone colors for Eigen Regie intake options */
const EIGEN_REGIE_ZONE_COLORS: Record<string, string> = {
  ROOD: '#EF4444',
  ORANJE: '#F97316',
  GEEL: '#F59E0B',
  'LICHT GROEN': '#84CC16',
  'DONKER GROEN': '#22C55E',
};

export default function IntakeScreen() {
  const router = useRouter();
  const { completeIntake } = useUser();

  const [step, setStep] = useState<IntakeStep>(1);
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<UserType | null>(null);
  // Elias only
  const [stageOfChange, setStageOfChange] = useState<StageOfChange | null>(null);
  // Kim only
  const [eigenRegieLevel, setEigenRegieLevel] = useState<EigenRegieLevel | null>(null);
  const [urgency, setUrgency] = useState<UrgencyLevel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isKim = selectedType === 'kim';
  const canProceedStep1 = name.trim().length >= 2 && selectedType !== null;
  const canProceedStep2 = isKim ? eigenRegieLevel !== null : stageOfChange !== null;
  const canSubmit = urgency !== null;

  const handleNext = () => {
    if (step < 3) setStep((step + 1) as IntakeStep);
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as IntakeStep);
  };

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting || !selectedType || !urgency) return;
    if (!isKim && !stageOfChange) return;
    if (isKim && !eigenRegieLevel) return;
    setIsSubmitting(true);
    try {
      await completeIntake({
        userName: name.trim(),
        userType: selectedType,
        stageOfChange: isKim ? null : stageOfChange,
        eigenRegieLevel: isKim ? eigenRegieLevel : null,
        startEmotion: '',
        urgency,
        initialContext: '',
      });
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Intake error:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pt-12 pb-8">
            {/* Progress Indicator */}
            <View className="flex-row mb-8 gap-2">
              {[1, 2, 3].map((s) => (
                <View
                  key={s}
                  className={`flex-1 h-1 rounded-full ${
                    s <= step ? 'bg-primary' : 'bg-border'
                  }`}
                />
              ))}
            </View>

            {/* Step 1: Name + User Type */}
            {step === 1 && (
              <View className="flex-1">
                <View className="items-center mb-8">
                  <Text className="text-5xl mb-3">💙</Text>
                  <Text className="text-2xl font-bold text-foreground text-center">
                    Welcome to RecoFree
                  </Text>
                  <Text className="text-base text-muted text-center mt-2 leading-relaxed">
                    A safe space for recovery and growth
                  </Text>
                </View>

                <View className="mb-6">
                  <Text className="text-sm font-semibold text-muted mb-2 uppercase tracking-wide">
                    What should I call you?
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-2xl px-4 py-4 text-base text-foreground"
                    placeholder="Your first name"
                    placeholderTextColor="#9E9E9E"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    returnKeyType="done"
                    maxLength={30}
                  />
                </View>

                <View className="mb-6">
                  <Text className="text-sm font-semibold text-muted mb-3 uppercase tracking-wide">
                    Which describes you best?
                  </Text>

                  <Pressable
                    onPress={() => setSelectedType('elias')}
                    style={({ pressed }) => [
                      { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                    ]}
                  >
                    <View
                      className={`rounded-2xl p-5 mb-3 border-2 ${
                        selectedType === 'elias'
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-surface'
                      }`}
                    >
                      <Text className="text-lg font-bold text-foreground mb-1">
                        I have an addiction myself
                      </Text>
                      <Text className="text-sm text-muted leading-relaxed">
                        You'll be supported by Elias — direct, honest support for your recovery — from someone who gets it.
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => setSelectedType('kim')}
                    style={({ pressed }) => [
                      { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                    ]}
                  >
                    <View
                      className={`rounded-2xl p-5 border-2 ${
                        selectedType === 'kim'
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-surface'
                      }`}
                    >
                      <Text className="text-lg font-bold text-foreground mb-1">
                        I'm a loved one of someone
                      </Text>
                      <Text className="text-sm text-muted leading-relaxed">
                        You'll be supported by Kim — a direct, honest companion for your well-being.
                      </Text>
                    </View>
                  </Pressable>
                </View>

                <View className="mt-auto">
                  <Pressable
                    onPress={handleNext}
                    disabled={!canProceedStep1}
                    style={({ pressed }) => [
                      {
                        opacity: !canProceedStep1 ? 0.4 : pressed ? 0.85 : 1,
                        transform: [{ scale: pressed && canProceedStep1 ? 0.97 : 1 }],
                      },
                    ]}
                  >
                    <View className="bg-primary rounded-2xl py-4 items-center">
                      <Text className="text-white text-lg font-bold">Next</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Step 2: Stage of Change (Elias) OR Eigen Regie (Kim) */}
            {step === 2 && (
              <View className="flex-1">
                {isKim ? (
                  <>
                    {/* Kim: Eigen Regie */}
                    <Text className="text-2xl font-bold text-foreground mb-2">
                      In hoeverre wordt jouw leven momenteel bepaald door de ander?
                    </Text>
                    <Text className="text-base text-muted mb-6 leading-relaxed">
                      Dit helpt Kim begrijpen hoe je er nu voor staat.
                    </Text>

                    <View className="gap-3 mb-8">
                      {EIGEN_REGIE_INTAKE_OPTIONS.map((option) => {
                        const zoneColor = EIGEN_REGIE_ZONE_COLORS[option.zone] ?? '#9BA1A6';
                        const isSelected = eigenRegieLevel === option.value;
                        return (
                          <Pressable
                            key={option.value}
                            onPress={() => setEigenRegieLevel(option.value)}
                            style={({ pressed }) => [
                              { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                            ]}
                          >
                            <View
                              className="rounded-2xl p-5"
                              style={{
                                borderWidth: 2,
                                borderColor: isSelected ? zoneColor : '#E5E7EB',
                                backgroundColor: isSelected ? zoneColor + '10' : undefined,
                              }}
                            >
                              <View className="flex-row items-center gap-3 mb-1">
                                <View
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: zoneColor }}
                                />
                                <Text
                                  className="text-xs font-bold uppercase tracking-wide"
                                  style={{ color: zoneColor }}
                                >
                                  {option.zone}
                                </Text>
                              </View>
                              <Text className="text-base text-foreground leading-relaxed">
                                {option.label}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <>
                    {/* Elias: Stage of Change */}
                    <Text className="text-2xl font-bold text-foreground mb-2">
                      Where are you in your journey?
                    </Text>
                    <Text className="text-base text-muted mb-6 leading-relaxed">
                      This helps Elias understand how to best support you.
                    </Text>

                    <View className="gap-3 mb-8">
                      {STAGE_OF_CHANGE_OPTIONS.map((option) => (
                        <Pressable
                          key={option.value}
                          onPress={() => setStageOfChange(option.value)}
                          style={({ pressed }) => [
                            { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                          ]}
                        >
                          <View
                            className={`rounded-2xl p-5 border-2 ${
                              stageOfChange === option.value
                                ? 'border-primary bg-primary/5'
                                : 'border-border bg-surface'
                            }`}
                          >
                            <Text className="text-lg font-bold text-foreground mb-1">
                              {option.label}
                            </Text>
                            <Text className="text-sm text-muted">{option.description}</Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                <View className="mt-auto gap-3">
                  <Pressable
                    onPress={handleNext}
                    disabled={!canProceedStep2}
                    style={({ pressed }) => [
                      {
                        opacity: !canProceedStep2 ? 0.4 : pressed ? 0.85 : 1,
                        transform: [{ scale: pressed && canProceedStep2 ? 0.97 : 1 }],
                      },
                    ]}
                  >
                    <View className="bg-primary rounded-2xl py-4 items-center">
                      <Text className="text-white text-lg font-bold">Next</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={handleBack}>
                    <View className="py-3 items-center">
                      <Text className="text-muted text-base">Back</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Step 3: Urgency (final step — submit) */}
            {step === 3 && (
              <View className="flex-1">
                <Text className="text-2xl font-bold text-foreground mb-2">
                  How urgent does it feel?
                </Text>
                <Text className="text-base text-muted mb-6 leading-relaxed">
                  This helps us set the right tone and pace for you.
                </Text>

                <View className="gap-3 mb-8">
                  {URGENCY_LEVELS.map((level) => (
                    <Pressable
                      key={level.value}
                      onPress={() => setUrgency(level.value)}
                      style={({ pressed }) => [
                        { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                      ]}
                    >
                      <View
                        className={`rounded-2xl p-5 border-2 ${
                          urgency === level.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-surface'
                        }`}
                      >
                        <Text className="text-lg font-bold text-foreground mb-1">
                          {level.label}
                        </Text>
                        <Text className="text-sm text-muted">{level.description}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                <View className="mt-auto gap-3">
                  <Pressable
                    onPress={handleSubmit}
                    disabled={!canSubmit || isSubmitting}
                    style={({ pressed }) => [
                      {
                        opacity: !canSubmit ? 0.4 : pressed ? 0.85 : 1,
                        transform: [{ scale: pressed && canSubmit ? 0.97 : 1 }],
                      },
                    ]}
                  >
                    <View className="bg-primary rounded-2xl py-4 items-center">
                      <Text className="text-white text-lg font-bold">
                        {isSubmitting ? 'One moment...' : 'Get Started'}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={handleBack}>
                    <View className="py-3 items-center">
                      <Text className="text-muted text-base">Back</Text>
                    </View>
                  </Pressable>
                </View>

                <Text className="text-xs text-muted text-center mt-4 leading-relaxed">
                  Your data stays on your phone. Nothing is shared without your consent.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
