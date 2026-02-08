import { describe, it } from "node:test";
import assert from "node:assert";
import { getBestPhone, getBestDisplayName, getBestPracticeArea } from "./lead-utils";

function makeLead(overrides: Record<string, any> = {}) {
  return {
    displayName: null,
    contact: { name: "Unknown Caller", primaryPhone: null },
    intakeData: null,
    practiceArea: null,
    ...overrides,
  };
}

describe("getBestPhone", () => {
  it("returns contact.primaryPhone when available", () => {
    const lead = makeLead({ contact: { name: "John", primaryPhone: "+15551234567" } });
    assert.strictEqual(getBestPhone(lead), "+15551234567");
  });

  it("falls back to intakeData.phoneNumber", () => {
    const lead = makeLead({ intakeData: { phoneNumber: "+15559876543" } });
    assert.strictEqual(getBestPhone(lead), "+15559876543");
  });

  it("falls back to intakeData.callerPhone", () => {
    const lead = makeLead({ intakeData: { callerPhone: "+15551111111" } });
    assert.strictEqual(getBestPhone(lead), "+15551111111");
  });

  it("falls back to intakeData.phone", () => {
    const lead = makeLead({ intakeData: { phone: "+15552222222" } });
    assert.strictEqual(getBestPhone(lead), "+15552222222");
  });

  it("falls back to intakeData.caller.phone", () => {
    const lead = makeLead({ intakeData: { caller: { phone: "+15553333333" } } });
    assert.strictEqual(getBestPhone(lead), "+15553333333");
  });

  it("returns null when no phone is available", () => {
    const lead = makeLead();
    assert.strictEqual(getBestPhone(lead), null);
  });

  it("skips empty strings", () => {
    const lead = makeLead({ intakeData: { phone: "  ", callerPhone: "+15554444444" } });
    assert.strictEqual(getBestPhone(lead), "+15554444444");
  });
});

describe("getBestDisplayName", () => {
  it("returns displayName when available", () => {
    const lead = makeLead({ displayName: "Jane Doe" });
    assert.strictEqual(getBestDisplayName(lead), "Jane Doe");
  });

  it("falls back to contact.name", () => {
    const lead = makeLead({ contact: { name: "John Smith", primaryPhone: null } });
    assert.strictEqual(getBestDisplayName(lead), "John Smith");
  });

  it("skips contact.name when it is 'Unknown Caller'", () => {
    const lead = makeLead({
      contact: { name: "Unknown Caller", primaryPhone: "+15551234567" },
    });
    // Should fall through to phone
    assert.strictEqual(getBestDisplayName(lead), "+15551234567");
  });

  it("falls back to intakeData.callerName", () => {
    const lead = makeLead({ intakeData: { callerName: "Alice Johnson" } });
    assert.strictEqual(getBestDisplayName(lead), "Alice Johnson");
  });

  it("falls back to intakeData.caller.fullName", () => {
    const lead = makeLead({ intakeData: { caller: { fullName: "Bob Williams" } } });
    assert.strictEqual(getBestDisplayName(lead), "Bob Williams");
  });

  it("combines firstName + lastName from caller", () => {
    const lead = makeLead({
      intakeData: { caller: { firstName: "Charlie", lastName: "Brown" } },
    });
    assert.strictEqual(getBestDisplayName(lead), "Charlie Brown");
  });

  it("uses firstName alone when lastName missing", () => {
    const lead = makeLead({
      intakeData: { caller: { firstName: "Diana" } },
    });
    assert.strictEqual(getBestDisplayName(lead), "Diana");
  });

  it("falls back to phone number", () => {
    const lead = makeLead({
      contact: { name: "Unknown Caller", primaryPhone: "+15559999999" },
    });
    assert.strictEqual(getBestDisplayName(lead), "+15559999999");
  });

  it("returns 'Unknown Caller' when nothing available", () => {
    const lead = makeLead();
    assert.strictEqual(getBestDisplayName(lead), "Unknown Caller");
  });

  it("trims whitespace from displayName", () => {
    const lead = makeLead({ displayName: "  " });
    // Empty after trim, should fall through
    assert.strictEqual(getBestDisplayName(lead), "Unknown Caller");
  });
});

describe("getBestPracticeArea", () => {
  it("returns practiceArea.name when available", () => {
    const lead = makeLead({ practiceArea: { name: "Personal Injury" } });
    assert.strictEqual(getBestPracticeArea(lead), "Personal Injury");
  });

  it("falls back to intakeData.practiceAreaGuess", () => {
    const lead = makeLead({ intakeData: { practiceAreaGuess: "Family Law" } });
    assert.strictEqual(getBestPracticeArea(lead), "Family Law");
  });

  it("falls back to intakeData.practiceArea", () => {
    const lead = makeLead({ intakeData: { practiceArea: "Employment" } });
    assert.strictEqual(getBestPracticeArea(lead), "Employment");
  });

  it("returns 'Not assigned' when nothing available", () => {
    const lead = makeLead();
    assert.strictEqual(getBestPracticeArea(lead), "Not assigned");
  });

  it("skips empty practiceArea.name", () => {
    const lead = makeLead({
      practiceArea: { name: "  " },
      intakeData: { practiceArea: "Criminal" },
    });
    assert.strictEqual(getBestPracticeArea(lead), "Criminal");
  });
});
