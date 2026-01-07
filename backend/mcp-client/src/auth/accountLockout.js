/**
 * Account Lockout System
 * Locks accounts after multiple failed login attempts
 */

import { getFirestore } from '../db/firestore.js';
import logger from '../utils/logger.js';

// Configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Record failed login attempt
 */
export async function recordFailedLogin(hotelId, email, ip) {
  try {
    const db = await getFirestore();
    const hotelRef = db.collection('hotels').doc(hotelId);
    const hotel = await hotelRef.get();

    if (!hotel.exists) {
      return;
    }

    const hotelData = hotel.data();
    const now = Date.now();

    // Initialize security object if not exists
    const security = hotelData.security || {
      failedLoginAttempts: [],
      lockedUntil: null,
      lockoutCount: 0
    };

    // Remove old attempts outside the window
    security.failedLoginAttempts = (security.failedLoginAttempts || [])
      .filter(attempt => now - new Date(attempt.timestamp).getTime() < ATTEMPT_WINDOW_MS);

    // Add new failed attempt
    security.failedLoginAttempts.push({
      timestamp: new Date().toISOString(),
      ip,
      email
    });

    // Check if should lock account
    if (security.failedLoginAttempts.length >= MAX_FAILED_ATTEMPTS) {
      security.lockedUntil = new Date(now + LOCKOUT_DURATION_MS).toISOString();
      security.lockoutCount = (security.lockoutCount || 0) + 1;
      security.failedLoginAttempts = []; // Reset attempts

      logger.warn('Account locked due to failed login attempts', {
        hotelId,
        email,
        ip,
        lockoutCount: security.lockoutCount,
        lockedUntil: security.lockedUntil
      });
    }

    // Update Firestore
    await hotelRef.update({ security });

    return {
      locked: !!security.lockedUntil && now < new Date(security.lockedUntil).getTime(),
      attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - security.failedLoginAttempts.length),
      lockedUntil: security.lockedUntil
    };

  } catch (error) {
    logger.error('Failed to record failed login attempt', {
      error: error.message,
      hotelId,
      email
    });
    // Don't throw - security should not break login flow
    return null;
  }
}

/**
 * Check if account is locked
 */
export async function isAccountLocked(hotelId) {
  try {
    const db = await getFirestore();
    const hotel = await db.collection('hotels').doc(hotelId).get();

    if (!hotel.exists) {
      return false;
    }

    const hotelData = hotel.data();
    const security = hotelData.security;

    if (!security || !security.lockedUntil) {
      return false;
    }

    const now = Date.now();
    const lockedUntil = new Date(security.lockedUntil).getTime();

    // Check if still locked
    if (now < lockedUntil) {
      return {
        locked: true,
        lockedUntil: security.lockedUntil,
        lockoutCount: security.lockoutCount || 1
      };
    }

    // Lock expired - clear it
    await db.collection('hotels').doc(hotelId).update({
      'security.lockedUntil': null,
      'security.failedLoginAttempts': []
    });

    return false;

  } catch (error) {
    logger.error('Failed to check account lock status', {
      error: error.message,
      hotelId
    });
    return false; // Fail open - don't block legitimate users
  }
}

/**
 * Reset failed login attempts after successful login
 */
export async function resetFailedAttempts(hotelId) {
  try {
    const db = await getFirestore();
    await db.collection('hotels').doc(hotelId).update({
      'security.failedLoginAttempts': [],
      'security.lockedUntil': null
    });

    logger.debug('Failed login attempts reset', { hotelId });

  } catch (error) {
    logger.error('Failed to reset login attempts', {
      error: error.message,
      hotelId
    });
  }
}

/**
 * Manually unlock account (for admin use)
 */
export async function unlockAccount(hotelId) {
  try {
    const db = await getFirestore();
    await db.collection('hotels').doc(hotelId).update({
      'security.lockedUntil': null,
      'security.failedLoginAttempts': []
    });

    logger.info('Account manually unlocked', { hotelId });

    return true;
  } catch (error) {
    logger.error('Failed to unlock account', {
      error: error.message,
      hotelId
    });
    return false;
  }
}

/**
 * Get account security status
 */
export async function getSecurityStatus(hotelId) {
  try {
    const db = await getFirestore();
    const hotel = await db.collection('hotels').doc(hotelId).get();

    if (!hotel.exists) {
      return null;
    }

    const hotelData = hotel.data();
    const security = hotelData.security || {};

    const now = Date.now();
    const locked = security.lockedUntil && now < new Date(security.lockedUntil).getTime();

    return {
      failedAttempts: (security.failedLoginAttempts || []).length,
      maxAttempts: MAX_FAILED_ATTEMPTS,
      locked,
      lockedUntil: security.lockedUntil,
      lockoutCount: security.lockoutCount || 0
    };

  } catch (error) {
    logger.error('Failed to get security status', {
      error: error.message,
      hotelId
    });
    return null;
  }
}

export default {
  recordFailedLogin,
  isAccountLocked,
  resetFailedAttempts,
  unlockAccount,
  getSecurityStatus,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS
};
