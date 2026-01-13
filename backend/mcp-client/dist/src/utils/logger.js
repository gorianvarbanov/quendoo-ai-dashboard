/**
 * Centralized Logging System
 * Provides structured logging with different severity levels
 * Integrates with Google Cloud Logging in production
 */

import { Logging } from '@google-cloud/logging';

// Log levels
export const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

// Check if running in Google Cloud environment
const IS_GCP = process.env.K_SERVICE !== undefined;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'INFO' : 'DEBUG');

// Level hierarchy for filtering
const LEVEL_VALUES = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  CRITICAL: 4
};

class Logger {
  constructor() {
    this.gcpLogging = null;
    this.gcpLog = null;

    // Initialize Google Cloud Logging if in GCP
    if (IS_GCP) {
      try {
        this.gcpLogging = new Logging();
        this.gcpLog = this.gcpLogging.log('quendoo-backend');
        console.log('[Logger] Google Cloud Logging initialized');
      } catch (error) {
        console.error('[Logger] Failed to initialize Google Cloud Logging:', error.message);
      }
    }
  }

  /**
   * Check if log level should be logged
   */
  shouldLog(level) {
    const currentLevelValue = LEVEL_VALUES[LOG_LEVEL] || 0;
    const messageLevelValue = LEVEL_VALUES[level] || 0;
    return messageLevelValue >= currentLevelValue;
  }

  /**
   * Format log message for console output
   */
  formatConsoleMessage(severity, message, metadata) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
    return `[${timestamp}] [${severity}] ${message}${metaStr}`;
  }

  /**
   * Main logging method
   */
  log(severity, message, metadata = {}) {
    // Check if we should log this level
    if (!this.shouldLog(severity)) {
      return;
    }

    // Add contextual metadata
    const enrichedMetadata = {
      ...metadata,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      service: 'quendoo-backend'
    };

    // Add revision info if in GCP
    if (IS_GCP) {
      enrichedMetadata.revision = process.env.K_REVISION || 'unknown';
      enrichedMetadata.service_name = process.env.K_SERVICE || 'quendoo-backend';
    }

    // Log to Google Cloud Logging if available
    if (this.gcpLog) {
      try {
        const entry = this.gcpLog.entry(
          {
            resource: { type: 'cloud_run_revision' },
            severity: severity,
            labels: {
              environment: enrichedMetadata.environment,
              version: enrichedMetadata.revision || 'local'
            }
          },
          {
            message,
            ...enrichedMetadata
          }
        );

        // Write async (don't await to avoid blocking)
        this.gcpLog.write(entry).catch(err => {
          console.error('[Logger] Failed to write to Cloud Logging:', err.message);
        });
      } catch (error) {
        console.error('[Logger] Error creating log entry:', error.message);
      }
    }

    // Always log to console (for local development and as fallback)
    const consoleMessage = this.formatConsoleMessage(severity, message, metadata);

    switch (severity) {
      case LOG_LEVELS.DEBUG:
        console.debug(consoleMessage);
        break;
      case LOG_LEVELS.INFO:
        console.info(consoleMessage);
        break;
      case LOG_LEVELS.WARN:
        console.warn(consoleMessage);
        break;
      case LOG_LEVELS.ERROR:
      case LOG_LEVELS.CRITICAL:
        console.error(consoleMessage);
        break;
      default:
        console.log(consoleMessage);
    }
  }

  /**
   * Convenience methods for different log levels
   */
  debug(message, metadata = {}) {
    this.log(LOG_LEVELS.DEBUG, message, metadata);
  }

  info(message, metadata = {}) {
    this.log(LOG_LEVELS.INFO, message, metadata);
  }

  warn(message, metadata = {}) {
    this.log(LOG_LEVELS.WARN, message, metadata);
  }

  error(message, metadata = {}) {
    this.log(LOG_LEVELS.ERROR, message, metadata);
  }

  critical(message, metadata = {}) {
    this.log(LOG_LEVELS.CRITICAL, message, metadata);
  }

  /**
   * Log HTTP request
   */
  logRequest(req, metadata = {}) {
    this.info('HTTP Request', {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      ...metadata
    });
  }

  /**
   * Log HTTP response
   */
  logResponse(req, res, duration, metadata = {}) {
    const level = res.statusCode >= 500 ? LOG_LEVELS.ERROR :
                  res.statusCode >= 400 ? LOG_LEVELS.WARN :
                  LOG_LEVELS.INFO;

    this.log(level, 'HTTP Response', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.requestId,
      ...metadata
    });
  }

  /**
   * Log error with stack trace
   */
  logError(error, context = {}) {
    this.error(error.message || 'Unknown error', {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
      ...context
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default for convenience
export default logger;
