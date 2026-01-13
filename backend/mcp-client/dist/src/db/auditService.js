/**
 * Audit Service
 * Handles audit logging for security and compliance
 */
import { getFirestore, COLLECTIONS } from './firestore.js';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Log types
 */
export const LOG_TYPES = {
  AUTH: 'auth',
  API_KEY: 'api_key',
  PASSWORD: 'password',
  CONVERSATION: 'conversation',
  SETTINGS: 'settings',
  SECURITY: 'security',
  ERROR: 'error'
};

/**
 * Log actions
 */
export const LOG_ACTIONS = {
  // Auth
  LOGIN: 'login',
  LOGOUT: 'logout',
  LOGIN_FAILED: 'login_failed',

  // API Key
  API_KEY_VIEWED: 'api_key_viewed',
  API_KEY_UPDATED: 'api_key_updated',
  API_KEY_REMOVED: 'api_key_removed',

  // Password
  PASSWORD_CHANGED: 'password_changed',
  PASSWORD_CHANGE_FAILED: 'password_change_failed',

  // Conversations
  CONVERSATION_CREATED: 'conversation_created',
  CONVERSATION_DELETED: 'conversation_deleted',
  MESSAGE_SENT: 'message_sent',

  // Settings
  SETTINGS_UPDATED: 'settings_updated',

  // Security
  PROMPT_INJECTION_BLOCKED: 'prompt_injection_blocked',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',

  // Errors
  ERROR_OCCURRED: 'error_occurred'
};

/**
 * Create audit log entry
 */
export async function logAudit(type, action, details = {}) {
  try {
    const db = await getFirestore();
    const auditLogsRef = db.collection(COLLECTIONS.AUDIT_LOGS);

    const logEntry = {
      type,
      action,
      details,
      timestamp: FieldValue.serverTimestamp(),
      ipAddress: details.ipAddress || null,
      userAgent: details.userAgent || null,
      userId: details.userId || null
    };

    await auditLogsRef.add(logEntry);

    console.log(`[Audit] ${type}.${action}`, details);
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    console.error('[AuditService] Error logging audit:', error);
  }
}

/**
 * Get audit logs with filtering
 */
export async function getAuditLogs(filters = {}, limit = 100) {
  try {
    const db = await getFirestore();
    let query = db.collection(COLLECTIONS.AUDIT_LOGS);

    // Apply filters
    if (filters.type) {
      query = query.where('type', '==', filters.type);
    }

    if (filters.action) {
      query = query.where('action', '==', filters.action);
    }

    if (filters.userId) {
      query = query.where('userId', '==', filters.userId);
    }

    if (filters.startDate) {
      query = query.where('timestamp', '>=', filters.startDate);
    }

    if (filters.endDate) {
      query = query.where('timestamp', '<=', filters.endDate);
    }

    // Order by timestamp descending
    query = query.orderBy('timestamp', 'desc').limit(limit);

    const snapshot = await query.get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('[AuditService] Error getting audit logs:', error);
    throw error;
  }
}

/**
 * Get security events (blocked attempts, rate limits, etc.)
 */
export async function getSecurityEvents(hours = 24, limit = 100) {
  try {
    const db = await getFirestore();
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const snapshot = await db.collection(COLLECTIONS.AUDIT_LOGS)
      .where('type', '==', LOG_TYPES.SECURITY)
      .where('timestamp', '>=', startTime)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('[AuditService] Error getting security events:', error);
    throw error;
  }
}

/**
 * Get login attempts (for security monitoring)
 */
export async function getLoginAttempts(hours = 24) {
  try {
    const db = await getFirestore();
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const snapshot = await db.collection(COLLECTIONS.AUDIT_LOGS)
      .where('type', '==', LOG_TYPES.AUTH)
      .where('timestamp', '>=', startTime)
      .orderBy('timestamp', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('[AuditService] Error getting login attempts:', error);
    throw error;
  }
}

/**
 * Get audit statistics
 */
export async function getAuditStats(hours = 24) {
  try {
    const db = await getFirestore();
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const snapshot = await db.collection(COLLECTIONS.AUDIT_LOGS)
      .where('timestamp', '>=', startTime)
      .get();

    const stats = {
      total: snapshot.size,
      byType: {},
      byAction: {},
      securityEvents: 0,
      failedLogins: 0
    };

    snapshot.docs.forEach(doc => {
      const data = doc.data();

      // Count by type
      stats.byType[data.type] = (stats.byType[data.type] || 0) + 1;

      // Count by action
      stats.byAction[data.action] = (stats.byAction[data.action] || 0) + 1;

      // Count security events
      if (data.type === LOG_TYPES.SECURITY) {
        stats.securityEvents++;
      }

      // Count failed logins
      if (data.action === LOG_ACTIONS.LOGIN_FAILED) {
        stats.failedLogins++;
      }
    });

    return stats;
  } catch (error) {
    console.error('[AuditService] Error getting audit stats:', error);
    throw error;
  }
}

export default {
  logAudit,
  getAuditLogs,
  getSecurityEvents,
  getLoginAttempts,
  getAuditStats,
  LOG_TYPES,
  LOG_ACTIONS
};
