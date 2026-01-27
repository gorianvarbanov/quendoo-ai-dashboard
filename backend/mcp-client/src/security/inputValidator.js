/**
 * Input Validator - Aggressive Security
 * Fast validation with < 10ms total latency
 * Blocks prompt injection and off-topic requests
 */

export class InputValidator {
  constructor() {
    // Prompt injection patterns (regex-based, < 1ms each)
    this.injectionPatterns = [
      // Direct instruction override attempts
      /ignore\s+(previous|above|all|prior)\s+(instructions?|rules?|prompts?)/i,
      /forget\s+(everything|all|previous|your)/i,
      /disregard\s+(previous|above|all|prior)/i,
      /you\s+(are\s+now|must\s+now|should\s+now)\s+(a|an)/i,

      // Role manipulation attempts
      /act\s+as\s+(?!.*hotel|.*reservation|.*receptionist)/i,
      /pretend\s+(to\s+be|you\s+are)/i,
      /simulate\s+(being|a)/i,
      /roleplay\s+as/i,

      // System/instruction keywords
      /system\s*:\s*/i,
      /new\s+(instructions?|rules?|role|behavior)/i,
      /override\s+(instructions?|settings?|rules?)/i,
      /change\s+your\s+(role|behavior|instructions?)/i,

      // Code block injection attempts
      /```\s*system/i,
      /```\s*instructions?/i,
      /<\s*system\s*>/i,

      // Meta-discussion attempts
      /what\s+(are|is)\s+your\s+(instructions?|rules?|limitations?)/i,
      /show\s+me\s+your\s+(prompt|instructions?|system)/i,
      /reveal\s+your/i,
      /bypass\s+(restrictions?|rules?|filters?)/i
    ];

    // Off-topic keywords (aggressive blocking)
    this.offTopicPatterns = {
      medical: /\b(medicine|medication|treatment|diagnosis|symptoms?|disease|illness|doctor|hospital|cure|healing|therapy|prescription)\b/i,
      cooking: /\b(recipe|cook|bake|ingredient|dish|meal|kitchen|culinary)\b/i,
      programming: /\b(code|coding|program|programming|script|function|algorithm|debug|compile)\b/i,
      gardening: /\b(plant|flower|garden|seed|soil|grow|botanical|horticulture)\b/i,
      general_advice: /\b(how\s+to\s+(lose\s+weight|get\s+fit|be\s+happy|make\s+friends))\b/i
    };

    // Hotel-related keywords (whitelist)
    this.hotelKeywords = [
      'room', 'booking', 'reservation', 'check-in', 'checkout', 'check-out',
      'hotel', 'guest', 'availability', 'quendoo', 'property', 'accommodation',
      'suite', 'bed', 'amenity', 'amenities', 'concierge', 'reception',
      'price', 'rate', 'package', 'deal', 'stay', 'night', 'lodging'
    ];

    // Statistics
    this.stats = {
      totalValidations: 0,
      blocked: 0,
      allowed: 0
    };
  }

  /**
   * Validate user input (main entry point)
   * @param {string} message - User message
   * @returns {object} Validation result { blocked: boolean, reason?: string, pattern?: string }
   */
  validate(message) {
    this.stats.totalValidations++;

    // Allow empty strings (for document-only messages) but reject non-strings
    if (typeof message !== 'string') {
      this.stats.blocked++;
      return {
        blocked: true,
        reason: 'Invalid input format'
      };
    }

    // If message is empty, skip validation (allow document-only messages)
    if (!message || message.trim().length === 0) {
      return {
        blocked: false,
        reason: null,
        sanitized: message
      };
    }

    // 1. Format validation (< 1ms)
    const formatCheck = this.validateFormat(message);
    if (formatCheck.blocked) {
      this.stats.blocked++;
      return formatCheck;
    }

    // 2. Prompt injection detection (< 5ms)
    const injectionCheck = this.detectInjectionPatterns(message);
    if (injectionCheck.blocked) {
      this.stats.blocked++;
      console.log(`[Security] Blocked prompt injection: ${injectionCheck.pattern}`);
      return injectionCheck;
    }

    // 3. Topic boundary enforcement (< 5ms)
    const topicCheck = this.detectOffTopicRequest(message);
    if (topicCheck.blocked) {
      this.stats.blocked++;
      console.log(`[Security] Blocked off-topic request: ${topicCheck.reason}`);
      return topicCheck;
    }

    this.stats.allowed++;
    return { blocked: false };
  }

  /**
   * Validate message format
   * @param {string} message
   * @returns {object} Validation result
   */
  validateFormat(message) {
    // Maximum length: 2000 characters
    if (message.length > 2000) {
      return {
        blocked: true,
        reason: 'Message too long'
      };
    }

    // Check for null bytes or control characters
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(message)) {
      return {
        blocked: true,
        reason: 'Invalid characters detected'
      };
    }

    return { blocked: false };
  }

  /**
   * Detect prompt injection patterns
   * @param {string} message
   * @returns {object} Detection result
   */
  detectInjectionPatterns(message) {
    for (const pattern of this.injectionPatterns) {
      if (pattern.test(message)) {
        return {
          blocked: true,
          reason: 'Potential prompt injection detected',
          pattern: pattern.toString()
        };
      }
    }

    return { blocked: false };
  }

  /**
   * Detect off-topic requests (aggressive)
   * @param {string} message
   * @returns {object} Detection result
   */
  detectOffTopicRequest(message) {
    const lowerMessage = message.toLowerCase();

    // Check for hotel context
    const hasHotelContext = this.hotelKeywords.some(keyword =>
      lowerMessage.includes(keyword)
    );

    // Check for off-topic keywords
    for (const [category, pattern] of Object.entries(this.offTopicPatterns)) {
      if (pattern.test(message)) {
        // If off-topic keyword found WITHOUT hotel context, block
        if (!hasHotelContext) {
          return {
            blocked: true,
            reason: `Off-topic request detected (${category})`,
            category
          };
        }
      }
    }

    return { blocked: false };
  }

  /**
   * Get validation statistics
   * @returns {object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      blockRate: this.stats.totalValidations > 0
        ? (this.stats.blocked / this.stats.totalValidations * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalValidations: 0,
      blocked: 0,
      allowed: 0
    };
  }
}

export default InputValidator;
