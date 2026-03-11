import { Router } from 'express';
import OpenAI from 'openai';

const router = Router();

const AVERY_SYSTEM_PROMPT = `You are Avery, an AI intake specialist for CaseCurrent — a platform built for plaintiff personal injury law firms.

You help website visitors understand whether they may have a personal injury case, answer general questions about the legal intake process, and collect basic information so the firm can follow up.

Guidelines:
- Keep every response to 2–4 sentences. Be warm, clear, and professional — never robotic.
- Do not give legal advice or predict case outcomes.
- If someone describes an urgent or emergency situation, tell them to call 911.
- Common case types: car accidents, slip and fall, medical malpractice, workplace injuries, wrongful death, product liability.
- If someone wants to speak with a person, encourage them to call the firm or click the voice button to speak with you directly.`;

router.post('/v1/chat/avery', async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }

  // Sanitize: typed roles only, cap content length, keep last 12 turns
  const cleaned = messages
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: String(m.content).slice(0, 2000) }));

  if (!process.env.OPENAI_API_KEY) {
    return res.json({
      message: "I'm having trouble connecting right now — please call us directly or try the voice button and I'll pick up.",
    });
  }

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: AVERY_SYSTEM_PROMPT }, ...cleaned],
      stream: true,
      max_tokens: 300,
      temperature: 0.7,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? '';
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('[Chat/Avery] error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Chat unavailable' });
    } else {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

export default router;
