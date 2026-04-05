# RecoFree App - Interface Design

## App Concept

RecoFree is a therapeutic support app with two separate AI systems: **Elias** (for people with addiction) and **Kim** (for loved ones of people with addiction). The user's intake determines which system is permanently activated. The app provides chat-based support, mood tracking, diary functionality, and crisis detection.

## Color Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| primary | #2E7D32 | #4CAF50 | Brand green, buttons, accents |
| background | #FAFAFA | #121212 | Screen backgrounds |
| surface | #FFFFFF | #1E1E1E | Cards, elevated surfaces |
| foreground | #1B1B1B | #F5F5F5 | Primary text |
| muted | #757575 | #9E9E9E | Secondary text, hints |
| border | #E0E0E0 | #333333 | Dividers, card borders |
| success | #43A047 | #66BB6A | Positive states |
| warning | #FB8C00 | #FFA726 | Warning states |
| error | #E53935 | #EF5350 | Crisis, errors |

## Screen List

### 1. Onboarding / Splash Screen
Full-screen splash with RecoFree logo (green heart with upward arrow). Fade transition to intake or home.

### 2. Intake Screen
Single-screen questionnaire that determines the user's route. Two large cards: "Ik heb zelf een afhankelijkheid" (activates Elias) and "Ik ben naaste" (activates Kim). Below: name input field. This choice is permanent and stored locally.

### 3. Home Screen (Tab 1)
Greeting from Elias or Kim (depending on user type). Shows current mood summary (4 mini sliders preview). Quick-action buttons: "Chat starten", "Dagboek schrijven", "Stemming bijwerken". Daily insight card with a short reflection.

### 4. Chat Screen (Tab 2)
Full-screen chat interface. Message bubbles: user (right, green tint) and AI (left, white/surface). Typing indicator with subtle animation. Input bar at bottom with send button. Shows user's name in header (not "Sam"). No system-switching UI visible.

### 5. Mood Tracking Screen (Tab 3)
Four vertical sliders (0-10 scale): Stemming (mood), Zucht/Craving, Overprikkeling (overstimulation), Sociaal (social). Each slider has a label, current value, and color gradient (green=good, red=concern). Save button at bottom. History chart showing trend over time.

### 6. Diary Screen (Tab 4)
List of diary entries (date, preview text, mood indicator). Floating action button to create new entry. Entry editor: text input area, optional mood tag, timestamp. Entries stored locally with AsyncStorage.

### 7. Profile / Settings Screen
User name display. User type indicator (Elias or Kim route). App settings: notifications, dark mode toggle. Emergency contact card. About RecoFree section. No option to switch between Elias and Kim.

## Primary Content and Functionality

### Intake Flow
The intake screen collects: user name, user type (addiction/loved one). Based on user type, the entire app experience is routed to either Elias or Kim. This is stored in AsyncStorage and checked at every app launch.

### Chat System
The chat interface communicates with the AI provider (MockAIProvider in phase 1, OpenAIProvider later). Each message goes through: context loading, module trigger scan, response generation. The AI provider interface returns an AIResult with response text, detected emotion, and confidence score.

### Mood Tracking (4 Sliders)
Four sliders track the user's current state. Values influence the AI system's module selection and response tone. Slider data is persisted locally and included in chat context. Threshold values trigger failsafe logic (e.g., craving > 7 triggers specific modules).

### Diary
Free-text journal entries with timestamps. Diary content is analyzed for triggers and emotional patterns. Entries feed into the rugzak (backpack) context system.

### Crisis Detection
Text analysis (regex patterns) scans for crisis indicators. Slider threshold values trigger concern/crisis levels. Detected patterns activate failsafe modules. Crisis response includes emergency resources (113 Zelfmoordpreventie, etc.).

## Key User Flows

### Flow 1: First Launch
Splash → Intake Screen → Select user type → Enter name → Home Screen (with Elias or Kim greeting)

### Flow 2: Daily Check-in
Home → Mood Tracking → Adjust sliders → Save → Home (updated mood summary)

### Flow 3: Chat Session
Home → Chat → Type message → AI processes (mock) → Response displayed → Continue conversation

### Flow 4: Diary Entry
Home → Diary → New Entry → Write text → Save → Entry appears in list

### Flow 5: Crisis Detection
Chat → User types crisis-related content → Failsafe triggered → Crisis response with emergency resources → Calm mode activated

## Tab Bar Configuration

| Tab | Icon | Label | Screen |
|-----|------|-------|--------|
| 1 | house.fill | Home | Home Screen |
| 2 | bubble.left.fill | Chat | Chat Screen |
| 3 | chart.bar.fill | Stemming | Mood Tracking |
| 4 | book.fill | Dagboek | Diary Screen |

## Layout Principles

All screens use ScreenContainer for safe area handling. Cards use rounded corners (16px), subtle shadows, and surface background. Spacing follows 8px grid. Typography: SF Pro (iOS) / Roboto (Android) via system defaults. Bottom tab bar with 4 tabs. No hamburger menus or side drawers.
