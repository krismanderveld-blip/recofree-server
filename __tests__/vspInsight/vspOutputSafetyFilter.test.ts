import { describe, it, expect } from "vitest";
import {
  auditVspOutputSafety,
  hasHighSeverityViolation,
} from "../../lib/features/vspInsight/vspOutputSafetyFilter";

const baseInput = {
  clinicalModeActive: false,
  insightState: "RATIONAL_GREEN" as const,
  framework: "MI" as const,
  persona: "elias" as const,
};

describe("VSP Output Safety Filter", () => {
  describe("auditVspOutputSafety", () => {
    it("returns no violations for clean response", () => {
      const result = auditVspOutputSafety({
        ...baseInput,
        responseText: "Hoe gaat het vandaag met je? Ik merk dat je veel nadenkt.",
      });
      expect(result.hasViolations).toBe(false);
      expect(result.violationCount).toBe(0);
      expect(result.maxSeverity).toBe("none");
    });

    it("detects Dutch schema names", () => {
      const result = auditVspOutputSafety({
        ...baseInput,
        responseText: "Je verlating schema is actief vandaag.",
      });
      expect(result.hasViolations).toBe(true);
      expect(result.violations.some(v => v.category === "clinical_terminology")).toBe(true);
      expect(result.violations.some(v => v.ruleRef === "SCHEMA_NAME_NL")).toBe(true);
    });

    it("detects Dutch mode names", () => {
      const result = auditVspOutputSafety({
        ...baseInput,
        responseText: "Ik zie dat je kwetsbaar kind modus actief is.",
      });
      expect(result.hasViolations).toBe(true);
      expect(result.violations.some(v => v.ruleRef === "MODE_NAME_NL")).toBe(true);
    });

    it("detects framework disclosure", () => {
      const result = auditVspOutputSafety({
        ...baseInput,
        responseText: "Ik gebruik motiverende gespreksvoering om je te helpen.",
      });
      expect(result.hasViolations).toBe(true);
      expect(result.violations.some(v => v.category === "framework_disclosure")).toBe(true);
    });

    it("detects DGT/DBT disclosure", () => {
      const result = auditVspOutputSafety({
        ...baseInput,
        responseText: "Via dialectische gedragstherapie leer je emotieregulatie.",
      });
      expect(result.hasViolations).toBe(true);
      expect(result.violations.some(v => v.ruleRef === "FRAMEWORK_DGT")).toBe(true);
    });

    it("detects discrepancy disclosure", () => {
      const result = auditVspOutputSafety({
        ...baseInput,
        responseText: "Er is een discrepantie gedetecteerd in wat je zegt.",
      });
      expect(result.hasViolations).toBe(true);
      expect(result.violations.some(v => v.category === "discrepancy_disclosure")).toBe(true);
    });

    it("detects rational green term leak", () => {
      const result = auditVspOutputSafety({
        ...baseInput,
        responseText: "Je bevindt je in rationeel groen.",
      });
      expect(result.hasViolations).toBe(true);
      expect(result.violations.some(v => v.ruleRef === "RATIONAL_GREEN_TERM")).toBe(true);
    });

    it("detects store/profile reference", () => {
      const result = auditVspOutputSafety({
        ...baseInput,
        responseText: "Uit je profiel blijkt dat je moeite hebt met grenzen.",
      });
      expect(result.hasViolations).toBe(true);
      expect(result.violations.some(v => v.category === "store_violation")).toBe(true);
    });

    it("detects confidence percentage leak", () => {
      const result = auditVspOutputSafety({
        ...baseInput,
        responseText: "Er is 85% kans dat je terugvalt.",
      });
      expect(result.hasViolations).toBe(true);
      expect(result.violations.some(v => v.category === "percentage_leak")).toBe(true);
    });

    it("detects direct schema/mode naming", () => {
      const result = auditVspOutputSafety({
        ...baseInput,
        responseText: "Je hebt schema Verlating actief.",
      });
      expect(result.hasViolations).toBe(true);
      expect(result.violations.some(v => v.category === "schema_mode_naming")).toBe(true);
    });

    it("detects system name leak", () => {
      const result = auditVspOutputSafety({
        ...baseInput,
        responseText: "Het VSP Insight systeem merkt op dat...",
      });
      expect(result.hasViolations).toBe(true);
      expect(result.violations.some(v => v.ruleRef === "SYSTEM_NAME_LEAK")).toBe(true);
    });

    it("detects DSM labels", () => {
      const result = auditVspOutputSafety({
        ...baseInput,
        responseText: "Dit past bij een persoonlijkheidsstoornis.",
      });
      expect(result.hasViolations).toBe(true);
      expect(result.violations.some(v => v.ruleRef === "DSM_LABEL")).toBe(true);
    });

    it("returns correct maxSeverity", () => {
      const result = auditVspOutputSafety({
        ...baseInput,
        responseText: "Je verlating schema is actief. Motiverende gespreksvoering helpt.",
      });
      expect(result.maxSeverity).toBe("high"); // schema name = high
    });

    it("clinical mode bypasses all checks", () => {
      const result = auditVspOutputSafety({
        ...baseInput,
        clinicalModeActive: true,
        responseText: "Schema verlating actief. Rationeel groen. DSM borderline. 85% confidence.",
      });
      expect(result.hasViolations).toBe(false);
      expect(result.clinicalModeRelaxed).toBe(true);
      expect(result.rulesApplied).toContain("CLINICAL_MODE_BYPASS");
    });

    it("reports all rules applied", () => {
      const result = auditVspOutputSafety({
        ...baseInput,
        responseText: "Alles goed.",
      });
      expect(result.rulesApplied).toContain("CLINICAL_TERMINOLOGY");
      expect(result.rulesApplied).toContain("FRAMEWORK_DISCLOSURE");
      expect(result.rulesApplied).toContain("DISCREPANCY_DISCLOSURE");
      expect(result.rulesApplied).toContain("STORE_VIOLATION");
      expect(result.rulesApplied).toContain("PERCENTAGE_LEAK");
      expect(result.rulesApplied).toContain("SCHEMA_MODE_NAMING");
    });
  });

  describe("hasHighSeverityViolation", () => {
    it("returns true for high severity", () => {
      const result = hasHighSeverityViolation({
        ...baseInput,
        responseText: "Je verlating schema is actief.",
      });
      expect(result).toBe(true);
    });

    it("returns false for clean response", () => {
      const result = hasHighSeverityViolation({
        ...baseInput,
        responseText: "Hoe gaat het met je vandaag?",
      });
      expect(result).toBe(false);
    });

    it("returns false in clinical mode regardless of content", () => {
      const result = hasHighSeverityViolation({
        ...baseInput,
        clinicalModeActive: true,
        responseText: "Schema verlating. DSM borderline.",
      });
      expect(result).toBe(false);
    });

    it("returns false for medium severity only", () => {
      const result = hasHighSeverityViolation({
        ...baseInput,
        responseText: "Via MBT leer je mentaliseren.",
      });
      expect(result).toBe(false);
    });
  });
});
