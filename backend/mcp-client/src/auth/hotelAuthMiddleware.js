/**
 * Hotel Authentication Middleware
 * Verifies hotel JWT tokens and loads hotel context with Quendoo API key
 */

import jwt from 'jsonwebtoken';
import { getSecret } from '../secretManager.js';
import { getFirestore } from '../db/firestore.js';

/**
 * Require hotel authentication
 * Extracts JWT from Authorization header or x-hotel-token header
 * Loads hotel data and Quendoo API key from Secret Manager
 * Attaches req.hotel object with hotelId, hotelName, quendooApiKey
 */
export async function requireHotelAuth(req, res, next) {
  try {
    // Get token from header
    const token = req.headers.authorization?.replace('Bearer ', '')
                  || req.headers['x-hotel-token'];

    if (!token) {
      return res.status(401).json({
        error: 'No hotel token provided',
        code: 'NO_TOKEN'
      });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-jwt-secret-change-in-production');

    if (decoded.type !== 'hotel') {
      return res.status(403).json({
        error: 'Invalid token type',
        code: 'INVALID_TOKEN_TYPE'
      });
    }

    // Load hotel data from Firestore
    const db = await getFirestore();
    const hotelDoc = await db.collection('hotels').doc(decoded.hotelId).get();

    if (!hotelDoc.exists) {
      return res.status(401).json({
        error: 'Hotel not found',
        code: 'HOTEL_NOT_FOUND'
      });
    }

    const hotelData = hotelDoc.data();

    // Check hotel status
    if (hotelData.status !== 'active') {
      return res.status(403).json({
        error: 'Hotel account suspended',
        code: 'HOTEL_SUSPENDED',
        status: hotelData.status
      });
    }

    // Load Quendoo API key from Secret Manager
    let quendooApiKey;
    try {
      quendooApiKey = await getSecret(hotelData.apiKeySecretName);
    } catch (secretError) {
      console.error('[Hotel Auth] Failed to load API key from Secret Manager:', secretError);
      return res.status(500).json({
        error: 'Failed to load hotel credentials',
        code: 'CREDENTIALS_ERROR'
      });
    }

    // Attach hotel context to request object
    req.hotel = {
      hotelId: decoded.hotelId,
      hotelName: hotelData.hotelName,
      contactEmail: hotelData.contactEmail,
      status: hotelData.status,
      subscription: hotelData.subscription,
      limits: hotelData.limits,
      usage: hotelData.usage,
      quendooApiKey  // Only available in backend, NEVER sent to client
    };

    console.log(`[Hotel Auth] Authenticated hotel: ${req.hotel.hotelId} (${req.hotel.hotelName})`);

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        expiredAt: error.expiredAt
      });
    }

    console.error('[Hotel Auth] Error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Optional hotel auth (doesn't fail if no token)
 * Used for public endpoints that support hotel context
 * Sets req.hotel = null if no token or invalid token
 */
export async function optionalHotelAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
                  || req.headers['x-hotel-token'];

    if (!token) {
      req.hotel = null;
      return next();
    }

    // Try to verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-jwt-secret-change-in-production');

    if (decoded.type !== 'hotel') {
      req.hotel = null;
      return next();
    }

    // Load hotel data
    const db = await getFirestore();
    const hotelDoc = await db.collection('hotels').doc(decoded.hotelId).get();

    if (!hotelDoc.exists || hotelDoc.data().status !== 'active') {
      req.hotel = null;
      return next();
    }

    const hotelData = hotelDoc.data();

    // Load API key
    try {
      const quendooApiKey = await getSecret(hotelData.apiKeySecretName);

      req.hotel = {
        hotelId: decoded.hotelId,
        hotelName: hotelData.hotelName,
        contactEmail: hotelData.contactEmail,
        status: hotelData.status,
        subscription: hotelData.subscription,
        limits: hotelData.limits,
        usage: hotelData.usage,
        quendooApiKey
      };

      console.log(`[Hotel Auth] Optional auth successful for: ${req.hotel.hotelId}`);
    } catch (secretError) {
      console.warn('[Hotel Auth] Failed to load API key:', secretError);
      req.hotel = null;
    }

    next();

  } catch (error) {
    // For optional auth, any error just means no hotel context
    req.hotel = null;
    next();
  }
}

/**
 * Check hotel usage limits
 * Verifies that hotel hasn't exceeded their plan limits
 * Must be used AFTER requireHotelAuth
 */
export async function checkHotelLimits(req, res, next) {
  if (!req.hotel) {
    return res.status(500).json({
      error: 'Hotel auth required before limit check'
    });
  }

  try {
    const { hotelId, limits, usage, subscription } = req.hotel;

    // Check if trial expired
    if (subscription.status === 'trial' && subscription.trialEndsAt) {
      const trialEnd = new Date(subscription.trialEndsAt);
      if (new Date() > trialEnd) {
        return res.status(402).json({
          error: 'Trial period expired',
          code: 'TRIAL_EXPIRED',
          message: 'Please upgrade your subscription to continue using the service'
        });
      }
    }

    // Check message limit
    if (limits.maxMessagesPerMonth > 0 && usage.messagesThisMonth >= limits.maxMessagesPerMonth) {
      return res.status(402).json({
        error: 'Monthly message limit reached',
        code: 'MESSAGE_LIMIT_REACHED',
        limit: limits.maxMessagesPerMonth,
        used: usage.messagesThisMonth,
        message: 'Please upgrade your plan to send more messages'
      });
    }

    // Check conversation limit
    if (limits.maxConversations > 0 && usage.conversations >= limits.maxConversations) {
      return res.status(402).json({
        error: 'Conversation limit reached',
        code: 'CONVERSATION_LIMIT_REACHED',
        limit: limits.maxConversations,
        used: usage.conversations,
        message: 'Please upgrade your plan to create more conversations'
      });
    }

    console.log(`[Hotel Limits] Check passed for ${hotelId}: ${usage.messagesThisMonth}/${limits.maxMessagesPerMonth} messages`);

    next();

  } catch (error) {
    console.error('[Hotel Limits] Error:', error);
    res.status(500).json({
      error: 'Failed to check usage limits'
    });
  }
}

/**
 * Increment hotel usage counters
 * Updates Firestore with new usage counts
 * Should be called AFTER successful message/conversation creation
 */
export async function incrementHotelUsage(hotelId, type) {
  try {
    const db = await getFirestore();
    const hotelRef = db.collection('hotels').doc(hotelId);

    // Reset monthly counter if needed
    const hotel = await hotelRef.get();
    const hotelData = hotel.data();

    const now = new Date();
    const lastReset = new Date(hotelData.usage.lastResetAt);
    const monthsSinceReset = (now.getFullYear() - lastReset.getFullYear()) * 12 +
                              (now.getMonth() - lastReset.getMonth());

    if (monthsSinceReset >= 1) {
      // Reset monthly counter
      await hotelRef.update({
        'usage.messagesThisMonth': type === 'message' ? 1 : 0,
        'usage.lastResetAt': now.toISOString()
      });
      console.log(`[Hotel Usage] Monthly counter reset for ${hotelId}`);
      return;
    }

    // Increment counter
    const updateField = type === 'message' ? 'usage.messagesThisMonth' : 'usage.conversations';
    const increment = db.FieldValue.increment(1);

    await hotelRef.update({
      [updateField]: increment
    });

    console.log(`[Hotel Usage] Incremented ${type} for ${hotelId}`);

  } catch (error) {
    console.error('[Hotel Usage] Failed to increment usage:', error);
    // Don't throw - usage tracking shouldn't break the main flow
  }
}
