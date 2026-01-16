import { z } from 'zod';

const IntakeExtractionSchema = z.object({
  caller: z.object({
    fullName: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
  }),
  practiceArea: z.enum([
    'Personal Injury',
    'Family Law',
    'Criminal Defense',
    'Immigration',
    'Employment',
    'Civil Litigation',
    'Bankruptcy',
    'Estate Planning',
    'Real Estate',
    'Business',
    'Other',
  ]),
  incidentDate: z.string().nullable(),
  location: z.string().nullable(),
  summary: z.string(),
  keyFacts: z.array(z.string()),
  urgency: z.enum(['low', 'medium', 'high']),
  conflicts: z.object({
    opposingParty: z.string().nullable(),
  }),
  score: z.object({
    value: z.number().min(0).max(100),
    label: z.enum(['low', 'medium', 'high']),
    reasons: z.array(z.string()),
  }),
});

export type IntakeExtraction = z.infer<typeof IntakeExtractionSchema>;

const PRACTICE_AREA_KEYWORDS: Record<string, string[]> = {
  'Personal Injury': ['accident', 'injury', 'hurt', 'crash', 'slip', 'fall', 'medical', 'hospital', 'surgery', 'pain', 'whiplash', 'broken', 'fracture'],
  'Family Law': ['divorce', 'custody', 'child', 'spouse', 'marriage', 'alimony', 'separation', 'visitation', 'support'],
  'Criminal Defense': ['arrested', 'charged', 'crime', 'criminal', 'police', 'jail', 'court', 'dui', 'dwi', 'drugs', 'assault', 'theft'],
  'Immigration': ['visa', 'immigration', 'green card', 'citizenship', 'deportation', 'asylum', 'work permit', 'undocumented'],
  'Employment': ['fired', 'terminated', 'discrimination', 'harassment', 'wrongful', 'overtime', 'wages', 'employer', 'workplace'],
  'Civil Litigation': ['sued', 'lawsuit', 'contract', 'breach', 'dispute', 'damages', 'claim'],
  'Bankruptcy': ['debt', 'bankrupt', 'creditor', 'foreclosure', 'collection', 'owe', 'bills'],
  'Estate Planning': ['will', 'trust', 'estate', 'inheritance', 'probate', 'power of attorney'],
  'Real Estate': ['property', 'house', 'landlord', 'tenant', 'lease', 'eviction', 'mortgage'],
  'Business': ['business', 'company', 'corporation', 'llc', 'partnership', 'startup'],
};

function detectPracticeArea(transcript: string): string {
  const lower = transcript.toLowerCase();
  let maxScore = 0;
  let detectedArea = 'Other';
  
  for (const [area, keywords] of Object.entries(PRACTICE_AREA_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score++;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      detectedArea = area;
    }
  }
  
  return detectedArea;
}

function calculateScore(extraction: Partial<IntakeExtraction>, transcript: string): { value: number; label: 'low' | 'medium' | 'high'; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const lower = transcript.toLowerCase();
  
  if (extraction.practiceArea && extraction.practiceArea !== 'Other') {
    score += 30;
    reasons.push(`Practice area identified: ${extraction.practiceArea}`);
  }
  
  if (lower.includes('injury') || lower.includes('hurt') || lower.includes('hospital') || lower.includes('surgery') || lower.includes('doctor') || lower.includes('treatment')) {
    score += 20;
    reasons.push('Medical treatment/injury mentioned');
  }
  
  if (lower.includes('witness') || lower.includes('fault') || lower.includes('liability') || lower.includes('their fault') || lower.includes('other driver')) {
    score += 20;
    reasons.push('Clear liability indicators or witnesses mentioned');
  }
  
  if (lower.includes('deadline') || lower.includes('urgent') || lower.includes('court date') || lower.includes('statute') || lower.includes('time limit') || lower.includes('expires')) {
    score += 15;
    reasons.push('Time-sensitive or urgent matter');
  }
  
  if (extraction.caller?.fullName && extraction.caller.fullName !== 'Unknown') {
    score += 5;
    reasons.push('Caller provided full name');
  }
  
  if (extraction.caller?.phone || extraction.caller?.email) {
    score += 5;
    reasons.push('Contact information provided');
  }
  
  if (extraction.incidentDate) {
    score += 5;
    reasons.push('Incident date provided');
  }
  
  if (lower.includes('don\'t know') || lower.includes('not sure') || lower.includes('can\'t remember')) {
    score -= 10;
    reasons.push('Caller uncertain about key details');
  }
  
  score = Math.max(0, Math.min(100, score));
  
  const label: 'low' | 'medium' | 'high' = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  
  return { value: score, label, reasons };
}

