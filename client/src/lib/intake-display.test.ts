import { describe, it } from "node:test";
import assert from "node:assert";
import { getIntakeDisplayData, IntakeDisplayData } from "./intake-display";

describe("getIntakeDisplayData", () => {
  describe("handles different input types", () => {
    it("returns null for null input", () => {
      assert.strictEqual(getIntakeDisplayData(null), null);
    });

    it("returns null for undefined input", () => {
      assert.strictEqual(getIntakeDisplayData(undefined), null);
    });

    it("returns null for empty object", () => {
      assert.strictEqual(getIntakeDisplayData({}), null);
    });

    it("parses valid JSON string input", () => {
      const input = JSON.stringify({
        summary: "Car accident case",
        urgency: "high",
      });
      const result = getIntakeDisplayData(input);
      assert.deepStrictEqual(result, {
        summary: "Car accident case",
        urgency: "high",
      });
    });

    it("returns null for invalid JSON string", () => {
      assert.strictEqual(getIntakeDisplayData("not valid json"), null);
    });

    it("returns null for JSON string that parses to non-object", () => {
      assert.strictEqual(getIntakeDisplayData('"just a string"'), null);
      assert.strictEqual(getIntakeDisplayData("42"), null);
      assert.strictEqual(getIntakeDisplayData("null"), null);
    });

    it("handles object input directly", () => {
      const input = {
        summary: "Personal injury case",
        practiceArea: "Personal Injury",
      };
      const result = getIntakeDisplayData(input);
      assert.deepStrictEqual(result, {
        summary: "Personal injury case",
        practiceArea: "Personal Injury",
      });
    });
  });

  describe("normalizes field values", () => {
    it("extracts urgency field", () => {
      const result = getIntakeDisplayData({ urgency: "high" });
      assert.strictEqual(result?.urgency, "high");
    });

    it("extracts and trims summary", () => {
      const result = getIntakeDisplayData({ summary: "  Trimmed summary  " });
      assert.strictEqual(result?.summary, "Trimmed summary");
    });

    it("extracts practice area fields", () => {
      const result1 = getIntakeDisplayData({ practiceArea: "Personal Injury" });
      assert.strictEqual(result1?.practiceArea, "Personal Injury");

      const result2 = getIntakeDisplayData({ practiceAreaGuess: "Family Law" });
      assert.strictEqual(result2?.practiceAreaGuess, "Family Law");
    });

    it("extracts injury description", () => {
      const result = getIntakeDisplayData({
        summary: "test",
        injuryDescription: "Back pain and whiplash",
      });
      assert.strictEqual(result?.injuryDescription, "Back pain and whiplash");
    });

    it("extracts and filters keyFacts array", () => {
      const result = getIntakeDisplayData({
        keyFacts: ["Valid fact", "", "  ", "Another fact", 123, null],
      });
      assert.deepStrictEqual(result?.keyFacts, ["Valid fact", "Another fact"]);
    });

    it("omits keyFacts if empty after filtering", () => {
      const result = getIntakeDisplayData({
        summary: "test",
        keyFacts: ["", "  ", null],
      });
      assert.strictEqual(result?.keyFacts, undefined);
    });

    it("extracts incident date", () => {
      const result = getIntakeDisplayData({
        summary: "test",
        incidentDate: "2024-01-15",
      });
      assert.strictEqual(result?.incidentDate, "2024-01-15");
    });

    it("extracts location", () => {
      const result = getIntakeDisplayData({
        summary: "test",
        location: "Los Angeles, CA",
      });
      assert.strictEqual(result?.location, "Los Angeles, CA");
    });
  });

  describe("handles caller info in various formats", () => {
    it("extracts caller from nested caller object", () => {
      const result = getIntakeDisplayData({
        caller: {
          fullName: "John Doe",
          phone: "+1234567890",
          email: "john@example.com",
        },
      });
      assert.strictEqual(result?.callerName, "John Doe");
      assert.strictEqual(result?.callerPhone, "+1234567890");
      assert.strictEqual(result?.callerEmail, "john@example.com");
    });

    it("combines firstName and lastName when fullName is missing", () => {
      const result = getIntakeDisplayData({
        caller: {
          firstName: "Jane",
          lastName: "Smith",
        },
      });
      assert.strictEqual(result?.callerName, "Jane Smith");
    });

    it("uses firstName alone when lastName is missing", () => {
      const result = getIntakeDisplayData({
        caller: {
          firstName: "Bob",
        },
      });
      assert.strictEqual(result?.callerName, "Bob");
    });

    it("extracts caller from root level fields", () => {
      const result = getIntakeDisplayData({
        callerName: "Alice Johnson",
        callerPhone: "+0987654321",
        summary: "test",
      });
      assert.strictEqual(result?.callerName, "Alice Johnson");
      assert.strictEqual(result?.callerPhone, "+0987654321");
    });

    it("extracts phone from various field names", () => {
      const result1 = getIntakeDisplayData({ phone: "111", summary: "t" });
      assert.strictEqual(result1?.callerPhone, "111");

      const result2 = getIntakeDisplayData({ callerPhone: "222", summary: "t" });
      assert.strictEqual(result2?.callerPhone, "222");
    });
  });

  describe("handles complete intake extraction format", () => {
    it("normalizes full IntakeExtraction object", () => {
      const fullIntake = {
        caller: {
          fullName: "John Doe",
          firstName: "John",
          lastName: "Doe",
          email: "john@test.com",
          phone: "+1555123456",
        },
        practiceArea: "Personal Injury",
        incidentDate: "2024-01-15",
        location: "San Francisco, CA",
        summary: "Car accident resulting in back injury",
        keyFacts: ["Police report filed", "Medical treatment received"],
        urgency: "high",
        conflicts: { opposingParty: null },
        score: { value: 75, label: "high", reasons: ["Good case"] },
      };

      const result = getIntakeDisplayData(fullIntake);

      assert.deepStrictEqual(result, {
        urgency: "high",
        summary: "Car accident resulting in back injury",
        practiceArea: "Personal Injury",
        keyFacts: ["Police report filed", "Medical treatment received"],
        callerName: "John Doe",
        callerPhone: "+1555123456",
        callerEmail: "john@test.com",
        incidentDate: "2024-01-15",
        location: "San Francisco, CA",
      });

      // Ensure internal fields are NOT included
      assert.strictEqual((result as any).conflicts, undefined);
      assert.strictEqual((result as any).score, undefined);
      assert.strictEqual((result as any).caller, undefined);
    });
  });

  describe("type safety", () => {
    it("returns properly typed IntakeDisplayData", () => {
      const result = getIntakeDisplayData({
        urgency: "medium",
        summary: "Test case",
      });

      // Type check - if this compiles, types are correct
      const _typed: IntakeDisplayData | null = result;
      assert.ok(_typed !== null);
    });

    it("only returns string fields (no nested objects)", () => {
      const result = getIntakeDisplayData({
        summary: "Test",
        urgency: "low",
        keyFacts: ["fact1"],
        caller: { fullName: "Test User" },
        score: { value: 50 }, // Should be excluded
        conflicts: { party: "Someone" }, // Should be excluded
      });

      // Check all values are strings or string arrays
      for (const [key, value] of Object.entries(result || {})) {
        if (key === "keyFacts") {
          assert.ok(Array.isArray(value));
          (value as string[]).forEach((v) =>
            assert.strictEqual(typeof v, "string")
          );
        } else {
          assert.strictEqual(typeof value, "string");
        }
      }
    });
  });
});
