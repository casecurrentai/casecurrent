/**
 * Calls route module.
 *
 * GET /v1/calls          — Org-scoped calls inbox (DB index only, fast)
 * GET /v1/calls/:callId  — Single call detail with resolved caller name
 * GET /v1/calls/:callId/artifacts — Vapi artifacts, cached 6h per firm+call
 *
 * All routes require auth and are scoped to req.user.orgId (multi-tenant safe).
 * The Vapi API key is server-only — never reaches the browser.
 */

import { Router } from 'express';
import * as crypto from 'node:crypto';
import { prisma } from '../db';
import { authMiddleware, type AuthenticatedRequest } from '../auth';
import { fetchVapiCall, normalizeVapiCallArtifact } from '../services/vapiClient';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format E.164 number as US display string, e.g. "+15045551212" → "(504) 555-1212" */
function formatPhone(e164: string | null | undefined): string | null {
  if (!e164) return null;
  // Strip synthetic web-visitor IDs
  if (e164.startsWith('+0web')) return null;
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return e164;
}

/**
 * Resolve a human-readable display name for the caller.
 * Priority: Contact.name > Lead.displayName > formatted E.164 > "Unknown Caller"
 */
function resolveCallerName(opts: {
  contactName?: string | null;
  leadDisplayName?: string | null;
  fromE164?: string | null;
}): string {
  const { contactName, leadDisplayName, fromE164 } = opts;
  const GENERIC = new Set(['Unknown Caller', 'Web Visitor', 'Web Caller', 'Mobile Caller']);

  if (contactName && !GENERIC.has(contactName)) return contactName;
  if (leadDisplayName && !GENERIC.has(leadDisplayName)) return leadDisplayName;
  const formatted = formatPhone(fromE164);
  if (formatted) return formatted;
  return 'Unknown Caller';
}

/** Compute call badges for the inbox row */
function computeBadges(call: {
  callOutcome: string | null;
  durationSeconds: number | null;
  aiFlags: unknown;
  startedAt: Date;
}): string[] {
  const badges: string[] = [];
  const hour = call.startedAt.getHours();
  const isAfterHours = hour < 8 || hour >= 18;
  if (isAfterHours) badges.push('after-hours');
  if (!call.durationSeconds || call.durationSeconds === 0) badges.push('missed');
  if (call.callOutcome === 'voicemail') badges.push('voicemail');
  const flags = (call.aiFlags ?? {}) as Record<string, unknown>;
  if (
    flags?.urgency === 'high' ||
    flags?.hotLead ||
    flags?.avery_urgency_level === 'high' ||
    flags?.avery_urgency_level === 'critical'
  ) badges.push('high-value');
  return badges;
}

// ─── GET /v1/calls — Inbox list ───────────────────────────────────────────────

/**
 * Returns the calls inbox for the authenticated org.
 * Query params:
 *   filter: "new_leads" | "missed" | "high_value" | "needs_followup" | "all" (default: "all")
 *   limit: number (default 50, max 100)
 *   cursor: ISO timestamp for pagination (before this time)
 */
