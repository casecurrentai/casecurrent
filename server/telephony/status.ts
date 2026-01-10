export type CanonicalCallStatus = 
  | 'queued' 
  | 'ringing' 
  | 'in-progress' 
  | 'completed' 
  | 'failed' 
  | 'busy' 
  | 'no-answer'
  | 'canceled';

export type TelephonyProvider = 'twilio' | 'plivo';

export function getActiveProvider(): TelephonyProvider {
  const configuredProvider = (process.env.TELEPHONY_PROVIDER || 'twilio').toLowerCase();
  return configuredProvider === 'plivo' ? 'plivo' : 'twilio';
}

export function isVoiceEnabled(): boolean {
  const provider = getActiveProvider();
  
  if (provider === 'plivo') {
    return !!(process.env.PLIVO_AUTH_ID && process.env.PLIVO_AUTH_TOKEN);
  }
  
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

export function isSmsEnabled(): boolean {
  const provider = getActiveProvider();
  
  if (provider === 'plivo') {
    return !!(process.env.PLIVO_AUTH_ID && process.env.PLIVO_AUTH_TOKEN);
  }
  
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

export function getTelephonyStatus(): {
  provider: TelephonyProvider;
  voiceEnabled: boolean;
  smsEnabled: boolean;
} {
  return {
    provider: getActiveProvider(),
    voiceEnabled: isVoiceEnabled(),
    smsEnabled: isSmsEnabled(),
  };
}

export function mapDbStatusToCanonical(status: string | null | undefined): CanonicalCallStatus {
  if (!status) return 'queued';
  
  const normalized = status.toLowerCase().replace(/_/g, '-');
  
  const statusMap: Record<string, CanonicalCallStatus> = {
    'queued': 'queued',
    'initiated': 'queued',
    'pending': 'queued',
    'ringing': 'ringing',
    'in-progress': 'in-progress',
    'active': 'in-progress',
    'answered': 'in-progress',
    'completed': 'completed',
    'ended': 'completed',
    'failed': 'failed',
    'error': 'failed',
    'busy': 'busy',
    'no-answer': 'no-answer',
    'timeout': 'no-answer',
    'canceled': 'canceled',
    'cancelled': 'canceled',
  };
  
  return statusMap[normalized] || 'completed';
}

export function mapTwilioWebhookToDbStatus(callStatus: string): string {
  const statusMap: Record<string, string> = {
    'queued': 'queued',
    'initiated': 'queued',
    'ringing': 'ringing',
    'in-progress': 'in-progress',
    'completed': 'completed',
    'busy': 'busy',
    'failed': 'failed',
    'no-answer': 'no-answer',
    'canceled': 'canceled',
  };
  
  return statusMap[callStatus.toLowerCase()] || callStatus;
}

export function mapPlivoWebhookToDbStatus(callStatus: string): string {
  const statusMap: Record<string, string> = {
    'ring': 'ringing',
    'ringing': 'ringing',
    'early_media': 'ringing',
    'answer': 'in-progress',
    'answered': 'in-progress',
    'hangup': 'completed',
    'completed': 'completed',
    'busy': 'busy',
    'cancel': 'canceled',
    'timeout': 'no-answer',
    'failed': 'failed',
  };
  
  return statusMap[callStatus.toLowerCase()] || callStatus;
}

export function calculateDurationSeconds(
  startedAt: Date | null | undefined, 
  endedAt: Date | null | undefined,
  durationSeconds: number | null | undefined
): number {
  if (typeof durationSeconds === 'number' && durationSeconds >= 0) {
    return durationSeconds;
  }
  
  if (startedAt && endedAt) {
    const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    return Math.max(0, Math.floor(durationMs / 1000));
  }
  
  return 0;
}

const VALID_OUTCOMES = ['connected', 'voicemail', 'no-answer', 'busy', 'failed', 'completed'];

export function normalizeOutcome(outcome: string): string {
  const normalized = outcome.toLowerCase().replace(/_/g, '-');
  return VALID_OUTCOMES.includes(normalized) ? normalized : 'completed';
}

const TERMINAL_STATUSES = ['completed', 'failed', 'busy', 'no-answer'];

export function isTerminalStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase().replace(/_/g, '-');
  return TERMINAL_STATUSES.includes(normalized);
}

const ACTIVE_STATUSES = ['queued', 'ringing', 'in-progress', 'active', 'initiated', 'pending'];

export function isActiveStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase().replace(/_/g, '-');
  return ACTIVE_STATUSES.includes(normalized);
}

export function outcomeRequiresFollowup(outcome: string): boolean {
  const normalized = outcome.toLowerCase().replace(/_/g, '-');
  return normalized === 'voicemail' || normalized === 'no-answer';
}
