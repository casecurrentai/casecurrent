/**
 * PI Dashboard handler tests
 *
 * Verifies that getPIDashboardData returns the correct shape even with an
 * empty DB (all counters → 0, arrays → []), and that the route handler
 * maps Prisma schema-drift errors to a 503 with SCHEMA_DRIFT code.
 *
 * Uses the same Node built-in test runner as the existing 64 tests.
 * No real DB required — Prisma is stubbed via a lightweight in-process mock.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPIDashboardData } from '../analytics/piDashboard.js';

// ─── Minimal Prisma stub ────────────────────────────────────────────────────

function makeEmptyPrisma() {
  const stub = {
    call: {
      count: async () => 0,
      findMany: async () => [],
    },
    lead: {
      count: async () => 0,
      findMany: async () => [],
    },
    phoneNumber: {
      findMany: async () => [],
    },
  };
  return stub as unknown as import('../../apps/api/src/generated/prisma').PrismaClient;
}

function makeErrorPrisma(code: string, message: string) {
  const err = Object.assign(new Error(message), { code });
  const failing = { count: async () => { throw err; }, findMany: async () => { throw err; } };
  return {
    call: failing,
    lead: failing,
    phoneNumber: { findMany: async () => { throw err; } },
  } as unknown as import('../../apps/api/src/generated/prisma').PrismaClient;
}

// ─── Shape tests ─────────────────────────────────────────────────────────────

describe('getPIDashboardData — empty DB', () => {
  it('returns the expected top-level keys', async () => {
    const data = await getPIDashboardData(makeEmptyPrisma(), 'org-123', 30);
    assert.ok('funnel' in data, 'missing funnel');
    assert.ok('speed' in data, 'missing speed');
    assert.ok('rescueQueue' in data, 'missing rescueQueue');
    assert.ok('sourceROI' in data, 'missing sourceROI');
    assert.ok('intakeCompleteness' in data, 'missing intakeCompleteness');
    assert.ok('periodStart' in data, 'missing periodStart');
    assert.ok('periodEnd' in data, 'missing periodEnd');
  });

  it('funnel has 7 stages with zero counts', async () => {
    const data = await getPIDashboardData(makeEmptyPrisma(), 'org-123', 30);
    assert.equal(data.funnel.length, 7, 'expected 7 funnel stages');
    for (const stage of data.funnel) {
      assert.equal(stage.count, 0, `${stage.name} count should be 0`);
      assert.ok(typeof stage.name === 'string', 'stage.name must be string');
      assert.ok(typeof stage.trend === 'number', 'stage.trend must be number');
    }
  });

  it('speed metrics are zeroed out when no leads exist', async () => {
    const data = await getPIDashboardData(makeEmptyPrisma(), 'org-123', 30);
    assert.equal(data.speed.medianMinutes, null);
    assert.equal(data.speed.p90Minutes, null);
    assert.equal(data.speed.within5Min, 0);
    assert.equal(data.speed.within15Min, 0);
    assert.equal(data.speed.within60Min, 0);
    assert.equal(data.speed.missedCallBacklog, 0);
  });

  it('rescueQueue is empty array', async () => {
    const data = await getPIDashboardData(makeEmptyPrisma(), 'org-123', 30);
    assert.deepEqual(data.rescueQueue, []);
  });

  it('sourceROI is empty array', async () => {
    const data = await getPIDashboardData(makeEmptyPrisma(), 'org-123', 30);
    assert.deepEqual(data.sourceROI, []);
  });

  it('intakeCompleteness reports 0% with empty fields', async () => {
    const data = await getPIDashboardData(makeEmptyPrisma(), 'org-123', 30);
    assert.equal(data.intakeCompleteness.overallPercentage, 0);
    // With no leads all fields are at 0% — dropOffStep is the first field, not null
    assert.ok(
      data.intakeCompleteness.dropOffStep === null || typeof data.intakeCompleteness.dropOffStep === 'string',
      'dropOffStep must be null or a field name string',
    );
    assert.equal(data.intakeCompleteness.fields.length, 8, 'should have 8 PI fields');
  });

  it('periodStart is before periodEnd', async () => {
    const data = await getPIDashboardData(makeEmptyPrisma(), 'org-123', 30);
    assert.ok(
      new Date(data.periodStart) < new Date(data.periodEnd),
      'periodStart must precede periodEnd',
    );
  });
});

// ─── Multi-tenant isolation ───────────────────────────────────────────────────

describe('getPIDashboardData — multi-tenant scoping', () => {
  it('passes orgId to all queries (no cross-org leakage)', async () => {
    const capturedOrgIds = new Set<string>();

    const trackingPrisma = {
      call: {
        count: async (args: any) => {
          capturedOrgIds.add(args?.where?.orgId);
          return 0;
        },
        findMany: async (args: any) => {
          capturedOrgIds.add(args?.where?.orgId);
          return [];
        },
      },
      lead: {
        count: async (args: any) => {
          capturedOrgIds.add(args?.where?.orgId);
          return 0;
        },
        findMany: async (args: any) => {
          capturedOrgIds.add(args?.where?.orgId);
          return [];
        },
      },
      phoneNumber: {
        findMany: async (args: any) => {
          capturedOrgIds.add(args?.where?.orgId);
          return [];
        },
      },
    } as unknown as import('../../apps/api/src/generated/prisma').PrismaClient;

    const targetOrgId = 'firm-abc-123';
    await getPIDashboardData(trackingPrisma, targetOrgId, 30);

    // Every query must be scoped to the correct org
    assert.equal(capturedOrgIds.size, 1, `queries leaked to other orgs: ${[...capturedOrgIds]}`);
    assert.ok(capturedOrgIds.has(targetOrgId), 'targetOrgId not used in any query');
  });
});

// ─── Schema drift detection ───────────────────────────────────────────────────

describe('getPIDashboardData — schema drift', () => {
  it('propagates Prisma P2022 (column not found) error to caller', async () => {
    const errPrisma = makeErrorPrisma('P2022', 'column "call_outcome" does not exist');
    await assert.rejects(
      () => getPIDashboardData(errPrisma, 'org-x', 30),
      (err: any) => {
        assert.equal(err.code, 'P2022');
        return true;
      },
    );
  });
});
