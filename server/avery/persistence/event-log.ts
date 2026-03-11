/**
 * Structured lifecycle event logging for Avery pipeline observability.
 *
 * All events are written as structured JSON to stdout, compatible with
 * the existing log aggregation pattern used throughout CaseCurrent.
 *
 * Usage:
 *   logAveryEvent({ type: 'extraction_completed', callId, leadId, orgId, details: { matterType } });
 *
 * Never throws.
 */

export type AveryEventType =
  | 'call_started'
  | 'postcall_received'
  | 'payload_normalized'
  | 'extraction_started'
  | 'extraction_completed'
  | 'lead_sync_started'
  | 'lead_sync_completed'
  | 'lead_sync_failed'
  | 'state_initialized'
  | 'persistence_started'
  | 'persistence_completed'
  | 'postcall_analysis_completed'
  | 'webhook_failed';

export interface AveryEvent {
  type: AveryEventType;
  conversationId?: string | null;
  callId?: string | null;
  leadId?: string | null;
  orgId?: string | null;
  durationMs?: number;
  details?: Record<string, unknown>;
  error?: string;
}

/**
 * Log a structured Avery lifecycle event.
 * All events include a '[AVERY]' tag for easy log filtering.
 */
export function logAveryEvent(event: AveryEvent): void {
  try {
    console.log(
      JSON.stringify({
        tag: '[AVERY]',
        ...event,
        ts: new Date().toISOString(),
      }),
    );
  } catch {
    // Swallow: logging must never throw in the hot path
  }
}
