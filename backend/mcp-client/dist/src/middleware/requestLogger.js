/**
 * Request Logging Middleware
 * Adds correlation IDs and logs all HTTP requests/responses
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

/**
 * Add correlation ID to each request
 */
export function addCorrelationId(req, res, next) {
  // Use existing correlation ID from header or generate new one
  req.requestId = req.headers['x-request-id'] ||
                  req.headers['x-correlation-id'] ||
                  uuidv4();

  // Add to response headers for tracing
  res.setHeader('X-Request-ID', req.requestId);
  res.setHeader('X-Correlation-ID', req.requestId);

  next();
}

/**
 * Log HTTP requests and responses
 */
export function logHttpRequests(req, res, next) {
  const startTime = Date.now();

  // Log incoming request
  logger.logRequest(req, {
    hotelId: req.hotel?.hotelId,
    userId: req.user?.username
  });

  // Capture original end method
  const originalEnd = res.end;

  // Override end method to log response
  res.end = function(chunk, encoding) {
    res.end = originalEnd;
    res.end(chunk, encoding);

    const duration = Date.now() - startTime;

    // Log response
    logger.logResponse(req, res, duration, {
      hotelId: req.hotel?.hotelId,
      userId: req.user?.username
    });
  };

  next();
}

/**
 * Error logging middleware
 * Should be added after all routes
 */
export function logErrors(err, req, res, next) {
  logger.logError(err, {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    hotelId: req.hotel?.hotelId,
    userId: req.user?.username
  });

  // Pass error to next error handler
  next(err);
}
