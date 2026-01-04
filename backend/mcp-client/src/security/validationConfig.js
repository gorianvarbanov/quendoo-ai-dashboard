/**
 * Validation Configuration
 * Centralized configuration for security validation rules
 * Edit this file to adjust validation behavior without modifying core code
 */

export const VALIDATION_CONFIG = {
  // Input validation settings
  input: {
    maxLength: 2000,
    allowControlCharacters: false,

    // Prompt injection patterns (case-insensitive regex)
    injectionPatterns: [
      /ignore\s+(previous|above|all|prior)\s+(instructions?|rules?|prompts?)/i,
      /forget\s+(everything|all|previous|your)/i,
      /you\s+(are\s+now|must\s+now)\s+(a|an)/i,
      /system\s*:\s*/i,
      /new\s+instructions?/i,
      /disregard\s+(previous|above)/i,
      /act\s+as\s+(?!hotel|reservation)/i,
      /<\s*script/i,
      /```\s*system/i,
      /repeat\s+the\s+words\s+above/i,
      /what\s+(are|is)\s+your\s+(instructions?|rules?)/i,
      /how\s+were\s+you\s+(programmed|trained|instructed)/i,
      /override\s+(previous|default)/i,
      /execute\s+the\s+following/i
    ],

    // Off-topic detection keywords
    offTopicKeywords: {
      // Medical topics
      medical: [
        'medicine', 'medication', 'prescription', 'treatment', 'diagnosis',
        'doctor', 'hospital', 'cure', 'disease', 'illness', 'symptom',
        'therapy', 'drug', 'pill', 'pain reliever', 'antibiotic'
      ],

      // Cooking topics
      cooking: [
        'recipe', 'ingredient', 'cook', 'bake', 'prepare', 'dish',
        'kitchen', 'oven', 'stove', 'meal', 'food preparation',
        'seasoning', 'marinade', 'simmer', 'boil', 'fry', 'grill'
      ],

      // Programming/coding topics
      programming: [
        'code', 'program', 'script', 'function', 'variable', 'algorithm',
        'debug', 'compile', 'syntax', 'loop', 'array', 'object',
        'python', 'javascript', 'java', 'html', 'css'
      ],

      // Gardening topics
      gardening: [
        'plant', 'flower', 'garden', 'seed', 'soil', 'fertilizer',
        'watering', 'pruning', 'greenhouse', 'compost', 'harvest'
      ]
    },

    // Hotel-related keywords (if present, reduce suspicion)
    hotelKeywords: [
      'room', 'booking', 'reservation', 'check-in', 'check-out',
      'hotel', 'guest', 'availability', 'quendoo', 'property',
      'suite', 'accommodation', 'lodge', 'stay', 'night'
    ]
  },

  // Output validation settings
  output: {
    // Off-topic indicators in responses
    offTopicIndicators: {
      medical: [
        'medication', 'medicine', 'prescription', 'treatment', 'diagnosis',
        'consult a doctor', 'medical professional', 'health condition',
        'symptoms', 'illness', 'disease', 'therapy', 'cure',
        'drug', 'pill', 'antibiotic', 'pain reliever'
      ],

      cooking: [
        'recipe', 'ingredient', 'cook for', 'bake for', 'preparation time',
        'serves', 'tablespoon', 'teaspoon', 'cup of', 'oven temperature',
        'simmer', 'boil', 'fry', 'grill', 'marinade', 'seasoning'
      ],

      programming: [
        'coding', 'programming', 'script', 'function', 'variable',
        'syntax', 'compile', 'debug', 'algorithm', 'code example',
        'import', 'export', 'class', 'method', 'array'
      ],

      gardening: [
        'plant', 'flower', 'garden', 'seed', 'soil', 'fertilizer',
        'watering', 'pruning', 'bloom', 'harvest', 'compost'
      ]
    },

    // Jailbreak teaching indicators
    jailbreakIndicators: [
      'here\'s how to bypass',
      'you can trick',
      'ignore the system prompt',
      'circumvent the restrictions',
      'get around the limitations',
      'hack the prompt',
      'jailbreak'
    ],

    // Sensitive data patterns to redact
    sensitivePatterns: [
      { pattern: /sk-[a-zA-Z0-9-_]{20,}/g, replacement: '[REDACTED_API_KEY]', name: 'API Key' },
      { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[REDACTED_EMAIL]', name: 'Email' },
      { pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, replacement: '[REDACTED_PHONE]', name: 'Phone' },
      { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[REDACTED_CARD]', name: 'Credit Card' },
      { pattern: /password\s*[:=]\s*['"]?[^\s'"]{6,}['"]?/gi, replacement: 'password: [REDACTED]', name: 'Password' },
      { pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, replacement: '[REDACTED_TOKEN]', name: 'JWT Token' }
    ]
  },

  // Tool validation settings
  tools: {
    // For easy adjustment: disable specific tools here
    disabledTools: [
      // Example: 'make_call' // Uncomment to disable this tool
    ],

    // Tool-specific parameter validation rules
    parameterRules: {
      // Example: Add custom validation for specific tools
      'update_availability': {
        // Ensure 'values' is an array
        validateValues: (values) => {
          if (!Array.isArray(values)) {
            return { valid: false, reason: 'values must be an array' };
          }

          // Check each object in the array
          for (const item of values) {
            const requiredFields = ['date', 'room_id', 'avail', 'qty', 'is_opened'];
            for (const field of requiredFields) {
              if (!(field in item)) {
                return {
                  valid: false,
                  reason: `Missing required field '${field}' in values array object`
                };
              }
            }

            // Validate date format
            if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
              return {
                valid: false,
                reason: 'Date must be in YYYY-MM-DD format'
              };
            }
          }

          return { valid: true };
        }
      }
    }
  },

  // Rate limiting settings
  rateLimits: {
    // Conversation-level rate limit
    maxMessagesPerMinute: 20,

    // Per-tool rate limits (overrides for specific tools)
    perToolLimits: {
      'make_call': 3,
      'send_quendoo_email': 5,
      'update_availability': 10,
      'post_external_property_data': 5
    }
  }
};

/**
 * Helper function to check if a tool is disabled
 * @param {string} toolName
 * @returns {boolean}
 */
export function isToolDisabled(toolName) {
  return VALIDATION_CONFIG.tools.disabledTools.includes(toolName);
}

/**
 * Helper function to get tool rate limit
 * @param {string} toolName
 * @param {number} defaultLimit
 * @returns {number}
 */
export function getToolRateLimit(toolName, defaultLimit) {
  return VALIDATION_CONFIG.rateLimits.perToolLimits[toolName] || defaultLimit;
}

/**
 * Helper function to get custom tool parameter validator
 * @param {string} toolName
 * @returns {Function|null}
 */
export function getCustomValidator(toolName) {
  const rules = VALIDATION_CONFIG.tools.parameterRules[toolName];
  if (!rules) return null;

  // Find validation function (e.g., validateValues for 'values' parameter)
  for (const [key, value] of Object.entries(rules)) {
    if (key.startsWith('validate') && typeof value === 'function') {
      return { paramName: key.replace('validate', '').toLowerCase(), validator: value };
    }
  }

  return null;
}

export default VALIDATION_CONFIG;
