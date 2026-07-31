import { describe, it, expect } from "vitest";
import {
  adaptWheelOfChange,
  adaptEarlySigns,
  adaptSelfImage,
  runVspIntakeAdapters,
} from "../../lib/features/vspInsight/vspIntakeAdapters";

describe("VSP Intake Adapters", () => {
  describe("adaptWheelOfChange", () => {
    it("maps valid stageOfChange to WheelOfChangeSnapshot", () => {
      const result = adaptWheelOfChange({
        stageOfChange: "contemplation",
        intakeDate: "2025-01-15T10:00:00Z",
      });
      expect(result.currentStage).toBe("contemplation");
      expect(result.capturedAt).toBe("2025-01-15T10:00:00Z");
    });

    it("maps null stageOfChange to unknown", () => {
      const result = adaptWheelOfChange({
        stageOfChange: null,
        intakeDate: "2025-01-15T10:00:00Z",
      });
      expect(result.currentStage).toBe("unknown");
    });

    it("maps invalid stageOfChange to unknown", () => {
      const result = adaptWheelOfChange({
        stageOfChange: "nonsense",
        intakeDate: "2025-01-15T10:00:00Z",
      });
      expect(result.currentStage).toBe("unknown");
    });

    it("handles all valid stages", () => {
      const stages = ["precontemplation", "contemplation", "preparation", "action", "maintenance", "relapse"];
      for (const stage of stages) {
        const result = adaptWheelOfChange({ stageOfChange: stage, intakeDate: "2025-01-01T00:00:00Z" });
        expect(result.currentStage).toBe(stage);
      }
    });

    it("handles case-insensitive input", () => {
      const result = adaptWheelOfChange({
        stageOfChange: "CONTEMPLATION",
        intakeDate: "2025-01-15T10:00:00Z",
      });
      expect(result.currentStage).toBe("contemplation");
    });
  });

  describe("adaptEarlySigns", () => {
    it("extracts signs from comma-separated signals", () => {
      const result = adaptEarlySigns({
        zones: {
          orange: { signals: "Ik word prikkelbaar, slaap slecht, trek me terug" },
        },
        lastUpdated: "2025-01-15T10:00:00Z",
      });
      expect(result.length).toBe(3);
      expect(result[0].source).toBe("intake");
      expect(result[0].userReportedZoneAssociation).toContain("ORANJE");
    });

    it("extracts signs from multiple zones", () => {
      const result = adaptEarlySigns({
        zones: {
          green: { signals: "Rustig, ontspannen" },
          red: { signals: "Paniek, blackout" },
        },
        lastUpdated: "2025-01-15T10:00:00Z",
      });
      expect(result.length).toBe(4);
      const greenSigns = result.filter(s => s.userReportedZoneAssociation.includes("GROEN"));
      const redSigns = result.filter(s => s.userReportedZoneAssociation.includes("ROOD"));
      expect(greenSigns.length).toBe(2);
      expect(redSigns.length).toBe(2);
    });

    it("deduplicates identical signals across zones", () => {
      const result = adaptEarlySigns({
        zones: {
          yellow: { signals: "slecht slapen" },
          orange: { signals: "slecht slapen" },
        },
        lastUpdated: "2025-01-15T10:00:00Z",
      });
      expect(result.length).toBe(1);
      expect(result[0].userReportedZoneAssociation).toContain("GEEL");
      expect(result[0].userReportedZoneAssociation).toContain("ORANJE");
    });

    it("skips empty zones", () => {
      const result = adaptEarlySigns({
        zones: {
          green: { signals: "" },
          yellow: { signals: "   " },
          orange: { signals: "Prikkelbaar" },
        },
        lastUpdated: null,
      });
      expect(result.length).toBe(1);
    });

    it("skips too-short fragments", () => {
      const result = adaptEarlySigns({
        zones: {
          orange: { signals: "a, bb, prikkelbaar worden, ook dit telt" },
        },
        lastUpdated: null,
      });
      // "a" and "bb" are < 3 chars, "prikkelbaar worden" and "ook dit telt" pass
      expect(result.length).toBe(2);
    });

    it("handles semicolon and newline delimiters", () => {
      const result = adaptEarlySigns({
        zones: {
          red: { signals: "Paniek; hartkloppingen\nDuizelig" },
        },
        lastUpdated: null,
      });
      expect(result.length).toBe(3);
    });
  });

  describe("adaptSelfImage", () => {
    it("extracts negative self-beliefs from backpack sections", () => {
      const result = adaptSelfImage({
        sections: [
          { id: "1", label: "Jeugd", content: "Ik ben niet goed genoeg voor anderen." },
        ],
        capturedAt: "2025-01-15T10:00:00Z",
      });
      expect(result.length).toBeGreaterThanOrEqual(1);
      const negativeSign = result.find(s => s.normalizedLabel.includes("negatief_zelfbeeld"));
      expect(negativeSign).toBeDefined();
      expect(negativeSign!.associatedInsightState).toBe("RATIONAL_GREEN");
    });

    it("extracts overwhelm indicators", () => {
      const result = adaptSelfImage({
        sections: [
          { id: "1", label: "Nu", content: "Ik voel me overweldigd door alles." },
        ],
        capturedAt: "2025-01-15T10:00:00Z",
      });
      const overwhelmSign = result.find(s => s.normalizedLabel.includes("overweldiging"));
      expect(overwhelmSign).toBeDefined();
      expect(overwhelmSign!.associatedInsightState).toBe("OVERWHELMED_ORANGE_RED");
    });

    it("extracts positive self-image as protective factor", () => {
      const result = adaptSelfImage({
        sections: [
          { id: "1", label: "Kracht", content: "Ik ben sterk en veerkrachtig." },
        ],
        capturedAt: "2025-01-15T10:00:00Z",
      });
      const positiveSign = result.find(s => s.normalizedLabel.includes("positief_zelfbeeld"));
      expect(positiveSign).toBeDefined();
      expect(positiveSign!.associatedInsightState).toBe("REAL_GREEN");
    });

    it("extracts anchor sentences as protective signs", () => {
      const result = adaptSelfImage({
        anchorSentences: {
          green: "Ik mag er zijn zoals ik ben",
          orange: "Dit gaat voorbij",
        },
        capturedAt: "2025-01-15T10:00:00Z",
      });
      const anchorSigns = result.filter(s => s.normalizedLabel.startsWith("ankerzin_"));
      expect(anchorSigns.length).toBe(2);
      expect(anchorSigns[0].associatedInsightState).toBe("REAL_GREEN");
    });

    it("handles Kim backpack", () => {
      const result = adaptSelfImage({
        kimBackpack: {
          my_story: "Ik ben niet waardeloos, maar het voelt soms zo.",
          the_relationship: "De relatie was moeilijk.",
          the_impact: "Ik voel me machteloos.",
          my_boundaries: "Ik leer grenzen stellen.",
          my_strength: "Ik ben sterk genoeg.",
        },
        capturedAt: "2025-01-15T10:00:00Z",
      });
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it("returns empty array for empty input", () => {
      const result = adaptSelfImage({
        capturedAt: "2025-01-15T10:00:00Z",
      });
      expect(result).toEqual([]);
    });
  });

  describe("runVspIntakeAdapters (combined)", () => {
    it("runs all three adapters and returns combined results", () => {
      const result = runVspIntakeAdapters({
        stageOfChange: "action",
        intakeDate: "2025-01-15T10:00:00Z",
        vspZones: {
          orange: { signals: "Prikkelbaar, slecht slapen" },
          red: { signals: "Paniek" },
        },
        vspLastUpdated: "2025-01-15T10:00:00Z",
        sections: [
          { id: "1", label: "Nu", content: "Ik ben niet goed genoeg." },
        ],
        anchorSentences: {
          green: "Ik mag er zijn",
        },
      });

      expect(result.wheelOfChange.currentStage).toBe("action");
      expect(result.selfReportedEarlySigns.length).toBeGreaterThanOrEqual(3);
      expect(result.observedEarlySigns.length).toBeGreaterThanOrEqual(1);
    });

    it("handles minimal input gracefully", () => {
      const result = runVspIntakeAdapters({
        stageOfChange: null,
        intakeDate: "2025-01-15T10:00:00Z",
      });

      expect(result.wheelOfChange.currentStage).toBe("unknown");
      expect(result.selfReportedEarlySigns).toEqual([]);
      expect(result.observedEarlySigns).toEqual([]);
    });
  });
});
