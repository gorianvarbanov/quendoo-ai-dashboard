/**
 * Tool Validator - Tool Execution Security
 * Fast validation with < 5ms latency
 * Validates tools and their arguments before execution
 */

import { VALIDATION_CONFIG, isToolDisabled, getToolRateLimit, getCustomValidator } from './validationConfig.js';

export class ToolValidator {
  constructor() {
    // Tool allowlist - ONLY these tools can be executed
    // Based on Quendoo MCP Server tools
    this.allowedTools = {
      // Property & Room Management
      'get_property_settings': {
        description: 'Get property settings',
        maxCallsPerMinute: 20,
        requiredParams: [],
        optionalParams: ['api_lng', 'names']
      },
      'get_rooms_details': {
        description: 'Get room details',
        maxCallsPerMinute: 20,
        requiredParams: [],
        optionalParams: ['api_lng', 'room_id']
      },

      // Availability Management
      'get_availability': {
        description: 'Get availability for date range',
        maxCallsPerMinute: 20,
        requiredParams: ['date_from', 'date_to', 'sysres'],
        optionalParams: []
      },
      'update_availability': {
        description: 'Update room availability',
        maxCallsPerMinute: 10,
        requiredParams: ['values'],
        optionalParams: [],
        adminOnly: true // High-privilege operation
      },

      // Booking Management
      'get_bookings': {
        description: 'List all bookings',
        maxCallsPerMinute: 15,
        requiredParams: [],
        optionalParams: []
      },
      'get_booking_offers': {
        description: 'Get booking offers',
        maxCallsPerMinute: 20,
        requiredParams: ['date_from', 'nights'],
        optionalParams: ['bm_code', 'api_lng', 'guests', 'currency']
      },
      'ack_booking': {
        description: 'Acknowledge booking',
        maxCallsPerMinute: 10,
        requiredParams: ['booking_id', 'revision_id'],
        optionalParams: []
      },
      'post_room_assignment': {
        description: 'Assign room to booking',
        maxCallsPerMinute: 10,
        requiredParams: ['booking_id', 'revision_id'],
        optionalParams: []
      },

      // External Property Data
      'post_external_property_data': {
        description: 'Send external property data',
        maxCallsPerMinute: 5,
        requiredParams: ['data'],
        optionalParams: [],
        adminOnly: true // High-privilege operation
      },

      // API Key Management
      'set_quendoo_api_key': {
        description: 'Set Quendoo API key',
        maxCallsPerMinute: 5,
        requiredParams: ['api_key'],
        optionalParams: [],
        adminOnly: true // Sensitive operation
      },
      'get_quendoo_api_key_status': {
        description: 'Check API key status',
        maxCallsPerMinute: 10,
        requiredParams: [],
        optionalParams: []
      },
      'cleanup_quendoo_api_key': {
        description: 'Remove cached API key',
        maxCallsPerMinute: 5,
        requiredParams: [],
        optionalParams: [],
        adminOnly: true // Sensitive operation
      },

      // Communication Tools
      'make_call': {
        description: 'Make voice call',
        maxCallsPerMinute: 3, // Very limited
        requiredParams: ['phone', 'message'],
        optionalParams: [],
        adminOnly: true // Sensitive operation
      },
      'send_quendoo_email': {
        description: 'Send email',
        maxCallsPerMinute: 5,
        requiredParams: ['to', 'subject', 'message'],
        optionalParams: []
      }
    };

    // Tool call rate tracking (simple in-memory)
    this.toolCallCounts = new Map(); // toolName -> { count, resetTime }

    // Statistics
    this.stats = {
      totalValidations: 0,
      allowed: 0,
      blockedUnknown: 0,
      blockedRateLimit: 0,
      blockedInvalidArgs: 0
    };
  }

