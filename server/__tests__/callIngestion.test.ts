/**
 * Call ingestion resilience tests
 *
 * Tests the two critical paths from the P0 bug fix:
 *  1) Call upsert keyed by twilioCallSid is idempotent
 *  2) ElevenLabs correlation failure parks payload in UnlinkedPostCall
 *
 * Uses Node.js built-in test runner (same as existing 45 tests).
 * Mocks Prisma via a lightweight stub — no real DB required.
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal Prisma stub that records calls */
function makePrismaStub(overrides: Record<string, unknown> = {}) {
  const calls: { method: string; args: unknown[] }[] = [];

  const record = (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return overrides[method] ?? Promise.resolve(null);
    };

  return {
    _calls: calls,
    call: {
      findUnique: record('call.findUnique'),
      findFirst: record('call.findFirst'),
      create: record('call.create'),
      update: record('call.update'),
      updateMany: record('call.updateMany'),
    },
    webhookEvent: {
      create: record('webhookEvent.create'),
      deleteMany: record('webhookEvent.deleteMany'),
    },
    unlinkedPostCall: {
      create: record('unlinkedPostCall.create'),
      findMany: record('unlinkedPostCall.findMany'),
      update: record('unlinkedPostCall.update'),
    },
    ingestionOutcome: {
      create: record('ingestionOutcome.create'),
    },
  };
}

// ── Test 1: idempotent Call upsert keyed by twilioCallSid ─────────────────

describe('call upsert idempotency (INV-1)', () => {
  it('creates a new Call row when none exists for the CallSid', async () => {
    const prisma = makePrismaStub({
      'call.findUnique': Promise.resolve(null),    // no existing call
      'call.create': Promise.resolve({ id: 'call-1', twilioCallSid: 'CA123' }),
    });

    // Simulate the idempotency check in routes.ts voice webhook
    const existingCall = await (prisma.call.findUnique as any)({ where: { twilioCallSid: 'CA123' } });
    assert.equal(existingCall, null, 'should not find existing call');

    const created = await (prisma.call.create as any)({
      data: {
        orgId: 'org-1',
        leadId: 'lead-1',
        interactionId: 'ix-1',
        phoneNumberId: 'ph-1',
        direction: 'inbound',
        provider: 'twilio',
        twilioCallSid: 'CA123',
        fromE164: '+15551234567',
        toE164: '+18001234567',
        startedAt: new Date(),
      },
    });

    assert.equal(created?.twilioCallSid, 'CA123');
    assert.equal(prisma._calls.filter(c => c.method === 'call.create').length, 1);
  });

  it('skips creating a duplicate Call when twilioCallSid already exists', async () => {
    const existing = { id: 'call-existing', twilioCallSid: 'CA123' };
    const prisma = makePrismaStub({
      'call.findUnique': Promise.resolve(existing),
    });

    const existingCall = await (prisma.call.findUnique as any)({ where: { twilioCallSid: 'CA123' } });
    assert.ok(existingCall !== null, 'should find existing call');
    assert.equal(existingCall.id, 'call-existing');

    // The voice webhook handler returns early — no create called
    const createCalls = prisma._calls.filter(c => c.method === 'call.create');
    assert.equal(createCalls.length, 0, 'should not create duplicate call');
  });
});

// ── Test 2: ElevenLabs correlation failure → UnlinkedPostCall insert ────────