function extractNameFromTranscript(transcript: string): { fullName: string | null; firstName: string | null; lastName: string | null } {
  const patterns = [
    /(?:my name is|this is|i'm|i am|name's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:first name is|first name)\s+([A-Z][a-z]+)/i,
    /(?:last name is|last name)\s+([A-Z][a-z]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      const parts = name.split(/\s+/);
      return {
        fullName: name,
        firstName: parts[0] || null,
        lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
      };
    }
  }
  
  return { fullName: null, firstName: null, lastName: null };
}

function extractEmailFromTranscript(transcript: string): string | null {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = transcript.match(emailPattern);
  return match ? match[0] : null;
}

function extractDateFromTranscript(transcript: string): string | null {
  const datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{0,4}/i,
    /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
    /(last week|last month|yesterday|two days ago|a week ago|few days ago)/i,
  ];
  
  for (const pattern of datePatterns) {
    const match = transcript.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

function extractLocationFromTranscript(transcript: string): string | null {
  const locationPatterns = [
    /(?:in|at|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:,\s*[A-Z]{2})?)/,
    /([A-Z][a-z]+),?\s*([A-Z]{2})\b/,
  ];
  
  for (const pattern of locationPatterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      return match[0].replace(/^(in|at|near|around)\s+/i, '').trim();
    }
  }
  
  return null;
}

function generateSummary(transcript: string, practiceArea: string): string {
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  const relevantSentences = sentences
    .filter(s => {
      const lower = s.toLowerCase();
      return lower.includes('happened') || 
             lower.includes('incident') || 
             lower.includes('injury') || 
             lower.includes('need help') ||
             lower.includes('looking for') ||
             lower.includes('lawyer') ||
             lower.includes('attorney');
    })
    .slice(0, 2);
  
  if (relevantSentences.length > 0) {
    return relevantSentences.map(s => s.trim()).join('. ') + '.';
  }
  
  const firstFewSentences = sentences.slice(0, 2);
  if (firstFewSentences.length > 0) {
    return firstFewSentences.map(s => s.trim()).join('. ') + '.';
  }
  
  return `Inbound call regarding ${practiceArea} matter.`;
}

function extractKeyFacts(transcript: string): string[] {
  const facts: string[] = [];
  const lower = transcript.toLowerCase();
  
  if (lower.includes('hospital') || lower.includes('surgery') || lower.includes('doctor')) {
    facts.push('Caller received or is seeking medical treatment');
  }
  
  if (lower.includes('police') || lower.includes('report') || lower.includes('officer')) {
    facts.push('Police involvement or report filed');
  }
  
  if (lower.includes('insurance') || lower.includes('claim')) {
    facts.push('Insurance involved or claim filed');
  }
  
  if (lower.includes('witness') || lower.includes('saw it')) {
    facts.push('Witnesses present');
  }
  
  if (lower.includes('photo') || lower.includes('picture') || lower.includes('video') || lower.includes('evidence')) {
    facts.push('Documentation/evidence available');
  }
  
  if (lower.includes('work') && (lower.includes('miss') || lower.includes('can\'t') || lower.includes('cannot'))) {
    facts.push('Unable to work due to incident');
  }
  
  return facts.slice(0, 5);
}

