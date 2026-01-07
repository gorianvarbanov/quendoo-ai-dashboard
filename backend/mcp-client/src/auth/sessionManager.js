/**
 * Session Management & Token Refresh
 * Handles JWT token refresh and revocation
 */

import jwt from 'jsonwebtoken';
import { getFirestore } from '../db/firestore.js';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '1h'; // Short-lived access token
const REFRESH_TOKEN_EXPIRY = '30d'; // Long-lived refresh token

/**
 * Token blacklist (revoked tokens)
 * In production, use Redis for distributed systems
 */
class TokenBlacklist {
  constructor() {
    this.blacklist = new Set();

    // Clean up expired tokens every hour
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * Add token to blacklist
   */
  add(token, expiresAt) {
    this.blacklist.add(JSON.stringify({ token, expiresAt }));
  }

  /**
   * Check if token is blacklisted
   */
  has(token) {
    for (const item of this.blacklist) {
      const parsed = JSON.parse(item);
      if (parsed.token === token) {
        return true;
      }
    }
    return false;
  }

  /**
   * Remove expired tokens from blacklist
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const item of this.blacklist) {
      const parsed = JSON.parse(item);
      if (now > parsed.expiresAt) {
        this.blacklist.delete(item);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Token blacklist cleanup', { tokensRemoved: cleaned });
    }
  }
}

const blacklist = new TokenBlacklist();

/**
 * Generate access and refresh tokens
 */
export function generateTokenPair(payload) {
  const accessToken = jwt.sign(
    { ...payload, tokenType: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { ...payload, tokenType: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
}

/**
 * Verify and decode token
 */
export function verifyToken(token) {
  try {
    // Check if token is blacklisted
    if (blacklist.has(token)) {
      logger.warn('Attempted to use blacklisted token');
      throw new Error('Token has been revoked');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken) {
  try {
    // Verify refresh token
    const decoded = verifyToken(refreshToken);

    if (decoded.tokenType !== 'refresh') {
      throw new Error('Invalid token type - expected refresh token');
    }

    // Check if hotel still exists and is active
    const db = await getFirestore();
    const hotel = await db.collection('hotels').doc(decoded.hotelId).get();

    if (!hotel.exists) {
      throw new Error('Hotel not found');
    }

    const hotelData = hotel.data();

    if (hotelData.status !== 'active') {
      throw new Error('Account suspended');
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        hotelId: decoded.hotelId,
        type: 'hotel',
        hotelName: hotelData.hotelName,
        email: hotelData.contactEmail,
        tokenType: 'access'
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    logger.info('Access token refreshed', {
      hotelId: decoded.hotelId
    });

    return {
      accessToken: newAccessToken,
      expiresIn: '1h'
    };

  } catch (error) {
    logger.warn('Token refresh failed', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Revoke token (add to blacklist)
 */
export function revokeToken(token) {
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      blacklist.add(token, decoded.exp * 1000);
      logger.info('Token revoked', {
        hotelId: decoded.hotelId,
        tokenType: decoded.tokenType
      });
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Failed to revoke token', {
      error: error.message
    });
    return false;
  }
}

/**
 * Revoke all tokens for a hotel (logout from all devices)
 */
export async function revokeAllTokens(hotelId) {
  try {
    const db = await getFirestore();

    // Store token version in Firestore
    const now = Date.now();
    await db.collection('hotels').doc(hotelId).update({
      'security.tokenVersion': now
    });

    logger.info('All tokens revoked for hotel', { hotelId });

    return true;
  } catch (error) {
    logger.error('Failed to revoke all tokens', {
      error: error.message,
      hotelId
    });
    return false;
  }
}

/**
 * Check if token version is valid
 * Used to invalidate old tokens after "logout from all devices"
 */
export async function isTokenVersionValid(hotelId, tokenIssuedAt) {
  try {
    const db = await getFirestore();
    const hotel = await db.collection('hotels').doc(hotelId).get();

    if (!hotel.exists) {
      return false;
    }

    const hotelData = hotel.data();
    const tokenVersion = hotelData.security?.tokenVersion;

    // If no version set, all tokens are valid
    if (!tokenVersion) {
      return true;
    }

    // Token must be issued after the version timestamp
    return tokenIssuedAt * 1000 > tokenVersion;

  } catch (error) {
    logger.error('Failed to check token version', {
      error: error.message,
      hotelId
    });
    return true; // Fail open
  }
}

/**
 * Create session record in Firestore
 */
export async function createSession(hotelId, sessionData) {
  try {
    const db = await getFirestore();
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db.collection('sessions').doc(sessionId).set({
      hotelId,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      ...sessionData
    });

    return sessionId;
  } catch (error) {
    logger.error('Failed to create session', {
      error: error.message,
      hotelId
    });
    return null;
  }
}

/**
 * Update session activity
 */
export async function updateSessionActivity(sessionId) {
  try {
    const db = await getFirestore();
    await db.collection('sessions').doc(sessionId).update({
      lastActivityAt: new Date().toISOString()
    });
  } catch (error) {
    logger.debug('Failed to update session activity', {
      error: error.message,
      sessionId
    });
  }
}

/**
 * Get active sessions for a hotel
 */
export async function getActiveSessions(hotelId) {
  try {
    const db = await getFirestore();
    const now = new Date().toISOString();

    const sessionsSnapshot = await db.collection('sessions')
      .where('hotelId', '==', hotelId)
      .where('expiresAt', '>', now)
      .orderBy('expiresAt', 'desc')
      .orderBy('lastActivityAt', 'desc')
      .get();

    return sessionsSnapshot.docs.map(doc => ({
      sessionId: doc.id,
      ...doc.data()
    }));

  } catch (error) {
    logger.error('Failed to get active sessions', {
      error: error.message,
      hotelId
    });
    return [];
  }
}

/**
 * Terminate session
 */
export async function terminateSession(sessionId) {
  try {
    const db = await getFirestore();
    await db.collection('sessions').doc(sessionId).delete();

    logger.info('Session terminated', { sessionId });
    return true;
  } catch (error) {
    logger.error('Failed to terminate session', {
      error: error.message,
      sessionId
    });
    return false;
  }
}

export default {
  generateTokenPair,
  verifyToken,
  refreshAccessToken,
  revokeToken,
  revokeAllTokens,
  isTokenVersionValid,
  createSession,
  updateSessionActivity,
  getActiveSessions,
  terminateSession
};