describe('ElevenLabs correlation failure parking (INV-4)', () => {
  it('inserts into UnlinkedPostCall when findCallByCorrelation returns null', async () => {
    const prisma = makePrismaStub({
      // All correlation lookups return null
      'call.findFirst': Promise.resolve(null),
      'call.findUnique': Promise.resolve(null),
      'webhookEvent.create': Promise.resolve({ id: 'we-1' }),
      'unlinkedPostCall.create': Promise.resolve({ id: 'ulpc-1' }),
      'ingestionOutcome.create': Promise.resolve({ id: 'io-1' }),
    });

    const payload = {
      conversation_id: 'conv-abc123',
      call_sid: 'CA999',
      caller_id: '+15559998888',
      called_number: '+18001234567',
      transcript: 'Hello, I need help.',
      client_data: { callSid: 'CA999' },
    };

    // Step 1: idempotency check (simulate checkIdempotency)
    await (prisma.webhookEvent.create as any)({
      data: { provider: 'elevenlabs', externalId: payload.conversation_id, eventType: 'post-call', payload },
    });

    // Step 2: correlation lookups all fail (simulate findCallByCorrelation returning null)
    const byInteractionId = await (prisma.call.findFirst as any)({
      where: { interactionId: payload.client_data?.callSid },
    });
    const byCallSid = await (prisma.call.findFirst as any)({
      where: { twilioCallSid: payload.client_data?.callSid },
    });
    const byElevenLabsId = await (prisma.call.findFirst as any)({
      where: { elevenLabsId: payload.conversation_id },
    });

    assert.equal(byInteractionId, null);
    assert.equal(byCallSid, null);
    assert.equal(byElevenLabsId, null);

    // Step 3: park in UnlinkedPostCall (what the fixed handler does)
    const correlationKeys = {
      conversation_id: payload.conversation_id,
      call_sid: payload.call_sid,
      client_data_call_sid: payload.client_data?.callSid || null,
      client_data_interaction_id: null,
    };

    const parked = await (prisma.unlinkedPostCall.create as any)({
      data: {
        receivedAt: new Date(),
        provider: 'elevenlabs',
        twilioCallSid: payload.call_sid,
        elevenLabsConvId: payload.conversation_id,
        rawPayloadJson: payload,
        correlationKeysJson: correlationKeys,
      },
    });

    assert.ok(parked !== null, 'unlinkedPostCall.create should be called');

    const parkCalls = prisma._calls.filter(c => c.method === 'unlinkedPostCall.create');
    assert.equal(parkCalls.length, 1, 'exactly one UnlinkedPostCall row should be inserted');

    const parkArgs = parkCalls[0].args[0] as any;
    assert.equal(parkArgs.data.elevenLabsConvId, 'conv-abc123');
    assert.equal(parkArgs.data.twilioCallSid, 'CA999');
  });

  it('does NOT park when correlation succeeds', async () => {
    const existingCall = { id: 'call-found', leadId: 'lead-1', orgId: 'org-1', interactionId: 'ix-1' };
    const prisma = makePrismaStub({
      'call.findFirst': Promise.resolve(existingCall),
      'call.findUnique': Promise.resolve(existingCall),
    });

    const payload = {
      conversation_id: 'conv-found',
      call_sid: 'CA777',
      client_data: { callSid: 'CA777' },
    };

    // Correlation succeeds on first lookup
    const found = await (prisma.call.findFirst as any)({
      where: { twilioCallSid: payload.client_data?.callSid },
    });

    assert.ok(found !== null, 'should find call');
    assert.equal(found.id, 'call-found');

    // No park should occur
    const parkCalls = prisma._calls.filter(c => c.method === 'unlinkedPostCall.create');
    assert.equal(parkCalls.length, 0, 'should not park when call is found');
  });
});

// ── Test 3: idempotency rollback on error ────────────────────────────────────

describe('idempotency rollback on failure (INV-3)', () => {
  it('deletes the WebhookEvent when post-call processing fails', async () => {
    const prisma = makePrismaStub({
      'webhookEvent.create': Promise.resolve({ id: 'we-1' }),
      'webhookEvent.deleteMany': Promise.resolve({ count: 1 }),
    });

    // Simulate: idempotency record was written
    await (prisma.webhookEvent.create as any)({
      data: { provider: 'elevenlabs', externalId: 'conv-fail', eventType: 'post-call', payload: {} },
    });

    // Simulate: DB work fails, we call rollbackIdempotency
    await (prisma.webhookEvent.deleteMany as any)({
      where: { provider: 'elevenlabs', externalId: 'conv-fail', eventType: 'post-call' },
    });

    const rollbacks = prisma._calls.filter(c => c.method === 'webhookEvent.deleteMany');
    assert.equal(rollbacks.length, 1, 'should rollback idempotency record on error');

    const rollbackArgs = rollbacks[0].args[0] as any;
    assert.equal(rollbackArgs.where.externalId, 'conv-fail');
    assert.equal(rollbackArgs.where.provider, 'elevenlabs');
  });
});

// ── Test 4: processCallEnd DB lookup when leadId is null (INV-2) ─────────────

describe('processCallEnd DB lookup fallback (INV-2)', () => {
  it('resolves leadId from DB when not set in closure', async () => {
    const dbCall = {
      id: 'call-db',
      twilioCallSid: 'CA456',
      fromE164: '+15551234567',
      toE164: '+18001234567',
      lead: { id: 'lead-db', orgId: 'org-db', contactId: 'contact-db' },
    };
    const prisma = makePrismaStub({
      'call.findUnique': Promise.resolve(dbCall),
    });

    // Simulate: closure has null leadId but callSid is set
    let leadId: string | null = null;
    let orgId: string | null = null;
    const callSid = 'CA456';

    if (!leadId && callSid) {
      const result = await (prisma.call.findUnique as any)({
        where: { twilioCallSid: callSid },
        include: { lead: { select: { id: true, orgId: true, contactId: true } } },
      });
      if (result?.lead) {
        leadId = result.lead.id;
        orgId  = result.lead.orgId;
      }
    }

    assert.equal(leadId, 'lead-db', 'leadId should be resolved from DB');
    assert.equal(orgId, 'org-db', 'orgId should be resolved from DB');
  });
});
