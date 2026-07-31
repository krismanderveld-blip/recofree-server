import { describe, it, expect } from "vitest";
import {
  searchPastReferences,
  type PastReferenceSearchResult,
} from "@/lib/pipeline/memory/pastReferenceSearch";
import type { SessionLogSummary } from "@/lib/types/memory/logsDat.types";
import type { UserDat } from "@/lib/ai/types";

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const mockSession: SessionLogSummary = {
  summaryId: "s1",
  sessionId: "sess-001",
  persona: "elias",
  startedAt: "2026-06-20T10:00:00Z",
  endedAt: "2026-06-20T11:00:00Z",
  createdAt: "2026-06-20T11:01:00Z",
  summaryModel: "gpt-4o-mini",
  summarySchemaVersion: "session_summary.v1",
  compressedNarrative:
    "Kris sprak over frustraties met investeringen die misgingen. Er was een ruzie met zijn vrouw over geld. Hij voelde zich machteloos en boos. Uiteindelijk bespraken we grounding-technieken.",
  discussedTopics: [
    "investering frustratie",
    "ruzie met partner",
    "grounding",
    "machteloosheid",
  ],
  emotionalThemes: [
    { label: "woede", intensity: 7 },
    { label: "machteloosheid", intensity: 8 },
    { label: "schaamte", intensity: 5 },
  ],
  breakthroughs: [],
  relapseOrRiskEvents: [{ eventType: "craving_spike", description: "craving na ruzie", severity: 6 }],
  openEndpoints: [
    {
      label: "gesprek met partner over financiën",
      category: "follow_up",
    },
  ],
  extractedCandidates: {
    fears: [],
    hopes: [],
    triggers: [],
    schemaTendencies: [],
    modeTendencies: [],
  },
  moduleTrace: [{ moduleId: "M3_GROUNDING", responseMode: "directive", count: 2 }],
  zoneTrace: [{ zone: "YELLOW", count: 3 }, { zone: "GREEN", count: 1 }],
  inputTokenEstimate: 800,
  outputTokenEstimate: 400,
};

