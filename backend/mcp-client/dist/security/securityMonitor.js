/**
 * Security Monitor - Logging & Event Tracking
 * Monitors and logs all security events
 */

export class SecurityMonitor {
  constructor() {
    this.events = [];
    this.maxEvents = 1000; // Keep last 1000 events in memory

    // Event counters
    this.counters = {
      inputBlocked: 0,
      outputFiltered: 0,
      toolBlocked: 0,
      rateLimited: 0,
      dataRedacted: 0,
      totalRequests: 0
    };

    // Rate limit tracking per conversation
    this.conversationRateLimits = new Map(); // conversationId -> { count, resetTime }
  }

  /**
   * Log a security event
   * @param {object} event - Event details
   */
  logEvent(event) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      id: this.generateEventId(),
      ...event
    };

    // Add to events array
    this.events.unshift(logEntry);

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }

    // Update counters
    this.updateCounters(event);

    // Log to console
    this.logToConsole(logEntry);

    return logEntry;
  }

  /**
   * Log input validation block
   */
  logInputBlocked(conversationId, message, reason, pattern) {
    return this.logEvent({
      type: 'input_blocked',
      severity: 'warning',
      conversationId,
      message: this.truncate(message, 100),
      reason,
      pattern,
      action: 'blocked'
    });
  }

  /**
   * Log output filtering
   */
  logOutputFiltered(conversationId, originalResponse, reason, category) {
    return this.logEvent({
      type: 'output_filtered',
      severity: 'warning',
      conversationId,
      originalResponse: this.truncate(originalResponse, 100),
      reason,
      category,
      action: 'replaced'
    });
  }

  /**
   * Log data redaction
   */
  logDataRedacted(conversationId, redactionCount) {
    return this.logEvent({
      type: 'data_redacted',
      severity: 'info',
      conversationId,
      redactionCount,
      action: 'redacted'
    });
  }

  /**
   * Log tool execution block
   */
  logToolBlocked(conversationId, toolName, reason) {
    return this.logEvent({
      type: 'tool_blocked',
      severity: 'warning',
      conversationId,
      toolName,
      reason,
      action: 'blocked'
    });
  }

  /**
   * Log tool execution success
   */
  logToolExecuted(conversationId, toolName, args) {
    return this.logEvent({
      type: 'tool_executed',
      severity: 'info',
      conversationId,
      toolName,
      args: this.sanitizeArgs(args),
      action: 'executed'
    });
  }

  /**
   * Log rate limit exceeded
   */
  logRateLimitExceeded(conversationId, limitType) {
    return this.logEvent({
      type: 'rate_limit_exceeded',
      severity: 'warning',
      conversationId,
      limitType,
      action: 'blocked'
    });
  }

  /**
   * Log successful request
   */
  logRequestSuccess(conversationId) {
    this.counters.totalRequests++;
    return this.logEvent({
      type: 'request_success',
      severity: 'info',
      conversationId,
      action: 'allowed'
    });
  }

  /**
   * Check conversation rate limit
   * @param {string} conversationId
   * @param {number} maxMessagesPerMinute - Default 20
   * @returns {boolean} True if within limit
   */
  checkConversationRateLimit(conversationId, maxMessagesPerMinute = 20) {
    const now = Date.now();
    const minuteInMs = 60 * 1000;

    if (!this.conversationRateLimits.has(conversationId)) {
      this.conversationRateLimits.set(conversationId, {
        count: 1,
        resetTime: now + minuteInMs
      });
      return true;
    }

    const tracker = this.conversationRateLimits.get(conversationId);

    // Reset if time window expired
    if (now >= tracker.resetTime) {
      tracker.count = 1;
      tracker.resetTime = now + minuteInMs;
      return true;
    }

    // Check if under limit
    if (tracker.count < maxMessagesPerMinute) {
      tracker.count++;
      return true;
    }

    // Rate limit exceeded
    this.counters.rateLimited++;
    this.logRateLimitExceeded(conversationId, 'conversation');
    return false;
  }

  /**
   * Get recent events
   * @param {number} limit - Number of events to return
   * @param {string} type - Filter by event type (optional)
   * @returns {Array} Events
   */
  getRecentEvents(limit = 50, type = null) {
    let events = this.events;

    if (type) {
      events = events.filter(e => e.type === type);
    }

    return events.slice(0, limit);
  }

  /**
   * Get security statistics
   * @returns {object} Statistics
   */
  getStats() {
    const totalBlocked = this.counters.inputBlocked +
                        this.counters.outputFiltered +
                        this.counters.toolBlocked;

    return {
      ...this.counters,
      totalBlocked,
      blockRate: this.counters.totalRequests > 0
        ? (totalBlocked / this.counters.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      totalEvents: this.events.length
    };
  }

  /**
   * Get events grouped by type
   * @returns {object} Events by type
   */
  getEventsByType() {
    const grouped = {};

    for (const event of this.events) {
      if (!grouped[event.type]) {
        grouped[event.type] = [];
      }
      grouped[event.type].push(event);
    }

    return grouped;
  }

  /**
   * Detect attack patterns
   * @param {string} conversationId
   * @returns {object} Pattern analysis
   */
  detectAttackPatterns(conversationId) {
    // Get recent events for this conversation
    const conversationEvents = this.events.filter(
      e => e.conversationId === conversationId
    ).slice(0, 20);

    // Count blocked attempts in last 20 events
    const blockedCount = conversationEvents.filter(
      e => e.action === 'blocked'
    ).length;

    // Pattern: Multiple injection attempts
    const injectionAttempts = conversationEvents.filter(
      e => e.type === 'input_blocked' && e.reason?.includes('injection')
    ).length;

    // Pattern: Systematic probing
    const recentBlocks = conversationEvents.slice(0, 5).filter(
      e => e.action === 'blocked'
    ).length;

    return {
      conversationId,
      totalBlocked: blockedCount,
      injectionAttempts,
      systematicProbing: recentBlocks >= 3,
      threatLevel: this.calculateThreatLevel(blockedCount, injectionAttempts, recentBlocks)
    };
  }

  /**
   * Calculate threat level
   */
  calculateThreatLevel(totalBlocked, injectionAttempts, recentBlocks) {
    if (injectionAttempts >= 3 || recentBlocks >= 4) {
      return 'high';
    }
    if (totalBlocked >= 5 || recentBlocks >= 2) {
      return 'medium';
    }
    if (totalBlocked > 0) {
      return 'low';
    }
    return 'none';
  }

  /**
   * Update counters based on event
   */
  updateCounters(event) {
    switch (event.type) {
      case 'input_blocked':
        this.counters.inputBlocked++;
        break;
      case 'output_filtered':
        this.counters.outputFiltered++;
        break;
      case 'tool_blocked':
        this.counters.toolBlocked++;
        break;
      case 'data_redacted':
        this.counters.dataRedacted++;
        break;
      case 'request_success':
        // Already incremented in logRequestSuccess
        break;
    }
  }

  /**
   * Log to console with formatting
   */
  logToConsole(event) {
    const prefix = `[Security Monitor ${event.severity.toUpperCase()}]`;
    const message = `${prefix} ${event.type}: ${event.reason || event.action}`;

    if (event.severity === 'warning') {
      console.warn(message);
    } else {
      console.log(message);
    }
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Truncate long strings
   */
  truncate(str, maxLength) {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  }

  /**
   * Sanitize tool arguments (remove sensitive data)
   */
  sanitizeArgs(args) {
    const sanitized = { ...args };

    // Remove API keys
    if (sanitized.api_key) {
      sanitized.api_key = '[REDACTED]';
    }

    // Truncate long values
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 100) {
        sanitized[key] = this.truncate(sanitized[key], 100);
      }
    }

    return sanitized;
  }

  /**
   * Clear all events and reset counters
   */
  reset() {
    this.events = [];
    this.counters = {
      inputBlocked: 0,
      outputFiltered: 0,
      toolBlocked: 0,
      rateLimited: 0,
      dataRedacted: 0,
      totalRequests: 0
    };
    this.conversationRateLimits.clear();
  }
}

export default SecurityMonitor;
