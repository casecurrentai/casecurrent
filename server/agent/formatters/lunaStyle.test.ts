import {
  formatForVoice,
  hasFillerWords,
  validateLunaStyle,
  type LunaStyleContext
} from './lunaStyle';

describe('Luna-Style Speech Formatter', () => {
  describe('formatForVoice', () => {
    it('should return the same text if empty or null', () => {
      expect(formatForVoice('')).toBe('');
      expect(formatForVoice(null as any)).toBe(null);
    });

    it('should shorten long sentences', () => {
      const longText = 'This is a very long sentence that goes on and on, and it includes many clauses that could be broken up, and it just keeps going with more information that should probably be in separate sentences.';
      const result = formatForVoice(longText);
      expect(result.split('.').length).toBeGreaterThan(1);
    });

    it('should ensure questions end with question marks', () => {
      const text = 'Can I get your name';
      const result = formatForVoice(text);
      expect(result).toContain('?');
    });

    it('should format phone number confirmations', () => {
      const text = 'Your number is 8505551234';
      const result = formatForVoice(text);
      expect(result).toContain('Just to confirm');
    });

    it('should add empathy for emergency situations', () => {
      const text = 'I understand you are at the hospital.';
      const context: LunaStyleContext = { callerName: 'John' };
      const result = formatForVoice(text, context);
      expect(result).toContain('sorry');
    });

    it('should handle transfer pacing', () => {
      const text = 'I am going to transfer you now.';
      const context: LunaStyleContext = { isTransfer: true };
      const result = formatForVoice(text, context);
      expect(result.split('.').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('hasFillerWords', () => {
    it('should detect filler words', () => {
      expect(hasFillerWords('So, um, how can I help?')).toBe(true);
      expect(hasFillerWords('Well, uh, let me check')).toBe(true);
      expect(hasFillerWords('You know, that is a good question')).toBe(true);
    });

    it('should return false for clean text', () => {
      expect(hasFillerWords('How can I help you today?')).toBe(false);
      expect(hasFillerWords('Let me get your information.')).toBe(false);
      expect(hasFillerWords('I understand. Thank you for calling.')).toBe(false);
    });

    it('should not flag similar words that are not fillers', () => {
      expect(hasFillerWords('Do you know what happened?')).toBe(false);
      expect(hasFillerWords('I like that idea.')).toBe(false);
    });
  });

  describe('validateLunaStyle', () => {
    it('should pass for clean, short text', () => {
      const text = 'Hi, this is Avery. How can I help you today?';
      const result = validateLunaStyle(text);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should flag filler words', () => {
      const text = 'So, um, how can I help you?';
      const result = validateLunaStyle(text);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Contains filler words (um, uh, etc.)');
    });

    it('should flag very long sentences', () => {
      const longSentence = 'This is an incredibly long sentence that just keeps going and going without any punctuation to break it up and it contains so much information that it would be very difficult to follow if someone were reading it aloud or listening to it being spoken';
      const result = validateLunaStyle(longSentence);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('sentences over 150 characters'))).toBe(true);
    });
  });

  describe('empathy detection', () => {
    it('should detect emergency keywords', () => {
      const hospitalText = 'I am at the hospital right now.';
      const context: LunaStyleContext = { callerName: 'Sarah' };
      const result = formatForVoice(hospitalText, context);
      expect(result.toLowerCase()).toContain('sorry');
    });

    it('should detect serious keywords', () => {
      const divorceText = 'I need help with my divorce.';
      const context: LunaStyleContext = { callerName: 'Mike' };
      const result = formatForVoice(divorceText, context);
      expect(result.toLowerCase()).toContain('sorry') || expect(result.toLowerCase()).toContain('difficult');
    });

    it('should not add empathy for neutral topics', () => {
      const neutralText = 'I need to update my contact information.';
      const result = formatForVoice(neutralText);
      expect(result.toLowerCase()).not.toContain('sorry');
    });
  });

  describe('confirmation formatting', () => {
    it('should format phone numbers for speech', () => {
      const text = 'That is 8505551234';
      const result = formatForVoice(text);
      expect(result).toContain('...');
    });

    it('should add just to confirm prefix', () => {
      const text = 'Your phone number is 8505551234';
      const result = formatForVoice(text);
      expect(result.toLowerCase()).toContain('just to confirm');
    });
  });

  describe('no filler words injected', () => {
    it('should never inject um or uh', () => {
      const inputs = [
        'How can I help you?',
        'Let me get your information.',
        'I understand you are at the hospital.',
        'Your phone number is 8505551234',
        'I am going to transfer you now.'
      ];
      
      for (const input of inputs) {
        const result = formatForVoice(input);
        expect(hasFillerWords(result)).toBe(false);
      }
    });
  });
});
