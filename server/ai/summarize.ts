import { z } from 'zod';

// ── Zod Schemas ─────────────────────────────────────────

const KeyMomentSchema = z.object({
  timestamp: z.string().nullable(),
  text: z.string(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
});

const CaseSummarySchema = z.object({
  snapshot: z.string(),
  keyMoments: z.array(KeyMomentSchema),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  completeness: z.array(
    z.object({
      field: z.string(),
      status: z.enum(['captured', 'missing', 'partial']),
    }),
  ),
});

export type KeyMoment = z.infer<typeof KeyMomentSchema>;
export type CaseSummary = z.infer<typeof CaseSummarySchema>;

// ── PI Required Fields ──────────────────────────────────

const PI_REQUIRED_FIELDS = [
  'callerName',
  'phone',
  'incidentDate',
  'incidentLocation',
  'injuryDescription',
  'atFault',
  'medicalTreatment',
  'insuranceInfo',
];

// ── Rule-Based Fallback ─────────────────────────────────

function extractKeyMomentsFromTranscript(transcript: string): KeyMoment[] {
  const lines = transcript.split('\n').filter((l) => l.trim());
  const moments: KeyMoment[] = [];

  const patterns = [
    { re: /accident|crash|collision|incident/i, sentiment: 'negative' as const },
    { re: /injur|hurt|pain|broken|fractur|hospital|surgery/i, sentiment: 'negative' as const },
    { re: /insurance|policy|coverage|claim/i, sentiment: 'neutral' as const },
    { re: /police|report|officer|filed/i, sentiment: 'neutral' as const },
    { re: /help|assist|represent|consultation/i, sentiment: 'positive' as const },
    { re: /worried|scared|afraid|concern/i, sentiment: 'negative' as const },
  ];

  for (const line of lines) {
    for (const { re, sentiment } of patterns) {
      if (re.test(line) && moments.length < 6) {
        const speaker = line.startsWith('Caller:') ? 'Caller' : line.startsWith('Avery:') ? 'Avery' : null;
        if (speaker === 'Caller' || speaker === null) {
          moments.push({
            timestamp: null,
            text: line.replace(/^(Caller|Avery):\s*/, '').slice(0, 200),
            sentiment,
          });
          break;
        }
      }
    }
  }

  return moments;
}

function detectSentiment(transcript: string): 'positive' | 'neutral' | 'negative' {
  const lower = transcript.toLowerCase();
  const negativeWords = ['worried', 'scared', 'pain', 'hurt', 'angry', 'frustrated', 'upset', 'terrible', 'horrible', 'devastating'];
  const positiveWords = ['thankful', 'grateful', 'relieved', 'hopeful', 'better', 'good', 'great', 'appreciate'];

  let negCount = 0;
  let posCount = 0;
  for (const w of negativeWords) if (lower.includes(w)) negCount++;
  for (const w of positiveWords) if (lower.includes(w)) posCount++;

  if (negCount > posCount + 1) return 'negative';
  if (posCount > negCount + 1) return 'positive';
  return 'neutral';
}

function assessCompleteness(
  intakeData: Record<string, unknown> | null,
): CaseSummary['completeness'] {
  if (!intakeData) {
    return PI_REQUIRED_FIELDS.map((field) => ({ field, status: 'missing' as const }));
  }

  return PI_REQUIRED_FIELDS.map((field) => {
    // Check direct field access
    let value = intakeData[field];

    // Check nested caller object
    if (!value && field === 'callerName') {
      const caller = intakeData.caller as Record<string, unknown> | undefined;
      value = caller?.fullName || caller?.firstName;
    }
    if (!value && field === 'phone') {
      const caller = intakeData.caller as Record<string, unknown> | undefined;
      value = caller?.phone || intakeData.phoneNumber || intakeData.from;
    }
    if (!value && field === 'incidentLocation') {
      value = intakeData.location || intakeData.incidentLocation;
    }
    if (!value && field === 'injuryDescription') {
      value = intakeData.summary || intakeData.injuryDescription;
    }

    if (value && typeof value === 'string' && value.trim()) {
      return { field, status: 'captured' as const };
    }

    // Check keyFacts array for partial info
    const keyFacts = intakeData.keyFacts;
    if (Array.isArray(keyFacts) && keyFacts.length > 0) {
      const fieldHints: Record<string, RegExp> = {
        medicalTreatment: /medical|hospital|doctor|treatment|surgery/i,
        insuranceInfo: /insurance|policy|coverage|claim/i,
        atFault: /fault|liability|responsible|blame|other driver/i,
      };
      if (fieldHints[field] && keyFacts.some((f: string) => fieldHints[field].test(f))) {
        return { field, status: 'partial' as const };
      }
    }

    return { field, status: 'missing' as const };
  });
}

function summarizeWithRules(
  transcript: string,
  intakeData: Record<string, unknown> | null,
): CaseSummary {
  // Build snapshot from first caller lines
  const callerLines = transcript
    .split('\n')
    .filter((l) => l.startsWith('Caller:'))
    .map((l) => l.replace('Caller: ', ''));

  const snapshot =
    callerLines.length > 0
      ? callerLines.slice(0, 2).join(' ').slice(0, 300)
      : 'Inbound call for legal consultation. Details available in transcript.';

  return {
    snapshot,
    keyMoments: extractKeyMomentsFromTranscript(transcript),
    sentiment: detectSentiment(transcript),
    completeness: assessCompleteness(intakeData),
  };
}

// ── OpenAI Summarization ────────────────────────────────

export async function summarizeCall(
  transcript: string,
  intakeData: Record<string, unknown> | null,
): Promise<CaseSummary> {
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    console.log('[SUMMARIZE] OpenAI key not available, using rule-based summarization');
    return summarizeWithRules(transcript, intakeData);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a legal intake summarization assistant. Analyze the call transcript and intake data to produce a structured summary.

Return ONLY valid JSON with this exact structure:
{
  "snapshot": "2-3 sentence case summary describing who called, what happened, and what they need",
  "keyMoments": [
    { "timestamp": null, "text": "key statement from the call", "sentiment": "positive|neutral|negative" }
  ],
  "sentiment": "positive|neutral|negative",
  "completeness": [
    { "field": "callerName", "status": "captured|missing|partial" },
    { "field": "phone", "status": "captured|missing|partial" },
    { "field": "incidentDate", "status": "captured|missing|partial" },
    { "field": "incidentLocation", "status": "captured|missing|partial" },
    { "field": "injuryDescription", "status": "captured|missing|partial" },
    { "field": "atFault", "status": "captured|missing|partial" },
    { "field": "medicalTreatment", "status": "captured|missing|partial" },
    { "field": "insuranceInfo", "status": "captured|missing|partial" }
  ]
}

Guidelines:
- snapshot: Be specific about the incident type, injuries, and what the caller is seeking.
- keyMoments: Extract 3-6 important statements from the caller (not the AI assistant). Focus on facts, injuries, and emotional moments.
- sentiment: Overall emotional tone of the caller during the call.
- completeness: For each PI-required field, indicate whether the information was captured, missing, or partially mentioned.`,
          },
          {
            role: 'user',
            content: `Transcript:\n${transcript}\n\nIntake Data:\n${JSON.stringify(intakeData || {}, null, 2)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = CaseSummarySchema.parse(parsed);
    return validated;
  } catch (err: any) {
    console.error('[SUMMARIZE] OpenAI summarization failed, falling back to rules:', err.message);
    return summarizeWithRules(transcript, intakeData);
  }
}
