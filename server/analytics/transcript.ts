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
        const role = entry.role === 'ai' || entry.role === 'assistant' || entry.role === 'bot' ? 'ai' : 'user';
        messages.push({
          role: role as 'ai' | 'user',
          speaker: role === 'ai' ? 'Avery' : 'Caller',
          text: String(entry.text || entry.message || entry.content || ''),
          timestamp: entry.timestamp ? new Date(entry.timestamp).toISOString() : null,
          callId: call.id,
        });
      }
    } else if (call.transcriptText) {
      // Fall back to parsing text transcript
      // Vapi uses "AI:" / "User:" prefixes; also support "Avery:" / "Caller:"
      const lines = call.transcriptText.split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        const isAgent = line.startsWith('AI:') || line.startsWith('Avery:');
        const isUser = line.startsWith('User:') || line.startsWith('Caller:');
        if (isAgent || isUser) {
          messages.push({
            role: isAgent ? 'ai' : 'user',
            speaker: isAgent ? 'Avery' : 'Caller',
            text: line.replace(/^(AI|Avery|User|Caller):\s*/, ''),
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