function detectUrgency(transcript: string): 'low' | 'medium' | 'high' {
  const lower = transcript.toLowerCase();
  
  if (lower.includes('urgent') || lower.includes('emergency') || lower.includes('immediately') || 
      lower.includes('court date') || lower.includes('deadline') || lower.includes('tomorrow') ||
      lower.includes('today') || lower.includes('asap') || lower.includes('statute')) {
    return 'high';
  }
  
  if (lower.includes('soon') || lower.includes('next week') || lower.includes('this week') ||
      lower.includes('hospital') || lower.includes('surgery')) {
    return 'medium';
  }
  
  return 'low';
}

export async function extractIntakeFromTranscript(
  transcript: string,
  fromNumber: string | null,
  _toNumber: string | null,
  _callSid: string | null,
  _orgId: string
): Promise<IntakeExtraction> {
  const nameInfo = extractNameFromTranscript(transcript);
  const practiceArea = detectPracticeArea(transcript);
  const email = extractEmailFromTranscript(transcript);
  const incidentDate = extractDateFromTranscript(transcript);
  const location = extractLocationFromTranscript(transcript);
  const summary = generateSummary(transcript, practiceArea);
  const keyFacts = extractKeyFacts(transcript);
  const urgency = detectUrgency(transcript);
  
  const partialExtraction = {
    caller: {
      fullName: nameInfo.fullName,
      firstName: nameInfo.firstName,
      lastName: nameInfo.lastName,
      email,
      phone: fromNumber,
    },
    practiceArea: practiceArea as IntakeExtraction['practiceArea'],
    incidentDate,
    location,
    summary,
    keyFacts,
    urgency,
    conflicts: {
      opposingParty: null,
    },
  };
  
  const scoreResult = calculateScore(partialExtraction, transcript);
  
  const extraction: IntakeExtraction = {
    ...partialExtraction,
    score: scoreResult,
  };
  
  return extraction;
}

export async function extractIntakeWithOpenAI(
  transcript: string,
  fromNumber: string | null,
  _toNumber: string | null,
  _callSid: string | null,
  _orgId: string
): Promise<IntakeExtraction> {
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiKey) {
    console.log('[INTAKE] OpenAI key not available, using rule-based extraction');
    return extractIntakeFromTranscript(transcript, fromNumber, _toNumber, _callSid, _orgId);
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a legal intake assistant. Extract structured information from a phone call transcript.
Return ONLY valid JSON with this exact structure:
{
  "caller": { "fullName": "string or null", "firstName": "string or null", "lastName": "string or null", "email": "string or null", "phone": "string or null" },
  "practiceArea": "Personal Injury|Family Law|Criminal Defense|Immigration|Employment|Civil Litigation|Bankruptcy|Estate Planning|Real Estate|Business|Other",
  "incidentDate": "YYYY-MM-DD or descriptive string or null",
  "location": "city, state or null",
  "summary": "1-3 sentence summary of the matter",
  "keyFacts": ["fact1", "fact2"],
  "urgency": "low|medium|high",
  "conflicts": { "opposingParty": "name or null" }
}`,
          },
          {
            role: 'user',
            content: `Extract intake information from this call transcript:\n\n${transcript}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
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
    
    parsed.caller.phone = parsed.caller.phone || fromNumber;
    
    const scoreResult = calculateScore(parsed, transcript);
    
    const extraction: IntakeExtraction = {
      caller: {
        fullName: parsed.caller?.fullName || null,
        firstName: parsed.caller?.firstName || null,
        lastName: parsed.caller?.lastName || null,
        email: parsed.caller?.email || null,
        phone: parsed.caller?.phone || fromNumber,
      },
      practiceArea: parsed.practiceArea || 'Other',
      incidentDate: parsed.incidentDate || null,
      location: parsed.location || null,
      summary: parsed.summary || 'Inbound call for legal consultation.',
      keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : [],
      urgency: ['low', 'medium', 'high'].includes(parsed.urgency) ? parsed.urgency : 'low',
      conflicts: {
        opposingParty: parsed.conflicts?.opposingParty || null,
      },
      score: scoreResult,
    };
    
    return extraction;
  } catch (err: any) {
    console.error('[INTAKE] OpenAI extraction failed, falling back to rules:', err.message);
    return extractIntakeFromTranscript(transcript, fromNumber, _toNumber, _callSid, _orgId);
  }
}