router.get('/v1/calls', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const reqId = crypto.randomUUID().slice(0, 8);
  try {
    const orgId = req.user!.orgId;
    const filter = (req.query.filter as string) || 'all';
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const cursor = req.query.cursor ? new Date(req.query.cursor as string) : undefined;

    const where: Record<string, unknown> = { orgId };
    if (cursor) {
      where.startedAt = { lt: cursor };
    }

    if (filter === 'missed') {
      where.OR = [
        { callOutcome: { in: ['no-answer', 'busy', 'voicemail'] } },
        { callOutcome: null, durationSeconds: null, endedAt: { not: null } },
      ];
      where.resolved = false;
    } else if (filter === 'needs_followup') {
      where.resolved = false;
      where.endedAt = { not: null };
    }

    const calls = await prisma.call.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        orgId: true,
        leadId: true,
        direction: true,
        provider: true,
        providerCallId: true,
        status: true,
        callOutcome: true,
        endReason: true,
        startedAt: true,
        endedAt: true,
        durationSeconds: true,
        fromE164: true,
        toE164: true,
        aiSummary: true,
        aiFlags: true,
        transcriptText: true,
        recordingUrl: true,
        resolved: true,
        lead: {
          select: {
            id: true,
            status: true,
            displayName: true,
            score: true,
            contact: {
              select: { name: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    const items = calls.map((c) => {
      const callerName = resolveCallerName({
        contactName: c.lead?.contact?.name,
        leadDisplayName: c.lead?.displayName,
        fromE164: c.fromE164,
      });
      const badges = computeBadges({
        callOutcome: c.callOutcome,
        durationSeconds: c.durationSeconds,
        aiFlags: c.aiFlags,
        startedAt: c.startedAt,
      });

      return {
        id: c.id,
        leadId: c.leadId,
        direction: c.direction,
        provider: c.provider,
        vapiCallId: c.providerCallId,
        status: c.status,
        callOutcome: c.callOutcome,
        startedAt: c.startedAt.toISOString(),
        endedAt: c.endedAt?.toISOString() ?? null,
        durationSeconds: c.durationSeconds,
        callerName,
        callerPhone: formatPhone(c.fromE164),
        summary: c.aiSummary ? c.aiSummary.slice(0, 160) : null,
        badges,
        hasTranscript: !!c.transcriptText,
        hasRecording: !!c.recordingUrl,
        resolved: c.resolved,
        leadStatus: c.lead?.status ?? null,
        leadScore: c.lead?.score ?? null,
      };
    });

    // Apply high_value / new_leads filter after enrichment (needs badges/score)
    let filtered = items;
    if (filter === 'high_value') {
      filtered = items.filter((i) => i.badges.includes('high-value') || (i.leadScore ?? 0) >= 70);
    } else if (filter === 'new_leads') {
      filtered = items.filter((i) => i.leadStatus === 'new' || i.leadStatus === 'intake_started');
    }

    res.json({
      calls: filtered,
      count: filtered.length,
      hasMore: calls.length === limit,
      nextCursor: calls.length === limit ? calls[calls.length - 1].startedAt.toISOString() : null,
    });
  } catch (err: any) {
    console.error(JSON.stringify({
      tag: 'calls_inbox_error',
      reqId,
      orgId: req.user?.orgId,
      error: err?.message,
      code: err?.code,
    }));
    res.status(500).json({ error: 'Failed to load calls' });
  }
});

// ─── GET /v1/calls/:callId — Single call detail ───────────────────────────────

router.get('/v1/calls/:callId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const reqId = crypto.randomUUID().slice(0, 8);
  try {
    const orgId = req.user!.orgId;
    const { callId } = req.params;

    const call = await prisma.call.findFirst({
      where: { id: callId, orgId },
      select: {
        id: true,
        orgId: true,
        leadId: true,
        direction: true,
        provider: true,
        providerCallId: true,
        status: true,
        callOutcome: true,
        endReason: true,
        startedAt: true,
        endedAt: true,
        durationSeconds: true,
        fromE164: true,
        toE164: true,
        aiSummary: true,
        aiFlags: true,
        structuredData: true,
        successEvaluation: true,
        transcriptText: true,
        transcriptJson: true,
        messagesJson: true,
        recordingUrl: true,
        resolved: true,
        resolvedAt: true,
        lead: {
          select: {
            id: true,
            status: true,
            displayName: true,
            score: true,
            priority: true,
            practiceAreaId: true,
            consultScheduledAt: true,
            retainerSignedAt: true,
            contact: {
              select: { name: true, firstName: true, lastName: true, primaryEmail: true },
            },
          },
        },
      },
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const callerName = resolveCallerName({
      contactName: call.lead?.contact?.name,
      leadDisplayName: call.lead?.displayName,
      fromE164: call.fromE164,
    });

    res.json({
      ...call,
      startedAt: call.startedAt.toISOString(),
      endedAt: call.endedAt?.toISOString() ?? null,
      resolvedAt: call.resolvedAt?.toISOString() ?? null,
      lead: call.lead ? {
        ...call.lead,
        consultScheduledAt: call.lead.consultScheduledAt?.toISOString() ?? null,
        retainerSignedAt: call.lead.retainerSignedAt?.toISOString() ?? null,
      } : null,
      callerName,
      callerPhone: formatPhone(call.fromE164),
      vapiCallId: call.providerCallId,
      hasTranscript: !!call.transcriptText,
      hasRecording: !!call.recordingUrl,
    });
  } catch (err: any) {
    console.error(JSON.stringify({
      tag: 'call_detail_error',
      reqId,
      orgId: req.user?.orgId,
      error: err?.message,
      code: err?.code,
    }));
    res.status(500).json({ error: 'Failed to load call' });
  }
});

// ─── GET /v1/calls/:callId/artifacts — Vapi artifacts (cached) ───────────────

/**
 * Fetches Vapi call artifacts (transcript, recording, summary).
 * Cache TTL: VAPI_ARTIFACT_TTL_HOURS (default 6h).
 * Returns 409 if vapiCallId (providerCallId) is missing.
 * Returns 503 if Vapi is down but no cache exists.
 */
router.get('/v1/calls/:callId/artifacts', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const reqId = crypto.randomUUID().slice(0, 8);
  try {
    const orgId = req.user!.orgId;
    const { callId } = req.params;

    // 1. Load call — verify org ownership (tenant safety)
    const call = await prisma.call.findFirst({
      where: { id: callId, orgId },
      select: { id: true, orgId: true, providerCallId: true },
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    if (!call.providerCallId) {
      return res.status(409).json({
        error: 'no_vapi_call_id',
        message: 'This call has no Vapi call ID — artifacts are unavailable. The call may have been created by another provider.',
      });
    }

    const vapiCallId = call.providerCallId;
    const firmId = orgId;

    // 2. Check cache
    const cached = await (prisma as any).callArtifactCache.findUnique({
      where: { firmId_vapiCallId_kind: { firmId, vapiCallId, kind: 'full_call' } },
    }).catch(() => null); // graceful if table missing

    const now = new Date();
    if (cached && new Date(cached.expiresAt) > now) {
      console.log(JSON.stringify({ tag: 'artifacts_cache_hit', reqId, callId, vapiCallId }));
      return res.json({ ...cached.payloadJson, source: 'cache' });
    }

    // 3. Fetch from Vapi
    console.log(JSON.stringify({ tag: 'artifacts_fetch_start', reqId, callId, vapiCallId }));
    const rawCall = await fetchVapiCall(vapiCallId);

    if (!rawCall) {
      // Return cached (even if stale) as fallback; else 503
      if (cached) {
        console.log(JSON.stringify({ tag: 'artifacts_stale_fallback', reqId, callId }));
        return res.json({ ...cached.payloadJson, source: 'stale_cache' });
      }
      return res.status(503).json({
        error: 'vapi_unavailable',
        message: 'Could not fetch artifacts from Vapi. Retry shortly.',
      });
    }

    // 4. Normalize
    const artifact = normalizeVapiCallArtifact(rawCall);

    // 5. Upsert cache (best-effort — never fail the request on cache error)
    const cacheId = crypto.randomUUID();
    await (prisma as any).callArtifactCache.upsert({
      where: { firmId_vapiCallId_kind: { firmId, vapiCallId, kind: 'full_call' } },
      create: {
        id: cacheId,
        firmId,
        vapiCallId,
        kind: 'full_call',
        payloadJson: artifact as any,
        fetchedAt: new Date(artifact.fetchedAt),
        expiresAt: new Date(artifact.expiresAt),
      },
      update: {
        payloadJson: artifact as any,
        fetchedAt: new Date(artifact.fetchedAt),
        expiresAt: new Date(artifact.expiresAt),
      },
    }).catch((err: any) => {
      console.warn(JSON.stringify({ tag: 'artifact_cache_write_fail', reqId, callId, error: err?.message }));
    });

    console.log(JSON.stringify({
      tag: 'artifacts_fetched',
      reqId,
      callId,
      vapiCallId,
      hasTranscript: artifact.transcript.length > 0,
      hasRecording: !!artifact.recordingUrl,
      durationSec: artifact.durationSec,
    }));

    res.json({ ...artifact, source: 'fresh' });
  } catch (err: any) {
    console.error(JSON.stringify({
      tag: 'artifacts_error',
      reqId,
      orgId: req.user?.orgId,
      error: err?.message,
      code: err?.code,
    }));
    res.status(500).json({ error: 'Failed to load artifacts' });
  }
});

export default router;
