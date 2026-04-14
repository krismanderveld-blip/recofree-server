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
import type { UserType, UrgencyLevel, StageOfChange } from '@/lib/ai/types';
import { STAGE_OF_CHANGE_OPTIONS } from '@/lib/ai/types';

type IntakeStep = 1 | 2 | 3 | 4 | 5;

const EMOTIONS = [
  { label: 'Calm', value: 'calm' },
  { label: 'Sad', value: 'sad' },
  { label: 'Anxious', value: 'anxious' },
  { label: 'Angry', value: 'angry' },
  { label: 'Confused', value: 'confused' },
  { label: 'Hopeful', value: 'hopeful' },
  { label: 'Exhausted', value: 'exhausted' },
  { label: 'Overwhelmed', value: 'overwhelmed' },
];

const URGENCY_LEVELS: { label: string; value: UrgencyLevel; description: string }[] = [
  { label: 'Low', value: 'laag', description: 'I want to explore at my own pace' },
  { label: 'Medium', value: 'midden', description: 'I could use some support' },
  { label: 'High', value: 'hoog', description: 'I need help right now' },
];

export default function IntakeScreen() {
  const router = useRouter();
  const { completeIntake } = useUser();

  const [step, setStep] = useState<IntakeStep>(1);
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<UserType | null>(null);
  const [stageOfChange, setStageOfChange] = useState<StageOfChange | null>(null);
  const [startEmotion, setStartEmotion] = useState('');
  const [urgency, setUrgency] = useState<UrgencyLevel | null>(null);
  const [initialContext, setInitialContext] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canProceedStep1 = name.trim().length >= 2 && selectedType !== null;
  const canProceedStep2 = stageOfChange !== null;
  const canProceedStep3 = startEmotion !== '';
  const canProceedStep4 = urgency !== null;
  const canSubmit = initialContext.trim().length >= 3;

  const handleNext = () => {
    if (step < 5) setStep((step + 1) as IntakeStep);
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as IntakeStep);
  };

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting || !selectedType || !urgency || !stageOfChange) return;
    setIsSubmitting(true);
    try {
      await completeIntake({
        userName: name.trim(),
        userType: selectedType,
        stageOfChange,
        startEmotion,
        urgency,
        initialContext: initialContext.trim(),
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
              {[1, 2, 3, 4, 5].map((s) => (
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
                        You'll be supported by Elias — a warm, empathetic companion for your recovery.
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

            {/* Step 2: Stage of Change */}
            {step === 2 && (
              <View className="flex-1">
                <Text className="text-2xl font-bold text-foreground mb-2">
                  Where are you in your journey?
                </Text>
                <Text className="text-base text-muted mb-6 leading-relaxed">
                  This helps {selectedType === 'elias' ? 'Elias' : 'Kim'} understand how to best support you.
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

            {/* Step 3: Start Emotion */}
            {step === 3 && (
              <View className="flex-1">
                <Text className="text-2xl font-bold text-foreground mb-2">
                  How are you feeling right now?
                </Text>
                <Text className="text-base text-muted mb-6 leading-relaxed">
                  Choose what's closest to how you feel at this moment.
                </Text>

                <View className="flex-row flex-wrap gap-3 mb-8">
                  {EMOTIONS.map((emotion) => (
                    <Pressable
                      key={emotion.value}
                      onPress={() => setStartEmotion(emotion.value)}
                      style={({ pressed }) => [
                        { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
                      ]}
                    >
                      <View
                        className={`rounded-xl px-4 py-3 border-2 ${
                          startEmotion === emotion.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-surface'
                        }`}
                      >
                        <Text
                          className={`text-base font-medium ${
                            startEmotion === emotion.value ? 'text-primary' : 'text-foreground'
                          }`}
                        >
                          {emotion.label}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                <View className="mt-auto gap-3">
                  <Pressable
                    onPress={handleNext}
                    disabled={!canProceedStep3}
                    style={({ pressed }) => [
                      {
                        opacity: !canProceedStep3 ? 0.4 : pressed ? 0.85 : 1,
                        transform: [{ scale: pressed && canProceedStep3 ? 0.97 : 1 }],
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

            {/* Step 4: Urgency */}
            {step === 4 && (
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
                    onPress={handleNext}
                    disabled={!canProceedStep4}
                    style={({ pressed }) => [
                      {
                        opacity: !canProceedStep4 ? 0.4 : pressed ? 0.85 : 1,
                        transform: [{ scale: pressed && canProceedStep4 ? 0.97 : 1 }],
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

            {/* Step 5: Initial Context */}
            {step === 5 && (
              <View className="flex-1">
                <Text className="text-2xl font-bold text-foreground mb-2">
                  What's on your mind?
                </Text>
                <Text className="text-base text-muted mb-6 leading-relaxed">
                  Share in your own words what's going on. This helps{' '}
                  {selectedType === 'elias' ? 'Elias' : 'Kim'} understand you better.
                </Text>

                <TextInput
                  className="bg-surface border border-border rounded-2xl px-4 py-4 text-base text-foreground min-h-[140px]"
                  placeholder="Write whatever you'd like to share..."
                  placeholderTextColor="#9E9E9E"
                  value={initialContext}
                  onChangeText={setInitialContext}
                  multiline
                  textAlignVertical="top"
                  maxLength={500}
                />
                <Text className="text-xs text-muted mt-2 text-right">
                  {initialContext.length}/500
                </Text>

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
