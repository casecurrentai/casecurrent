import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware, type AuthenticatedRequest } from '../auth';

const router = Router();

/**
 * GET /v1/debug/call-lookup
 *
 * Debug endpoint to trace a call through the full pipeline.
 * Accepts: ?callSid=<twilioCallSid> | ?callId=<uuid> | ?leadId=<uuid> | ?elevenLabsId=<id>
 * Returns: Call, Lead, Contact, Interaction, PhoneNumber, Organization,
 *          plus a "dashboardVisible" flag that simulates the /v1/leads query.
 *
 * Protected by authMiddleware — requires valid JWT.
 * Scoped to caller's orgId (multi-tenant safe), unless isPlatformAdmin.
 */
router.get('/v1/debug/call-lookup', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { callSid, callId, leadId, elevenLabsId, phone } = req.query;

    if (!callSid && !callId && !leadId && !elevenLabsId && !phone) {
      return res.status(400).json({
        error: 'Provide at least one of: callSid, callId, leadId, elevenLabsId, phone',
      });
    }

    const orgScope = user.isPlatformAdmin ? undefined : user.orgId;

    // --- 1. Find the Call record ---
    let call: any = null;

    if (callSid) {
      call = await prisma.call.findFirst({
        where: {
          OR: [
            { twilioCallSid: callSid as string },
            { providerCallId: callSid as string },
          ],
          ...(orgScope ? { orgId: orgScope } : {}),
        },
        include: {
          lead: { include: { contact: true, practiceArea: true, intake: true, qualification: true } },
          interaction: true,
          phoneNumber: true,
          organization: { select: { id: true, name: true, slug: true, status: true, timezone: true } },
        },
      });
    }

    if (!call && callId) {
      call = await prisma.call.findFirst({
        where: {
          id: callId as string,
          ...(orgScope ? { orgId: orgScope } : {}),
        },
        include: {
          lead: { include: { contact: true, practiceArea: true, intake: true, qualification: true } },
          interaction: true,
          phoneNumber: true,
          organization: { select: { id: true, name: true, slug: true, status: true, timezone: true } },
        },
      });
    }

    if (!call && elevenLabsId) {
      call = await prisma.call.findFirst({
        where: {
          elevenLabsId: elevenLabsId as string,
          ...(orgScope ? { orgId: orgScope } : {}),
        },
        include: {
          lead: { include: { contact: true, practiceArea: true, intake: true, qualification: true } },
          interaction: true,
          phoneNumber: true,
          organization: { select: { id: true, name: true, slug: true, status: true, timezone: true } },
        },
      });
    }

    // --- 2. If only leadId given, find lead directly ---
    let lead: any = null;
    if (!call && leadId) {
      lead = await prisma.lead.findFirst({
        where: {
          id: leadId as string,
          ...(orgScope ? { orgId: orgScope } : {}),
        },
        include: {
          contact: true,
          practiceArea: true,
          intake: true,
          qualification: true,
          calls: { include: { phoneNumber: true, interaction: true }, orderBy: { createdAt: 'desc' }, take: 5 },
          interactions: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      });
    }

    // --- 3. If phone number given, check PhoneNumber table ---
    let phoneRecord: any = null;
    if (phone) {
      const digits = (phone as string).replace(/\D/g, '');
      const candidates: string[] = [phone as string];
      if (digits) candidates.push(`+${digits}`);
      if (digits.length === 10) candidates.push(`+1${digits}`);
      if (digits.length === 11 && digits.startsWith('1')) candidates.push(`+${digits}`);

      phoneRecord = await prisma.phoneNumber.findFirst({
        where: { e164: { in: [...new Set(candidates)] } },
        include: { organization: { select: { id: true, name: true, slug: true, status: true } } },
      });
    }

    // --- 4. Dashboard visibility simulation ---
    const targetOrgId = call?.orgId || lead?.orgId || orgScope;
    const targetLeadId = call?.leadId || lead?.id;
    let dashboardVisible = false;
    let dashboardQueryDiag: any = null;

    if (targetLeadId && targetOrgId) {
      // Simulate the exact /v1/leads query
      const dashboardLead = await prisma.lead.findFirst({
        where: { id: targetLeadId, orgId: targetOrgId },
        select: { id: true, status: true, createdAt: true },
      });

      if (dashboardLead) {
        // Check that user's orgId matches
        dashboardVisible = user.orgId === targetOrgId || !!user.isPlatformAdmin;
        dashboardQueryDiag = {
          leadFoundInDb: true,
          leadOrgId: targetOrgId,
          userOrgId: user.orgId,
          orgMatch: user.orgId === targetOrgId,
          leadStatus: dashboardLead.status,
          leadCreatedAt: dashboardLead.createdAt,
        };
      } else {
        dashboardQueryDiag = {
          leadFoundInDb: false,
          searchedLeadId: targetLeadId,
          searchedOrgId: targetOrgId,
        };
      }
    }

    // --- 5. Check for webhook receipts ---
    let webhookReceipts: any[] = [];
    const callSidValue = (callSid as string) || call?.twilioCallSid || call?.providerCallId;
    if (callSidValue) {
      webhookReceipts = await prisma.webhookReceipt.findMany({
        where: { webhookId: { contains: callSidValue } },
        orderBy: { processedAt: 'desc' },
        take: 10,
      });
    }

    // --- 6. Assemble response ---
    const result: any = {
      found: !!(call || lead),
      traceId: callSidValue || targetLeadId || null,
      dashboardVisible,
      dashboardQueryDiag,
    };

    if (call) {
      result.call = {
        id: call.id,
        orgId: call.orgId,
        leadId: call.leadId,
        interactionId: call.interactionId,
        direction: call.direction,
        provider: call.provider,
        twilioCallSid: call.twilioCallSid,
        providerCallId: call.providerCallId,
        elevenLabsId: call.elevenLabsId,
        fromE164: call.fromE164,
        toE164: call.toE164,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        durationSeconds: call.durationSeconds,
        callOutcome: call.callOutcome,
        resolved: call.resolved,
        hasTranscript: !!call.transcriptText,
        transcriptLength: call.transcriptText?.length || 0,
        hasAiSummary: !!call.aiSummary,
        hasRecording: !!call.recordingUrl,
        aiFlags: call.aiFlags,
        createdAt: call.createdAt,
      };
      result.lead = call.lead;
      result.interaction = call.interaction;
      result.phoneNumber = call.phoneNumber ? {
        id: call.phoneNumber.id,
        e164: call.phoneNumber.e164,
        label: call.phoneNumber.label,
        provider: call.phoneNumber.provider,
        inboundEnabled: call.phoneNumber.inboundEnabled,
        orgId: call.phoneNumber.orgId,
      } : null;
      result.organization = call.organization;
    } else if (lead) {
      result.lead = lead;
    }

    if (phoneRecord) {
      result.phoneNumberLookup = {
        id: phoneRecord.id,
        e164: phoneRecord.e164,
        label: phoneRecord.label,
        provider: phoneRecord.provider,
        inboundEnabled: phoneRecord.inboundEnabled,
        orgId: phoneRecord.orgId,
        organization: phoneRecord.organization,
      };
    }

    if (webhookReceipts.length > 0) {
      result.webhookReceipts = webhookReceipts;
    }

    console.log(JSON.stringify({
      event: 'debug_call_lookup',
      userId: user.userId,
      orgId: user.orgId,
      query: { callSid, callId, leadId, elevenLabsId, phone },
      found: result.found,
      dashboardVisible: result.dashboardVisible,
    }));

    res.json(result);
  } catch (error: any) {
    console.error('[debug/call-lookup] error:', error?.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /v1/debug/phone-numbers
 *
 * Lists all phone numbers for the caller's org (or all, if platform admin).
 * Useful for verifying inboundEnabled status and e164 format.
 */
router.get('/v1/debug/phone-numbers', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const orgScope = user.isPlatformAdmin ? undefined : user.orgId;

    const phoneNumbers = await prisma.phoneNumber.findMany({
      where: orgScope ? { orgId: orgScope } : {},
      select: {
        id: true,
        e164: true,
        label: true,
        provider: true,
        inboundEnabled: true,
        orgId: true,
        sourceTag: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ phoneNumbers, count: phoneNumbers.length });
  } catch (error: any) {
    console.error('[debug/phone-numbers] error:', error?.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
