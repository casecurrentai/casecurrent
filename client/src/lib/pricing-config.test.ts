/**
 * Sanity tests for plan usage limits and overage rate.
 *
 * Verifies exact allowances for Core/Pro/Elite (STANDARD_PLANS) and
 * confirms the universal overage rate across all plans.
 *
 * Run with: node --import tsx --test client/src/lib/pricing-config.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { STANDARD_PLANS, PILOT_PLANS } from "./pricing-config";

const OVERAGE_RATE = 0.15; // $/min — standardized across all tiers

describe("STANDARD_PLANS usage limits", () => {
  const core = STANDARD_PLANS.find((p) => p.id === "core")!;
  const pro = STANDARD_PLANS.find((p) => p.id === "pro")!;
  const elite = STANDARD_PLANS.find((p) => p.id === "elite")!;

  it("Core: 400 calls, 2400 minutes", () => {
    assert.equal(core.usage.callsPerMonth, 400);
    assert.equal(core.usage.minutesPerMonth, 2400);
  });

  it("Pro: 1000 calls, 6000 minutes", () => {
    assert.equal(pro.usage.callsPerMonth, 1000);
    assert.equal(pro.usage.minutesPerMonth, 6000);
  });

  it("Elite: 2500 calls, 15000 minutes", () => {
    assert.equal(elite.usage.callsPerMonth, 2500);
    assert.equal(elite.usage.minutesPerMonth, 15000);
  });

  it("All standard plans use $0.15/min overage", () => {
    for (const plan of STANDARD_PLANS) {
      assert.equal(
        plan.usage.overagePerMinute,
        OVERAGE_RATE,
        `${plan.id} overagePerMinute should be ${OVERAGE_RATE}`,
      );
    }
  });

  it("Core minutes in seconds = 144000", () => {
    assert.equal(core.usage.minutesPerMonth * 60, 144_000);
  });

  it("Pro minutes in seconds = 360000", () => {
    assert.equal(pro.usage.minutesPerMonth * 60, 360_000);
  });

  it("Elite minutes in seconds = 900000", () => {
    assert.equal(elite.usage.minutesPerMonth * 60, 900_000);
  });
});

describe("PILOT_PLANS usage limits", () => {
  it("All pilot plans use $0.15/min overage", () => {
    for (const plan of PILOT_PLANS) {
      assert.equal(
        plan.usage.overagePerMinute,
        OVERAGE_RATE,
        `${plan.id} overagePerMinute should be ${OVERAGE_RATE}`,
      );
    }
  });
});

describe("No stale limit values", () => {
  const allPlans = [...PILOT_PLANS, ...STANDARD_PLANS];

  it("No plan has the old Core limit of 75 calls", () => {
    for (const plan of allPlans) {
      assert.notEqual(plan.usage.callsPerMonth, 75, `${plan.id} still has stale 75-call limit`);
    }
  });

  it("No plan has the old Pro limit of 200 calls", () => {
    for (const plan of allPlans) {
      assert.notEqual(plan.usage.callsPerMonth, 200, `${plan.id} still has stale 200-call limit`);
    }
  });

  it("No plan has the old Elite limit of 500 calls", () => {
    for (const plan of allPlans) {
      assert.notEqual(plan.usage.callsPerMonth, 500, `${plan.id} still has stale 500-call limit`);
    }
  });

  it("No plan has the old 3000-minute limit", () => {
    for (const plan of allPlans) {
      assert.notEqual(plan.usage.minutesPerMonth, 3000, `${plan.id} still has stale 3000-minute limit`);
    }
  });

  it("No plan has a non-standard overage rate (0.18 or 0.20)", () => {
    for (const plan of allPlans) {
      assert.notEqual(plan.usage.overagePerMinute, 0.18, `${plan.id} has stale 0.18 rate`);
      assert.notEqual(plan.usage.overagePerMinute, 0.2, `${plan.id} has stale 0.20 rate`);
    }
  });
});
