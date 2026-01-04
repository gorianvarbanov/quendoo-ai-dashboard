/**
 * Output Filter - Response Validation & Content Filtering
 * Fast filtering with < 15ms total latency
 * Validates Claude responses and redacts sensitive data
 */

export class OutputFilter {
  constructor() {
    // Off-topic indicators (keywords that suggest response is off-topic)
    this.offTopicIndicators = {
      medical: [
        'medication', 'medicine', 'prescription', 'treatment', 'diagnosis',
        'symptoms', 'disease', 'illness', 'doctor', 'hospital', 'cure',
        'therapy', 'pill', 'drug', 'antibiotic', 'aspirin', 'ibuprofen'
      ],
      cooking: [
        'recipe', 'ingredient', 'cook', 'bake', 'oven', 'stir', 'mix',
        'tablespoon', 'teaspoon', 'flour', 'sugar', 'butter', 'egg',
        'minutes at', 'degrees', 'preheat', 'simmer', 'boil'
      ],
      programming: [
        'function', 'variable', 'class', 'import', 'def ', 'return',
        'const ', 'let ', 'var ', 'if (', 'for (', 'while (',
        'console.log', 'print(', 'algorithm', 'code', 'syntax'
      ],
      gardening: [
        'plant', 'seed', 'soil', 'fertilizer', 'watering', 'prune',
        'flower', 'botanical', 'garden', 'grow', 'root', 'leaf'
      ]
    };

    // Sensitive data patterns (for redaction)
    this.sensitivePatterns = [
      // API keys
      { pattern: /sk-[a-zA-Z0-9-_]{20,}/g, replacement: '[REDACTED_API_KEY]' },
      { pattern: /api[_-]?key[:\s=]+[a-zA-Z0-9-_]{20,}/gi, replacement: '[REDACTED_API_KEY]' },

      // Emails (commented out - may be needed for guest communication)
      // { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[REDACTED_EMAIL]' },

      // Phone numbers - REMOVED - needed for make_call tool and hotel operations

      // Credit card numbers (basic pattern)
      { pattern: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, replacement: '[REDACTED_CARD]' },

      // Passwords in text
      { pattern: /password[:\s=]+\S+/gi, replacement: 'password: [REDACTED]' },

      // JWT tokens
      { pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, replacement: '[REDACTED_TOKEN]' }
    ];

    // Hotel-related keywords (whitelist for topic validation)
    this.hotelKeywords = [
      'room', 'booking', 'reservation', 'check-in', 'checkout', 'check-out',
      'hotel', 'guest', 'availability', 'quendoo', 'property', 'accommodation',
      'suite', 'bed', 'amenity', 'amenities', 'concierge', 'reception',
      'price', 'rate', 'package', 'deal', 'stay', 'night', 'lodging',
      'housekeeping', 'front desk', 'lobby', 'service'
    ];

    // Standard refusal message
    this.refusalMessage = "I cannot answer questions that are not connected to Quendoo functionalities.";

    // Statistics
    this.stats = {
      totalFilters: 0,
      offTopicBlocked: 0,
      dataRedacted: 0,
      passed: 0
    };
  }

  /**
   * Filter Claude's response (main entry point)
   * @param {string} response - Claude's response text
   * @param {string} originalQuery - Original user query for context
   * @returns {object} Filtered result { filtered: boolean, content: string, reason?: string }
   */
  filter(response, originalQuery = '') {
    this.stats.totalFilters++;

    if (!response || typeof response !== 'string') {
      return {
        filtered: false,
        content: response
      };
    }

    // 1. Topic relevance check (< 5ms)
    const topicCheck = this.validateTopicRelevance(response, originalQuery);
    if (topicCheck.filtered) {
      this.stats.offTopicBlocked++;
      console.log(`[Security] Replaced off-topic response: ${topicCheck.reason}`);
      return topicCheck;
    }

    // 2. Data leakage prevention (< 10ms)
    const redactedContent = this.redactSensitiveData(response);
    const wasRedacted = redactedContent !== response;

    if (wasRedacted) {
      this.stats.dataRedacted++;
      console.log('[Security] Redacted sensitive data from response');
    }

    this.stats.passed++;
    return {
      filtered: false,
      content: redactedContent,
      wasRedacted
    };
  }

  /**
   * Validate that response is on-topic for hotel operations
   * @param {string} response - Claude's response
   * @param {string} originalQuery - User's original query
   * @returns {object} Validation result
   */
  validateTopicRelevance(response, originalQuery) {
    const lowerResponse = response.toLowerCase();
    const lowerQuery = originalQuery.toLowerCase();

    // Check if response has hotel context
    const hasHotelContext = this.hotelKeywords.some(keyword =>
      lowerResponse.includes(keyword) || lowerQuery.includes(keyword)
    );

    // Check for off-topic indicators
    for (const [category, indicators] of Object.entries(this.offTopicIndicators)) {
      // Count how many indicators from this category appear
      const matchCount = indicators.filter(indicator =>
        lowerResponse.includes(indicator)
      ).length;

      // If multiple indicators from same category appear, likely off-topic
      if (matchCount >= 2) {
        // If there's no hotel context, definitely off-topic
        if (!hasHotelContext) {
          return {
            filtered: true,
            content: this.refusalMessage,
            reason: `Off-topic response detected (${category})`,
            category
          };
        }

        // If hotel context is weak compared to off-topic indicators, also block
        const hotelMatches = this.hotelKeywords.filter(kw =>
          lowerResponse.includes(kw)
        ).length;

        if (matchCount > hotelMatches * 2) {
          return {
            filtered: true,
            content: this.refusalMessage,
            reason: `Response too focused on ${category} rather than hotel operations`,
            category
          };
        }
      }
    }

    // Check for explicit teaching of jailbreak methods
    const jailbreakTeaching = [
      'to bypass', 'to override', 'to ignore instructions',
      'here\'s how to', 'you can trick', 'prompt injection'
    ];

    for (const phrase of jailbreakTeaching) {
      if (lowerResponse.includes(phrase)) {
        return {
          filtered: true,
          content: this.refusalMessage,
          reason: 'Response teaches security bypass methods',
          category: 'security'
        };
      }
    }

    return { filtered: false };
  }

  /**
   * Redact sensitive data from response
   * @param {string} response - Response text
   * @returns {string} Redacted response
   */
  redactSensitiveData(response) {
    let redacted = response;

    for (const { pattern, replacement } of this.sensitivePatterns) {
      redacted = redacted.replace(pattern, replacement);
    }

    return redacted;
  }

  /**
   * Get filtering statistics
   * @returns {object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      blockRate: this.stats.totalFilters > 0
        ? (this.stats.offTopicBlocked / this.stats.totalFilters * 100).toFixed(2) + '%'
        : '0%',
      redactionRate: this.stats.totalFilters > 0
        ? (this.stats.dataRedacted / this.stats.totalFilters * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalFilters: 0,
      offTopicBlocked: 0,
      dataRedacted: 0,
      passed: 0
    };
  }
}

export default OutputFilter;
