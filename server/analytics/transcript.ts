import type { PrismaClient } from '../../apps/api/src/generated/prisma';

export interface TranscriptMessage {
  role: 'ai' | 'user';
  speaker: string;
  text: string;
  timestamp: string | null;
  callId: string;
}

export interface TranscriptResponse {
  messages: TranscriptMessage[];
  totalMessages: number;
  callCount: number;
}

export async function getLeadTranscript(
  prisma: PrismaClient,
  orgId: string,
  leadId: string,
  searchTerm?: string,
): Promise<TranscriptResponse> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, orgId },
    include: {
      calls: {
        orderBy: { startedAt: 'asc' },
      },
    },
  });

  if (!lead) {
    throw new Error('Lead not found');
  }

  const allCalls = lead.calls;
  const messages: TranscriptMessage[] = [];

  for (const call of allCalls) {
    // Prefer structured JSON transcript
    if (call.transcriptJson && Array.isArray(call.transcriptJson)) {
      for (const entry of call.transcriptJson as any[]) {
        const role = entry.role === 'ai' ? 'ai' : 'user';
        messages.push({
          role: role as 'ai' | 'user',
          speaker: role === 'ai' ? 'Avery' : 'Caller',
          text: String(entry.text || ''),
          timestamp: entry.timestamp ? new Date(entry.timestamp).toISOString() : null,
          callId: call.id,
        });
      }
    } else if (call.transcriptText) {
      // Fall back to parsing text transcript
      const lines = call.transcriptText.split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        const isAvery = line.startsWith('Avery:');
        const isCaller = line.startsWith('Caller:');
        if (isAvery || isCaller) {
          messages.push({
            role: isAvery ? 'ai' : 'user',
            speaker: isAvery ? 'Avery' : 'Caller',
            text: line.replace(/^(Avery|Caller):\s*/, ''),
            timestamp: call.startedAt?.toISOString() ?? null,
            callId: call.id,
          });
        }
      }
    }
  }

  // Apply search filter if provided
  let filtered = messages;
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    filtered = messages.filter((m) => m.text.toLowerCase().includes(term));
  }

  return {
    messages: filtered,
    totalMessages: messages.length,
    callCount: allCalls.length,
  };
}