const mockUserDat = {
  currentMood: { craving: 3, frustration: 5, despondency: 4, focus: 6 } as any,
  moodHistory: [],
  chatHistory: [],
  moduleUsage: [],
  triggerPatterns: [
    { trigger: "financiële stress", count: 4, weight: 70, firstSeen: "2026-06-01", lastSeen: "2026-06-20" },
    { trigger: "conflict met partner", count: 3, weight: 65, firstSeen: "2026-06-05", lastSeen: "2026-06-19" },
    { trigger: "slaapgebrek", count: 2, weight: 40, firstSeen: "2026-06-10", lastSeen: "2026-06-18" },
  ],
  totalSessions: 5,
  lastSessionDate: "2026-06-20",
  sessionAnalyses: [
    {
      date: "2026-06-18",
      messageCount: 12,
      durationMinutes: 25,
      dominantEmotion: "frustration",
      themes: ["werkdruk", "investering verlies", "schuldgevoel"],
      newTriggers: ["financiële stress"],
      modulesUsed: ["M3_GROUNDING"],
      moodDelta: { distressChange: -2, resilienceChange: 1 },
      endRiskLevel: "low",
    },
  ],
  stageOfChange: "contemplation",
  schemaTendencies: [
    {
      schemaId: "emotional_deprivation",
      domain: "disconnection",
      frequency: 3,
      lastSeen: "2026-06-19",
      copingStyle: "avoidance",
    },
    {
      schemaId: "failure",
      domain: "impaired_autonomy",
      frequency: 2,
      lastSeen: "2026-06-20",
      copingStyle: "overcompensation",
    },
  ],
  modeTendencies: [
    {
      modeId: "angry_child",
      frequency: 4,
      lastSeen: "2026-06-20",
      effectiveInterventions: ["grounding", "validatie"],
    },
  ],
  relationalAnchors: [
    { name: "Sarah", role: "partner/vrouw", roleEN: "partner/wife", emotionalWeight: 9 },
    { name: "Piet", role: "vader", roleEN: "father", emotionalWeight: 7 },
  ],
  gratitudeStreak: 0,
  lastGratitudeDate: null,
  sobrietyDate: null,
  lastMilestoneShown: null,
  clinicalModeActive: false,
  consecutiveSessionsWithoutEngagement: 0,
} as unknown as UserDat;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("pastReferenceSearch", () => {
  describe("Known terms — should find matches", () => {
    it("finds 'investering' in logs.dat discussedTopics and narrative", () => {
      const result = searchPastReferences("investering", [mockSession], mockUserDat);

      expect(result.found).toBe(true);
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches.some((m) => m.category === "besproken onderwerp")).toBe(true);
      expect(result.contextForGPT).toContain("investering");
    });

    it("finds 'ruzie' in logs.dat discussedTopics", () => {
      const result = searchPastReferences("ruzie", [mockSession], mockUserDat);

      expect(result.found).toBe(true);
      expect(result.matches.some((m) => m.content.includes("ruzie"))).toBe(true);
    });

    it("finds 'Sarah' in user.dat relationalAnchors", () => {
      const result = searchPastReferences("Sarah", [mockSession], mockUserDat);

      expect(result.found).toBe(true);
      expect(result.matches.some((m) => m.category === "relationeel anker")).toBe(true);
      expect(result.matches.some((m) => m.content.includes("partner"))).toBe(true);
    });

    it("finds 'financiële stress' in user.dat triggerPatterns", () => {
      const result = searchPastReferences("financiële stress", [mockSession], mockUserDat);

      expect(result.found).toBe(true);
      expect(result.matches.some((m) => m.category === "trigger-patroon")).toBe(true);
    });

    it("finds 'machteloosheid' in logs.dat emotionalThemes", () => {
      const result = searchPastReferences("machteloosheid", [mockSession], mockUserDat);

      expect(result.found).toBe(true);
      expect(result.matches.some((m) => m.category === "emotioneel thema")).toBe(true);
    });

    it("finds 'failure' schema in user.dat schemaTendencies", () => {
      const result = searchPastReferences("failure", [mockSession], mockUserDat);

      expect(result.found).toBe(true);
      expect(result.matches.some((m) => m.category === "schema-tendens")).toBe(true);
    });

    it("finds 'angry_child' mode in user.dat modeTendencies", () => {
      const result = searchPastReferences("angry child", [mockSession], mockUserDat);

      expect(result.found).toBe(true);
      expect(result.matches.some((m) => m.category === "modus-tendens")).toBe(true);
    });

    it("finds 'gesprek met partner' in logs.dat openEndpoints", () => {
      const result = searchPastReferences("gesprek partner", [mockSession], mockUserDat);

      expect(result.found).toBe(true);
      expect(result.matches.some((m) => m.category === "open punt")).toBe(true);
    });
  });

  describe("Unknown terms — should return not found", () => {
    it("returns found=false for completely unknown term", () => {
      const result = searchPastReferences("vliegtuig", [mockSession], mockUserDat);

      expect(result.found).toBe(false);
      expect(result.matches).toHaveLength(0);
      expect(result.contextForGPT).toContain("niet eerder besproken");
    });

    it("returns found=false for empty query", () => {
      const result = searchPastReferences("", [mockSession], mockUserDat);

      expect(result.found).toBe(false);
    });

    it("returns found=false for single character query", () => {
      const result = searchPastReferences("x", [mockSession], mockUserDat);

      expect(result.found).toBe(false);
    });

    it("returns found=false for unrelated topic", () => {
      const result = searchPastReferences("voetbal wedstrijd", [mockSession], mockUserDat);

      expect(result.found).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("handles empty logs.dat sessions array", () => {
      const result = searchPastReferences("investering", [], mockUserDat);

      // Should still find in user.dat sessionAnalyses
      expect(result.found).toBe(true);
      expect(result.matches.some((m) => m.source === "user.dat")).toBe(true);
    });

    it("handles empty user.dat (no patterns)", () => {
      const emptyUserDat = {
        currentMood: {} as any,
        moodHistory: [],
        chatHistory: [],
        moduleUsage: [],
        triggerPatterns: [],
        totalSessions: 0,
        lastSessionDate: null,
        sessionAnalyses: [],
        stageOfChange: "precontemplation",
        gratitudeStreak: 0,
        lastGratitudeDate: null,
        sobrietyDate: null,
        lastMilestoneShown: null,
        clinicalModeActive: false,
        consecutiveSessionsWithoutEngagement: 0,
      } as unknown as UserDat;

      const result = searchPastReferences("investering", [mockSession], emptyUserDat);

      expect(result.found).toBe(true);
      expect(result.matches.every((m) => m.source === "logs.dat")).toBe(true);
    });

    it("limits results to max 5 matches", () => {
      // Create many sessions with matching topics
      const manySessions = Array.from({ length: 20 }, (_, i) => ({
        ...mockSession,
        summaryId: `s${i}`,
        discussedTopics: ["investering", "geld", "financiën"],
      }));

      const result = searchPastReferences("investering", manySessions, mockUserDat);

      expect(result.matches.length).toBeLessThanOrEqual(5);
    });

    it("sorts matches by relevance (highest first)", () => {
      const result = searchPastReferences("investering frustratie", [mockSession], mockUserDat);

      if (result.matches.length > 1) {
        for (let i = 0; i < result.matches.length - 1; i++) {
          expect(result.matches[i].relevance).toBeGreaterThanOrEqual(
            result.matches[i + 1].relevance
          );
        }
      }
    });
  });

  describe("GPT context output", () => {
    it("generates a context string with [GEHEUGEN] prefix when found", () => {
      const result = searchPastReferences("investering", [mockSession], mockUserDat);

      expect(result.contextForGPT).toContain("[GEHEUGEN]");
      expect(result.contextForGPT).toContain("investering");
    });

    it("generates an 'onbekend' context string when not found", () => {
      const result = searchPastReferences("vliegtuig", [mockSession], mockUserDat);

      expect(result.contextForGPT).toContain("niet eerder besproken");
      expect(result.contextForGPT).toContain("onbekend");
    });

    it("includes relative time info in context string", () => {
      const result = searchPastReferences("investering", [mockSession], mockUserDat);

      // Should contain some time reference (dagen geleden, weken geleden, etc.)
      expect(result.contextForGPT).toMatch(
        /vandaag|gisteren|dagen geleden|weken geleden|maanden geleden/
      );
    });
  });
});
