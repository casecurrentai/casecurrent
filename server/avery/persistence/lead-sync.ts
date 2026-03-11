/**
 * Lead sync — applies Avery extraction results to the Lead record.
 *
 * This module enhances existing lead data without overwriting trusted values.
 * If a name was already set on the lead (and it's not a generic placeholder),
 * we do not override it.
 *
 * Safe to call even if extraction yielded low confidence — the data is still
 * stored under intakeData.avery_extraction for the dashboard to surface.
 *
 * Never throws.
 */

import { PrismaClient } from '../../../apps/api/src/generated/prisma';
import { ExtractionResult } from '../types';
import { logAveryEvent } from './event-log';

// Generic names that Avery should replace with a real extracted name
const GENERIC_DISPLAY_NAMES = new Set([
  'unknown caller',
  'web caller',
  'unknown',
  'caller',
  '',
]);

/** Maps Avery's 4-level UrgencyLevel to the Lead.urgency 3-value field. */
function mapUrgencyToLeadField(urgency: string): string {
  // Lead.urgency accepts: low, medium, high, normal (legacy default)
  if (urgency === 'critical') return 'high';
  if (urgency === 'low' || urgency === 'medium' || urgency === 'high') return urgency;
  return 'normal';
}

/**
 * Sync extraction results back to the Lead record.
 *
 * Mutations:
 *  - Merges avery_extraction metadata and slot values into Lead.intakeData
 *  - Updates Lead.urgency if we detected non-low urgency
 *  - Updates Lead.displayName if we extracted a name and existing one is generic
 *  - Updates Lead.summary if we have an intake summary
 *  - Touches Lead.lastActivityAt
 */
export async function syncLeadFromExtraction(
  prisma: PrismaClient,
  leadId: string,
  orgId: string,
  extraction: ExtractionResult,
  existingIntakeData: Record<string, unknown>,
  existingDisplayName: string | null | undefined,
): Promise<void> {
  logAveryEvent({ type: 'lead_sync_started', leadId, orgId });

  try {
    // Build slot values to merge into intakeData
    const slotValues: Record<string, unknown> = {};
    for (const [key, slotEntry] of Object.entries(extraction.slots)) {
      if (slotEntry.value !== null && slotEntry.value !== undefined) {
        slotValues[key] = slotEntry.value;
      }
    }

    // Merge extraction metadata into intakeData
    const mergedIntakeData: Record<string, unknown> = {
      ...existingIntakeData,
      avery_extraction: {
        matterType: extraction.matterType,
        callerIntent: extraction.callerIntent,
        emotionalState: extraction.emotionalState,
        urgencyLevel: extraction.urgencyLevel,
        confidenceScore: extraction.confidenceScore,
        riskFlags: extraction.riskFlags,
        transferRecommended: extraction.transferRecommended,
        missingRequiredFields: extraction.missingRequiredFields,
        turnCount: extraction.turnCount,
        extractedAt: new Date().toISOString(),
      },
      // Individual slot values (name, email, incident_date, etc.) merged at top level
      ...slotValues,
    };

    const updateData: Record<string, unknown> = {
      intakeData: mergedIntakeData as unknown as Record<string, unknown>,
      lastActivityAt: new Date(),
    };

    // Update urgency if we have a signal above low
    if (extraction.urgencyLevel !== 'low') {
      updateData.urgency = mapUrgencyToLeadField(extraction.urgencyLevel);
    }

    // Update displayName if existing name is generic and we extracted a real one
    const extractedName = extraction.slots['caller_name']?.value as string | null | undefined;
    if (extractedName && extractedName.trim().length > 0) {
      const currentName = (existingDisplayName ?? '').toLowerCase().trim();
      if (GENERIC_DISPLAY_NAMES.has(currentName)) {
        updateData.displayName = extractedName;
      }
    }

    // Update summary if we built one
    if (extraction.intakeSummary && extraction.intakeSummary.trim().length > 0) {
      updateData.summary = extraction.intakeSummary;
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
    });

    logAveryEvent({
      type: 'lead_sync_completed',
      leadId,
      orgId,
      details: {
        matterType: extraction.matterType,
        urgency: extraction.urgencyLevel,
        updatedDisplayName: !!updateData.displayName,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logAveryEvent({
      type: 'lead_sync_failed',
      leadId,
      orgId,
      error: message,
    });
  }
}
