import { prisma } from '../db';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_BATCH_SIZE = 100;

interface ExpoPushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded';
  };
}

interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

export async function sendPushToOrg(
  orgId: string,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number; invalidTokens: string[] }> {
  const deviceTokens = await prisma.deviceToken.findMany({
    where: {
      orgId,
      active: true,
    },
    select: {
      id: true,
      token: true,
      platform: true,
    },
  });

  if (deviceTokens.length === 0) {
    console.log(`[Push] No active device tokens for org ${orgId}`);
    return { sent: 0, failed: 0, invalidTokens: [] };
  }

  const messages: ExpoPushMessage[] = deviceTokens.map((dt) => ({
    to: dt.token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: 'default',
    priority: payload.priority || 'high',
    channelId: payload.channelId || 'incoming-calls',
  }));

  const results = await sendPushBatch(messages);
  
  const invalidTokens: string[] = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const ticket = results[i];
    if (ticket.status === 'ok') {
      sent++;
    } else {
      failed++;
      if (ticket.details?.error === 'DeviceNotRegistered') {
        invalidTokens.push(deviceTokens[i].token);
      }
    }
  }

  if (invalidTokens.length > 0) {
    await deactivateInvalidTokens(invalidTokens);
    console.log(`[Push] Deactivated ${invalidTokens.length} invalid tokens`);
  }

  console.log(`[Push] Org ${orgId}: sent=${sent}, failed=${failed}, invalidTokens=${invalidTokens.length}`);
  return { sent, failed, invalidTokens };
}

async function sendPushBatch(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const allTickets: ExpoPushTicket[] = [];

  for (let i = 0; i < messages.length; i += MAX_BATCH_SIZE) {
    const batch = messages.slice(i, i + MAX_BATCH_SIZE);
    
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        console.error(`[Push] Expo API error: ${response.status} ${response.statusText}`);
        allTickets.push(...batch.map(() => ({ status: 'error' as const, message: 'API error' })));
        continue;
      }

      const result = await response.json() as { data: ExpoPushTicket[] };
      allTickets.push(...result.data);
    } catch (error) {
      console.error('[Push] Failed to send batch:', error);
      allTickets.push(...batch.map(() => ({ status: 'error' as const, message: 'Network error' })));
    }
  }

  return allTickets;
}

async function deactivateInvalidTokens(tokens: string[]): Promise<void> {
  await prisma.deviceToken.updateMany({
    where: {
      token: { in: tokens },
    },
    data: {
      active: false,
    },
  });
}

export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number; invalidTokens: string[] }> {
  const deviceTokens = await prisma.deviceToken.findMany({
    where: {
      userId,
      active: true,
    },
    select: {
      id: true,
      token: true,
      platform: true,
    },
  });

  if (deviceTokens.length === 0) {
    console.log(`[Push] No active device tokens for user ${userId}`);
    return { sent: 0, failed: 0, invalidTokens: [] };
  }

  const messages: ExpoPushMessage[] = deviceTokens.map((dt) => ({
    to: dt.token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: 'default',
    priority: payload.priority || 'high',
    channelId: payload.channelId || 'incoming-calls',
  }));

  const results = await sendPushBatch(messages);
  
  const invalidTokens: string[] = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const ticket = results[i];
    if (ticket.status === 'ok') {
      sent++;
    } else {
      failed++;
      if (ticket.details?.error === 'DeviceNotRegistered') {
        invalidTokens.push(deviceTokens[i].token);
      }
    }
  }

  if (invalidTokens.length > 0) {
    await deactivateInvalidTokens(invalidTokens);
    console.log(`[Push] Deactivated ${invalidTokens.length} invalid tokens`);
  }

  console.log(`[Push] User ${userId}: sent=${sent}, failed=${failed}, invalidTokens=${invalidTokens.length}`);
  return { sent, failed, invalidTokens };
}

export async function sendIncomingCallPushToUser(
  userId: string,
  leadId: string,
  callSid: string,
  from: string
): Promise<{ sent: number; failed: number }> {
  const maskedFrom = from.length > 6 
    ? `${from.slice(0, 2)}***${from.slice(-4)}`
    : from;

  const result = await sendPushToUser(userId, {
    title: 'Incoming Call',
    body: `Call from ${maskedFrom}`,
    data: {
      type: 'call.incoming',
      leadId,
      callSid,
    },
    priority: 'high',
    channelId: 'incoming-calls',
  });
  
  return { sent: result.sent, failed: result.failed };
}

export async function sendIncomingCallPush(
  orgId: string,
  leadId: string,
  callSid: string,
  from: string
): Promise<void> {
  const maskedFrom = from.length > 6 
    ? `${from.slice(0, 2)}***${from.slice(-4)}`
    : from;

  await sendPushToOrg(orgId, {
    title: 'Incoming Call',
    body: `Call from ${maskedFrom}`,
    data: {
      type: 'call.incoming',
      leadId,
      callSid,
    },
    priority: 'high',
    channelId: 'incoming-calls',
  });
}
