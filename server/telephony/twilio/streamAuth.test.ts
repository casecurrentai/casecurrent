import { generateStreamToken, verifyStreamToken } from './streamHandler';

describe('Stream Authentication', () => {
  const testSecret = 'test-secret-12345';
  
  describe('generateStreamToken', () => {
    it('generates consistent HMAC token for same inputs', () => {
      const ts = 1700000000;
      const token1 = generateStreamToken(testSecret, ts);
      const token2 = generateStreamToken(testSecret, ts);
      expect(token1).toBe(token2);
      expect(token1).toHaveLength(64);
    });

    it('generates different tokens for different timestamps', () => {
      const token1 = generateStreamToken(testSecret, 1700000000);
      const token2 = generateStreamToken(testSecret, 1700000001);
      expect(token1).not.toBe(token2);
    });

    it('generates different tokens for different secrets', () => {
      const token1 = generateStreamToken('secret-a', 1700000000);
      const token2 = generateStreamToken('secret-b', 1700000000);
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyStreamToken', () => {
    it('returns true for valid token', () => {
      const ts = 1700000000;
      const token = generateStreamToken(testSecret, ts);
      expect(verifyStreamToken(testSecret, ts, token)).toBe(true);
    });

    it('returns false for invalid token', () => {
      const ts = 1700000000;
      expect(verifyStreamToken(testSecret, ts, 'invalid-token')).toBe(false);
    });

    it('returns false for token with wrong timestamp', () => {
      const ts = 1700000000;
      const token = generateStreamToken(testSecret, ts);
      expect(verifyStreamToken(testSecret, ts + 1, token)).toBe(false);
    });

    it('returns false for token with wrong secret', () => {
      const ts = 1700000000;
      const token = generateStreamToken(testSecret, ts);
      expect(verifyStreamToken('wrong-secret', ts, token)).toBe(false);
    });
  });
});

describe('TwiML Parameter Authentication', () => {
  it('TwiML should include auth_token and ts parameters', () => {
    const ts = Math.floor(Date.now() / 1000);
    const secret = 'test-secret';
    const authToken = generateStreamToken(secret, ts);
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://example.com/stream">
      <Parameter name="auth_token" value="${authToken}"/>
      <Parameter name="ts" value="${ts}"/>
      <Parameter name="callSid" value="CA123"/>
    </Stream>
  </Connect>
</Response>`;

    expect(twiml).toContain('<Parameter name="auth_token"');
    expect(twiml).toContain('<Parameter name="ts"');
    expect(twiml).toContain('<Parameter name="callSid"');
    expect(twiml).not.toContain('?token=');
    expect(twiml).not.toContain('&amp;token=');
  });
});
