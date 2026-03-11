/**
 * Sanity tests for plan usage limits and overage rate.
 *
 * Verifies exact allowances for Core/Pro/Elite (STANDARD_PLANS) and
 * confirms the overage rates across all plans.
 *
 * Run with: node --import tsx --test client/src/lib/pricing-config.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { STANDARD_PLANS, PILOT_PLANS } from "./pricing-config";

describe("STANDARD_PLANS usage limits", () => {
  const core = STANDARD_PLANS.find((p) => p.id === "core")!;
  const pro = STANDARD_PLANS.find((p) => p.id === "pro")!;
  const elite = STANDARD_PLANS.find((p) => p.id === "elite")!;

  it("Core: 200 calls, 1200 minutes", () => {
    assert.equal(core.usage.callsPerMonth, 200);
    assert.equal(core.usage.minutesPerMonth, 1200);
  });

  it("Pro: 500 calls, 3000 minutes", () => {
    assert.equal(pro.usage.callsPerMonth, 500);
    assert.equal(pro.usage.minutesPerMonth, 3000);
  });

  it("Elite: 1200 calls, 7200 minutes", () => {
    assert.equal(elite.usage.callsPerMonth, 1200);
    assert.equal(elite.usage.minutesPerMonth, 7200);
  });

  it("Standard plan overage rates", () => {
    assert.equal(
      core.usage.overagePerMinute,
      0.2,
      "core overagePerMinute should be 0.20",
    );
    assert.equal(
      pro.usage.overagePerMinute,
      0.18,
      "pro overagePerMinute should be 0.18",
    );
    assert.equal(
      elite.usage.overagePerMinute,
      0.15,
      "elite overagePerMinute should be 0.15",
    );
  });

  it("Core minutes in seconds = 72000", () => {
    assert.equal(core.usage.minutesPerMonth * 60, 72_000);
  });

  it("Pro minutes in seconds = 180000", () => {
    assert.equal(pro.usage.minutesPerMonth * 60, 180_000);
  });

  it("Elite minutes in seconds = 432000", () => {
    assert.equal(elite.usage.minutesPerMonth * 60, 432_000);
  });
});

describe("PILOT_PLANS usage limits", () => {
  it("Core Pilot: 200 calls, 1200 minutes, $0.20/min overage", () => {
    const corePilot = PILOT_PLANS.find((p) => p.id === "core-pilot")!;
    assert.equal(corePilot.usage.callsPerMonth, 200);
    assert.equal(corePilot.usage.minutesPerMonth, 1200);
    assert.equal(corePilot.usage.overagePerMinute, 0.2);
  });

  it("Pro Pilot: 500 calls, 3000 minutes, $0.18/min overage", () => {
    const proPilot = PILOT_PLANS.find((p) => p.id === "pro-pilot")!;
    assert.equal(proPilot.usage.callsPerMonth, 500);
    assert.equal(proPilot.usage.minutesPerMonth, 3000);
    assert.equal(proPilot.usage.overagePerMinute, 0.18);
  });
});

describe("No stale limit values", () => {
  const allPlans = [...PILOT_PLANS, ...STANDARD_PLANS];

  it("No plan has the old Core limit of 75 calls", () => {
    for (const plan of allPlans) {
      assert.notEqual(plan.usage.callsPerMonth, 75, `${plan.id} still has stale 75-call limit`);
    }
  });

  it("No plan has the old Core limit of 50 calls", () => {
    for (const plan of allPlans) {
      assert.notEqual(plan.usage.callsPerMonth, 50, `${plan.id} still has stale 50-call limit`);
    }
  });

  it("No plan has the old Core limit of 300 minutes", () => {
    for (const plan of allPlans) {
      assert.notEqual(plan.usage.minutesPerMonth, 300, `${plan.id} still has stale 300-minute limit`);
    }
  });

  it("No plan has the old Core limit of 450 minutes", () => {
    for (const plan of allPlans) {
      assert.notEqual(plan.usage.minutesPerMonth, 450, `${plan.id} still has stale 450-minute limit`);
    }
  });

  it("No plan has the old Pro limit of 150 calls", () => {
    for (const plan of allPlans) {
      assert.notEqual(plan.usage.callsPerMonth, 150, `${plan.id} still has stale 150-call limit`);
    }
  });

  it("No plan has the old Pro limit of 900 minutes", () => {
    for (const plan of allPlans) {
      assert.notEqual(plan.usage.minutesPerMonth, 900, `${plan.id} still has stale 900-minute limit`);
    }
  });
});
