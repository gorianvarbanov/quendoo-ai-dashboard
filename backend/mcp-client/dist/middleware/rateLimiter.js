/**
 * Rate Limiting Middleware
 * Protects against brute-force attacks and API abuse
 */

import logger from '../utils/logger.js';

/**
 * In-memory rate limit store
 * In production, use Redis for distributed rate limiting
 */
class RateLimitStore {
  constructor() {
    this.store = new Map();

    // Clean up old entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Get rate limit entry for a key
   */
  get(key) {
    return this.store.get(key);
  }

  /**
   * Increment counter for a key
   */
  increment(key, windowMs) {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      // Create new entry
      this.store.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return 1;
    }

    // Increment existing entry
    entry.count++;
    this.store.set(key, entry);
    return entry.count;
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Rate limiter cleanup', { entriesRemoved: cleaned });
    }
  }

  /**
   * Reset rate limit for a key
   */
  reset(key) {
    this.store.delete(key);
  }
}

const store = new RateLimitStore();

/**
 * Create rate limiter middleware
 *
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.maxRequests - Max requests per window
 * @param {string} options.keyGenerator - Function to generate rate limit key
 * @param {string} options.message - Error message when limit exceeded
 */
export function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    keyGenerator = (req) => req.ip,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const entry = store.get(key);
    const now = Date.now();

    // Check if limit exceeded
    if (entry && entry.count >= maxRequests && now <= entry.resetAt) {
      const resetIn = Math.ceil((entry.resetAt - now) / 1000);

      logger.warn('Rate limit exceeded', {
        key,
        count: entry.count,
        maxRequests,
        resetIn,
        requestId: req.requestId,
        path: req.path
      });

      return res.status(429).json({
        error: message,
        retryAfter: resetIn,
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    // Increment counter
    const count = store.increment(key, windowMs);

    // Add rate limit headers
    const resetAt = entry ? entry.resetAt : now + windowMs;
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
    res.setHeader('X-RateLimit-Reset', new Date(resetAt).toISOString());

    if (skipSuccessfulRequests) {
      // Track original end method
      const originalEnd = res.end;

      res.end = function(chunk, encoding) {
        res.end = originalEnd;
        res.end(chunk, encoding);

        // Decrement counter if request was successful
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const entry = store.get(key);
          if (entry && entry.count > 0) {
            entry.count--;
          }
        }
      };
    }

    next();
  };
}

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per 15 minutes per IP
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  keyGenerator: (req) => `auth:${req.ip}`,
  skipSuccessfulRequests: true // Only count failed attempts
});

/**
 * Per-email rate limiter for login
 * 3 requests per 15 minutes per email
 */
export const loginEmailRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3,
  message: 'Too many login attempts for this account. Please try again in 15 minutes.',
  keyGenerator: (req) => `login:${req.body?.email || 'unknown'}`,
  skipSuccessfulRequests: true
});

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  message: 'Too many requests. Please slow down.'
});

/**
 * Reset rate limit for a key (useful for successful login)
 */
export function resetRateLimit(key) {
  store.reset(key);
}

export default {
  createRateLimiter,
  authRateLimiter,
  loginEmailRateLimiter,
  apiRateLimiter,
  resetRateLimit
};