  /**
   * Validate tool execution request
   * @param {string} toolName - Name of tool to execute
   * @param {object} args - Tool arguments
   * @param {boolean} isAdmin - Whether user has admin privileges
   * @returns {object} Validation result { allowed: boolean, reason?: string }
   */
  validate(toolName, args = {}, isAdmin = false) {
    this.stats.totalValidations++;

    // 1. Check if tool is in allowlist
    if (!this.allowedTools[toolName]) {
      this.stats.blockedUnknown++;
      console.log(`[Security] Blocked unknown tool: ${toolName}`);
      return {
        allowed: false,
        reason: `Tool '${toolName}' is not in approved tool list`
      };
    }

    const toolConfig = this.allowedTools[toolName];

    // 2. Check admin-only restriction
    if (toolConfig.adminOnly && !isAdmin) {
      this.stats.blockedUnknown++;
      console.log(`[Security] Blocked admin-only tool: ${toolName}`);
      return {
        allowed: false,
        reason: `Tool '${toolName}' requires admin privileges`
      };
    }

    // 3. Validate required parameters
    for (const param of toolConfig.requiredParams) {
      if (!(param in args) || args[param] === null || args[param] === undefined) {
        this.stats.blockedInvalidArgs++;
        return {
          allowed: false,
          reason: `Missing required parameter: ${param}`
        };
      }
    }

    // 4. Rate limit check
    if (!this.checkRateLimit(toolName, toolConfig.maxCallsPerMinute)) {
      this.stats.blockedRateLimit++;
      console.log(`[Security] Rate limit exceeded for tool: ${toolName}`);
      return {
        allowed: false,
        reason: `Rate limit exceeded for tool: ${toolName}`
      };
    }

    // 5. Basic argument validation
    const argValidation = this.validateArguments(toolName, args);
    if (!argValidation.valid) {
      this.stats.blockedInvalidArgs++;
      return {
        allowed: false,
        reason: argValidation.reason
      };
    }

    this.stats.allowed++;
    return { allowed: true };
  }

  /**
   * Check rate limit for tool
   * @param {string} toolName
   * @param {number} maxCallsPerMinute
   * @returns {boolean} True if within limit
   */
  checkRateLimit(toolName, maxCallsPerMinute) {
    const now = Date.now();
    const minuteInMs = 60 * 1000;

    if (!this.toolCallCounts.has(toolName)) {
      this.toolCallCounts.set(toolName, {
        count: 1,
        resetTime: now + minuteInMs
      });
      return true;
    }

    const tracker = this.toolCallCounts.get(toolName);

    // Reset if time window expired
    if (now >= tracker.resetTime) {
      tracker.count = 1;
      tracker.resetTime = now + minuteInMs;
      return true;
    }

    // Check if under limit
    if (tracker.count < maxCallsPerMinute) {
      tracker.count++;
      return true;
    }

    return false; // Rate limit exceeded
  }

  /**
   * Validate tool arguments
   * @param {string} toolName
   * @param {object} args
   * @returns {object} Validation result
   */
  validateArguments(toolName, args) {
    // Check for custom validators from config
    const customValidator = getCustomValidator(toolName);
    if (customValidator) {
      const paramValue = args[customValidator.paramName];
      if (paramValue !== undefined) {
        const result = customValidator.validator(paramValue);
        if (!result.valid) {
          console.log(`[Security] Custom validation failed for ${toolName}.${customValidator.paramName}: ${result.reason}`);
          return result;
        }
      }
    }

    // Specific validation rules for sensitive tools

    // Phone number validation for make_call
    if (toolName === 'make_call') {
      const phone = args.phone;
      if (!phone || typeof phone !== 'string') {
        return { valid: false, reason: 'Invalid phone number' };
      }
      // Basic phone format check
      if (!/^[\+\d\s\-\(\)]{7,}$/.test(phone)) {
        return { valid: false, reason: 'Invalid phone number format' };
      }
    }

    // Email validation for send_quendoo_email
    if (toolName === 'send_quendoo_email') {
      const email = args.to;
      if (!email || typeof email !== 'string') {
        return { valid: false, reason: 'Invalid email address' };
      }
      // Basic email format check
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { valid: false, reason: 'Invalid email format' };
      }
    }

    // Date validation for availability/booking tools
    if (['get_availability', 'get_booking_offers'].includes(toolName)) {
      const dateFrom = args.date_from;
      if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
        return { valid: false, reason: 'Invalid date format (expected YYYY-MM-DD)' };
      }
    }

    // API key validation for set_quendoo_api_key
    if (toolName === 'set_quendoo_api_key') {
      const apiKey = args.api_key;
      if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
        return { valid: false, reason: 'Invalid API key format' };
      }
    }

    return { valid: true };
  }

  /**
   * Get list of allowed tools
   * @returns {Array<string>} Tool names
   */
  getAllowedTools() {
    return Object.keys(this.allowedTools);
  }

  /**
   * Get tool configuration
   * @param {string} toolName
   * @returns {object} Tool config
   */
  getToolConfig(toolName) {
    return this.allowedTools[toolName];
  }

  /**
   * Get validation statistics
   * @returns {object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      blockRate: this.stats.totalValidations > 0
        ? ((this.stats.blockedUnknown + this.stats.blockedRateLimit + this.stats.blockedInvalidArgs) / this.stats.totalValidations * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalValidations: 0,
      allowed: 0,
      blockedUnknown: 0,
      blockedRateLimit: 0,
      blockedInvalidArgs: 0
    };
  }

  /**
   * Reset rate limits (for testing)
   */
  resetRateLimits() {
    this.toolCallCounts.clear();
  }
}

export default ToolValidator;
