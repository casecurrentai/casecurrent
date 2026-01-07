import { prisma } from "../db";
import type { Prisma } from "../../apps/api/src/generated/prisma";

export interface ToolCallContext {
  callId: string;
  orgId: string;
  leadId?: string;
  contactId?: string;
  interactionId?: string;
}

export interface ToolResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolCallContext
): Promise<ToolResult> {
  console.log(`[ToolRunner] Executing ${toolName}`, { args, context });

  try {
    switch (toolName) {
      case "create_lead":
        return await createLead(args, context);
      case "save_intake_answers":
        return await saveIntakeAnswers(args, context);
      case "update_lead":
        return await updateLead(args, context);
      case "warm_transfer":
        return await warmTransfer(args, context);
      case "end_call":
        return await endCall(args, context);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`[ToolRunner] Error executing ${toolName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function createLead(
  args: Record<string, unknown>,
  context: ToolCallContext
): Promise<ToolResult> {
  const { name, phone, email, source, practiceArea } = args as {
    name: string;
    phone: string;
    email?: string;
    source?: string;
    practiceArea?: string;
  };

  const phoneE164 = normalizePhone(phone);

  let contact = await prisma.contact.findFirst({
    where: {
      orgId: context.orgId,
      OR: [
        { primaryPhone: phoneE164 },
        email ? { primaryEmail: email } : {},
      ].filter(c => Object.keys(c).length > 0),
    },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        orgId: context.orgId,
        name,
        primaryPhone: phoneE164,
        primaryEmail: email || null,
      },
    });
  }

  let practiceAreaId: string | null = null;
  if (practiceArea) {
    const pa = await prisma.practiceArea.findFirst({
      where: {
        orgId: context.orgId,
        name: { contains: practiceArea.replace(/_/g, " "), mode: "insensitive" },
      },
    });
    practiceAreaId = pa?.id || null;
  }

  const lead = await prisma.lead.create({
    data: {
      orgId: context.orgId,
      contactId: contact.id,
      source: source || "phone_call",
      status: "new",
      priority: "medium",
      practiceAreaId,
    },
  });

  const interaction = await prisma.interaction.create({
    data: {
      orgId: context.orgId,
      leadId: lead.id,
      channel: "call",
      status: "active",
    },
  });

  const existingCall = await prisma.call.findFirst({
    where: { providerCallId: context.callId },
  });

  if (!existingCall) {
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { orgId: context.orgId, inboundEnabled: true },
    });

    if (phoneNumber) {
      await prisma.call.create({
        data: {
          orgId: context.orgId,
          leadId: lead.id,
          interactionId: interaction.id,
          phoneNumberId: phoneNumber.id,
          direction: "inbound",
          provider: "openai_realtime",
          providerCallId: context.callId,
          fromE164: phoneE164,
          toE164: phoneNumber.e164,
          startedAt: new Date(),
        },
      });
    } else {
      console.warn(`[ToolRunner] No phone number configured for org ${context.orgId}, skipping call record creation`);
    }
  }

  await createAuditLog(context.orgId, "create_lead", "lead", lead.id, {
    contactId: contact.id,
    source: source || "phone_call",
    callId: context.callId,
  });

  context.leadId = lead.id;
  context.contactId = contact.id;
  context.interactionId = interaction.id;

  return {
    success: true,
    data: {
      leadId: lead.id,
      contactId: contact.id,
      message: `Lead created for ${name}`,
    },
  };
}

async function saveIntakeAnswers(
  args: Record<string, unknown>,
  context: ToolCallContext
): Promise<ToolResult> {
  const { answers } = args as { answers: string };

  if (!context.leadId) {
    return { success: false, error: "No lead created yet. Call create_lead first." };
  }

  let parsedAnswers: Record<string, unknown>;
  try {
    parsedAnswers = typeof answers === "string" ? JSON.parse(answers) : answers;
  } catch {
    parsedAnswers = { raw: answers };
  }

  let intake = await prisma.intake.findFirst({
    where: { leadId: context.leadId },
  });

  if (intake) {
    const existingAnswers = (intake.answers as Record<string, unknown>) || {};
    await prisma.intake.update({
      where: { id: intake.id },
      data: {
        answers: { ...existingAnswers, ...parsedAnswers } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
  } else {
    intake = await prisma.intake.create({
      data: {
        orgId: context.orgId,
        leadId: context.leadId,
        answers: parsedAnswers as Prisma.InputJsonValue,
        completionStatus: "partial",
      },
    });
  }

  await createAuditLog(context.orgId, "save_intake_answers", "intake", intake.id, {
    leadId: context.leadId,
    answersUpdated: Object.keys(parsedAnswers),
  });

  return {
    success: true,
    data: { intakeId: intake.id, message: "Intake answers saved" },
  };
}

async function updateLead(
  args: Record<string, unknown>,
  context: ToolCallContext
): Promise<ToolResult> {
  const { status, priority, summary } = args as {
    status?: string;
    priority?: string;
    summary?: string;
  };

  if (!context.leadId) {
    return { success: false, error: "No lead created yet. Call create_lead first." };
  }

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (priority) updateData.priority = priority;
  if (summary) updateData.summary = summary;

  if (Object.keys(updateData).length === 0) {
    return { success: true, data: { message: "No updates provided" } };
  }

  await prisma.lead.update({
    where: { id: context.leadId },
    data: updateData,
  });

  await createAuditLog(context.orgId, "update_lead", "lead", context.leadId, {
    updates: updateData,
  });

  return {
    success: true,
    data: { leadId: context.leadId, message: "Lead updated" },
  };
}

async function warmTransfer(
  args: Record<string, unknown>,
  context: ToolCallContext
): Promise<ToolResult> {
  const { reason, urgency } = args as { reason: string; urgency?: string };

  if (context.leadId) {
    await prisma.interaction.create({
      data: {
        orgId: context.orgId,
        leadId: context.leadId,
        channel: "call",
        status: "pending",
        metadata: {
          type: "transfer_request",
          reason,
          urgency: urgency || "routine",
          requestedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }

  await createAuditLog(
    context.orgId,
    "warm_transfer_requested",
    "call",
    context.callId,
    {
      leadId: context.leadId,
      reason,
      urgency: urgency || "routine",
    }
  );

  console.log(`[ToolRunner] Warm transfer requested for call ${context.callId}:`, {
    reason,
    urgency,
  });

  return {
    success: true,
    data: {
      message: "Transfer request logged. In Phase 2, this will connect to a live agent.",
      transferPending: true,
    },
  };
}

async function endCall(
  args: Record<string, unknown>,
  context: ToolCallContext
): Promise<ToolResult> {
  const { outcome, notes } = args as { outcome: string; notes?: string };

  if (context.leadId) {
    const intake = await prisma.intake.findFirst({
      where: { leadId: context.leadId },
    });

    if (intake && outcome === "intake_complete") {
      await prisma.intake.update({
        where: { id: intake.id },
        data: {
          completionStatus: "complete",
          completedAt: new Date(),
        },
      });
    }

    await prisma.lead.update({
      where: { id: context.leadId },
      data: {
        status: outcome === "intake_complete" ? "contacted" : "new",
      },
    });
  }

  const call = await prisma.call.findFirst({
    where: { providerCallId: context.callId },
  });

  if (call) {
    await prisma.call.update({
      where: { id: call.id },
      data: {
        endedAt: new Date(),
        durationSeconds: call.startedAt
          ? Math.floor((Date.now() - call.startedAt.getTime()) / 1000)
          : null,
        aiSummary: notes || null,
      },
    });
  }

  await createAuditLog(context.orgId, "call_ended", "call", context.callId, {
    leadId: context.leadId,
    outcome,
    notes,
  });

  return {
    success: true,
    data: { outcome, message: "Call ended successfully" },
  };
}

async function createAuditLog(
  orgId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId,
        actorType: "ai",
        action,
        entityType,
        entityId,
        details: details as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("[ToolRunner] Failed to create audit log:", error);
  }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return phone.startsWith("+") ? phone : `+${digits}`;
}
