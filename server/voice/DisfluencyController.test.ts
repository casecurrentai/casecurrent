import {
  applyDisfluency,
  getConfig,
  DisfluencyConfig,
  generateVoicePromptInstructions,
} from './DisfluencyController';

describe('DisfluencyController', () => {
  const enabledConfig: DisfluencyConfig = {
    enabled: true,
    probability: 1.0,
    maxPerTurn: 1,
    style: 'light',
  };

  const disabledConfig: DisfluencyConfig = {
    enabled: false,
    probability: 0.12,
    maxPerTurn: 1,
    style: 'light',
  };

  describe('applyDisfluency', () => {
    it('should not insert fillers when disabled', () => {
      const result = applyDisfluency('Hello, how can I help you today?', undefined, disabledConfig);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('disabled');
      expect(result.insertedToken).toBeNull();
      expect(result.text).toBe('Hello, how can I help you today?');
    });

    it('should insert filler when enabled and probability is 100%', () => {
      const result = applyDisfluency('Hello, how can I help you today?', undefined, enabledConfig);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBe('inserted');
      expect(result.insertedToken).not.toBeNull();
      expect(result.text).toMatch(/^(Um, |Uh, |So, |Well, )Hello, how can I help you today\?$/);
    });

    it('should NOT insert fillers when text contains phone numbers', () => {
      const texts = [
        'Call us at 555-123-4567 for more information.',
        'Your callback number is (555) 123-4567.',
        'Please call +15551234567 immediately.',
      ];

      for (const text of texts) {
        const result = applyDisfluency(text, undefined, enabledConfig);
        expect(result.eligible).toBe(false);
        expect(result.reason).toContain('blocked_content');
        expect(result.insertedToken).toBeNull();
        expect(result.text).toBe(text);
      }
    });

    it('should NOT insert fillers when text contains dates', () => {
      const texts = [
        'Your appointment is on 12/25/2024.',
        'The hearing is scheduled for January 15th, 2025.',
        'This happened on the 3rd of March.',
      ];

      for (const text of texts) {
        const result = applyDisfluency(text, undefined, enabledConfig);
        expect(result.eligible).toBe(false);
        expect(result.reason).toContain('blocked_content');
        expect(result.insertedToken).toBeNull();
      }
    });

    it('should NOT insert fillers when text contains dollar amounts', () => {
      const texts = [
        'The settlement was $50,000.',
        'That will cost you 500 dollars.',
        'The fee is $99.99 per month.',
      ];

      for (const text of texts) {
        const result = applyDisfluency(text, undefined, enabledConfig);
        expect(result.eligible).toBe(false);
        expect(result.reason).toContain('blocked_content');
        expect(result.insertedToken).toBeNull();
      }
    });

    it('should NOT insert fillers when text contains percentages', () => {
      const texts = ['The rate is 5.5%.', 'We charge 15 percent interest.'];

      for (const text of texts) {
        const result = applyDisfluency(text, undefined, enabledConfig);
        expect(result.eligible).toBe(false);
        expect(result.reason).toContain('blocked_content');
        expect(result.insertedToken).toBeNull();
      }
    });

    it('should NOT insert fillers when text contains addresses', () => {
      const result = applyDisfluency(
        'Our office is at 123 Main Street in downtown.',
        undefined,
        enabledConfig
      );
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('blocked_content');
    });

    it('should NOT insert fillers when text contains email addresses', () => {
      const result = applyDisfluency(
        'Send documents to john.doe@lawfirm.com for review.',
        undefined,
        enabledConfig
      );
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('blocked_content');
    });

    it('should NOT insert fillers when text contains URLs', () => {
      const texts = [
        'Visit https://example.com/intake for more info.',
        'Go to www.lawfirm.com to submit your documents.',
      ];

      for (const text of texts) {
        const result = applyDisfluency(text, undefined, enabledConfig);
        expect(result.eligible).toBe(false);
        expect(result.reason).toContain('blocked_content');
        expect(result.insertedToken).toBeNull();
      }
    });

    it('should NOT insert fillers when text contains legal terms', () => {
      const texts = [
        'By law, you have 30 days to respond.',
        'This is required by legal statute.',
        'Please review the disclaimer before proceeding.',
        'Check the terms of service for details.',
      ];

      for (const text of texts) {
        const result = applyDisfluency(text, undefined, enabledConfig);
        expect(result.eligible).toBe(false);
        expect(result.reason).toContain('blocked_content');
        expect(result.insertedToken).toBeNull();
      }
    });

    it('should NOT insert fillers when text contains action instructions', () => {
      const texts = [
        'Click the submit button to continue.',
        'Go to the settings page.',
        'Type your password here.',
        'Press enter to confirm.',
        'Select your preferred option.',
      ];

      for (const text of texts) {
        const result = applyDisfluency(text, undefined, enabledConfig);
        expect(result.eligible).toBe(false);
        expect(result.reason).toContain('blocked_content');
        expect(result.insertedToken).toBeNull();
      }
    });

    it('should NOT insert fillers when user tone is urgent/upset', () => {
      const urgentMessages = [
        "I'm so upset about this situation!",
        'This is an emergency!',
        'I need help right now!',
        'I need this immediately, please hurry!',
      ];

      for (const userMessage of urgentMessages) {
        const result = applyDisfluency('Let me help you with that.', userMessage, enabledConfig);
        expect(result.eligible).toBe(false);
        expect(result.reason).toBe('urgent_tone');
        expect(result.insertedToken).toBeNull();
      }
    });

    it('should NOT insert fillers when text is too short', () => {
      const result = applyDisfluency('Yes.', undefined, enabledConfig);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('text_too_short');
    });

    it('should respect probability setting', () => {
      const zeroProbConfig: DisfluencyConfig = {
        enabled: true,
        probability: 0,
        maxPerTurn: 1,
        style: 'light',
      };

      const result = applyDisfluency('Hello, how can I help you today?', undefined, zeroProbConfig);
      expect(result.reason).toBe('probability_miss');
      expect(result.insertedToken).toBeNull();
    });

    it('should use casual fillers when style is casual', () => {
      const casualConfig: DisfluencyConfig = {
        enabled: true,
        probability: 1.0,
        maxPerTurn: 1,
        style: 'casual',
      };

      let foundCasualOnly = false;
      for (let i = 0; i < 50; i++) {
        const result = applyDisfluency(
          'Hello, how can I help you today?',
          undefined,
          casualConfig
        );
        if (result.insertedToken === 'Like,' || result.insertedToken === 'Yeah—so,') {
          foundCasualOnly = true;
          break;
        }
      }
      expect(foundCasualOnly).toBe(true);
    });
  });

  describe('getConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should return default config when env vars not set', () => {
      delete process.env.DISFLUENCY_ENABLED;
      delete process.env.DISFLUENCY_PROB;
      delete process.env.DISFLUENCY_MAX_PER_TURN;
      delete process.env.DISFLUENCY_STYLE;

      const config = getConfig();
      expect(config.enabled).toBe(true);
      expect(config.probability).toBe(0.12);
      expect(config.maxPerTurn).toBe(1);
      expect(config.style).toBe('light');
    });

    it('should respect DISFLUENCY_ENABLED=false', () => {
      process.env.DISFLUENCY_ENABLED = 'false';
      const config = getConfig();
      expect(config.enabled).toBe(false);
    });

    it('should parse custom probability', () => {
      process.env.DISFLUENCY_PROB = '0.25';
      const config = getConfig();
      expect(config.probability).toBe(0.25);
    });

    it('should clamp probability to 0-1 range', () => {
      process.env.DISFLUENCY_PROB = '1.5';
      expect(getConfig().probability).toBe(1);

      process.env.DISFLUENCY_PROB = '-0.5';
      expect(getConfig().probability).toBe(0);
    });

    it('should disable when style is none', () => {
      process.env.DISFLUENCY_STYLE = 'none';
      const config = getConfig();
      expect(config.enabled).toBe(false);
    });
  });

  describe('generateVoicePromptInstructions', () => {
    it('should return empty string when disabled', () => {
      process.env.DISFLUENCY_ENABLED = 'false';
      const instructions = generateVoicePromptInstructions();
      expect(instructions).toBe('');
    });

    it('should include probability percentage when enabled', () => {
      process.env.DISFLUENCY_ENABLED = 'true';
      process.env.DISFLUENCY_PROB = '0.15';
      process.env.DISFLUENCY_STYLE = 'light';
      const instructions = generateVoicePromptInstructions();
      expect(instructions).toContain('15%');
      expect(instructions).toContain('um, uh, so, well');
    });
  });

  describe('statistical distribution test', () => {
    it('should insert fillers at approximately the configured rate', () => {
      const testConfig: DisfluencyConfig = {
        enabled: true,
        probability: 0.12,
        maxPerTurn: 1,
        style: 'light',
      };

      const iterations = 200;
      let insertedCount = 0;
      let violationCount = 0;

      for (let i = 0; i < iterations; i++) {
        const result = applyDisfluency(
          'This is a normal conversational response that should sometimes get a filler.',
          undefined,
          testConfig
        );

        if (result.insertedToken) {
          insertedCount++;
        }

        if (!result.eligible && result.reason === 'inserted') {
          violationCount++;
        }
      }

      const insertionRate = insertedCount / iterations;
      console.log(`Insertion rate: ${(insertionRate * 100).toFixed(1)}% (${insertedCount}/${iterations})`);
      console.log(`Violations: ${violationCount}`);

      expect(insertionRate).toBeGreaterThan(0.05);
      expect(insertionRate).toBeLessThan(0.25);
      expect(violationCount).toBe(0);
    });

    it('should never insert fillers in blocked contexts across many iterations', () => {
      const blockedTexts = [
        'Call us at 555-123-4567.',
        'The amount is $1,500.',
        'Your appointment is on 12/25/2024.',
        'Visit https://lawfirm.com for details.',
        'Send to contact@lawfirm.com.',
        'Click the button to proceed.',
        'By law, you must respond within 30 days.',
      ];

      const testConfig: DisfluencyConfig = {
        enabled: true,
        probability: 1.0,
        maxPerTurn: 1,
        style: 'light',
      };

      let violationCount = 0;

      for (let i = 0; i < 50; i++) {
        for (const text of blockedTexts) {
          const result = applyDisfluency(text, undefined, testConfig);
          if (result.insertedToken) {
            console.error(`VIOLATION: Filler inserted in blocked text: "${text}"`);
            violationCount++;
          }
        }
      }

      expect(violationCount).toBe(0);
    });
  });
});
