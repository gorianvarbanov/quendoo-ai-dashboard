/**
 * Hotel Registration & Authentication Routes
 * Secure hotel onboarding without exposing Quendoo API keys
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { createOrUpdateSecret, getSecret } from '../secretManager.js';
import { createHotelId } from '../utils/hashUtils.js';
import { getFirestore } from '../db/firestore.js';
import { logAudit, LOG_TYPES, LOG_ACTIONS } from '../db/auditService.js';
import hotelStorage from '../db/hotelStorageInMemory.js';

const router = express.Router();

// Check if Firestore is enabled
const USE_FIRESTORE = process.env.USE_FIRESTORE !== 'false';
console.log(`[Hotel Routes] Using ${USE_FIRESTORE ? 'Firestore' : 'In-Memory'} storage`);

/**
 * Register new hotel
 * POST /api/hotels/register
 * Body: { quendooApiKey: string, hotelName?: string, contactEmail?: string }
 * Returns: { success: true, hotelToken: JWT, hotelId, hotelName }
 */
router.post('/register', async (req, res) => {
  try {
    const { quendooApiKey, hotelName, contactEmail } = req.body;

    console.log('[Hotel Registration] Request received');

    // Validate API key format
    if (!quendooApiKey || typeof quendooApiKey !== 'string') {
      return res.status(400).json({ error: 'Quendoo API key is required' });
    }

    // Basic format validation
    if (quendooApiKey.length < 10) {
      return res.status(400).json({ error: 'Invalid Quendoo API key format' });
    }

    // Create hotel ID from API key hash
    const hotelId = createHotelId(quendooApiKey);
    console.log(`[Hotel Registration] Generated hotelId: ${hotelId}`);

    // Check if hotel already registered
    const db = await getFirestore();
    const existingHotel = await db.collection('hotels').doc(hotelId).get();
    if (existingHotel.exists) {
      console.log(`[Hotel Registration] Hotel already exists: ${hotelId}`);

      // Return existing hotel info with new token
      const hotelData = existingHotel.data();

      // Generate JWT token (valid for 30 days)
      const hotelToken = jwt.sign(
        {
          hotelId,
          type: 'hotel',
          hotelName: hotelData.hotelName || 'Unknown Hotel'
        },
        process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
        { expiresIn: '30d' }
      );

      return res.json({
        success: true,
        hotelToken,
        hotelId,
        hotelName: hotelData.hotelName || 'Unknown Hotel',
        message: 'Hotel already registered, returning new token',
        expiresIn: '30 days'
      });
    }

    // Store encrypted API key in Secret Manager
    const secretName = `quendoo-api-key-${hotelId}`;
    console.log(`[Hotel Registration] Storing API key in Secret Manager: ${secretName}`);

    try {
      await createOrUpdateSecret(secretName, quendooApiKey);
      console.log(`[Hotel Registration] API key stored successfully`);
    } catch (secretError) {
      console.error('[Hotel Registration] Failed to store API key:', secretError);
      return res.status(500).json({
        error: 'Failed to securely store API key',
        details: process.env.NODE_ENV === 'development' ? secretError.message : undefined
      });
    }

    // Store hotel metadata in Firestore
    const hotelData = {
      hotelId,
      hotelName: hotelName || 'Unknown Hotel',
      contactEmail: contactEmail || null,
      registeredAt: new Date().toISOString(),
      status: 'active',
      apiKeySecretName: secretName,
      subscription: {
        plan: 'starter',
        status: 'trial',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days
      },
      limits: {
        maxConversations: 100,
        maxMessagesPerMonth: 1000
      },
      usage: {
        conversations: 0,
        messagesThisMonth: 0,
        lastResetAt: new Date().toISOString()
      }
    };

    await db.collection('hotels').doc(hotelId).set(hotelData);
    console.log(`[Hotel Registration] Hotel metadata stored in Firestore`);

    // Generate JWT token (valid for 30 days)
    const hotelToken = jwt.sign(
      {
        hotelId,
        type: 'hotel',
        hotelName: hotelData.hotelName
      },
      process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
      { expiresIn: '30d' }
    );

    // Log audit trail
    try {
      await logAudit(LOG_TYPES.HOTEL, 'hotel_registered', {
        hotelId,
        hotelName: hotelData.hotelName,
        contactEmail,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
    } catch (auditError) {
      console.warn('[Hotel Registration] Failed to log audit:', auditError);
      // Don't fail registration if audit logging fails
    }

    console.log(`[Hotel Registration] Success! Hotel ${hotelId} registered`);

    res.json({
      success: true,
      hotelToken,
      hotelId,
      hotelName: hotelData.hotelName,
      expiresIn: '30 days',
      trialEndsAt: hotelData.subscription.trialEndsAt
    });

  } catch (error) {
    console.error('[Hotel Registration] Error:', error);
    res.status(500).json({
      error: 'Registration failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Verify hotel token
 * POST /api/hotels/verify
 * Headers: Authorization: Bearer <hotelToken>
 * Returns: { valid: true, hotelId, hotelName }
 */
router.post('/verify', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-jwt-secret-change-in-production');

    if (decoded.type !== 'hotel') {
      return res.status(403).json({ error: 'Invalid token type' });
    }

    // Check if hotel still active
    const db = await getFirestore();
    const hotel = await db.collection('hotels').doc(decoded.hotelId).get();

    if (!hotel.exists) {
      return res.status(401).json({ error: 'Hotel not found' });
    }

    const hotelData = hotel.data();

    if (hotelData.status !== 'active') {
      return res.status(403).json({ error: 'Hotel account suspended' });
    }

    res.json({
      valid: true,
      hotelId: decoded.hotelId,
      hotelName: hotelData.hotelName,
      status: hotelData.status,
      subscription: hotelData.subscription
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.error('[Hotel Verify] Error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * Refresh hotel token
 * POST /api/hotels/refresh
 * Headers: Authorization: Bearer <old-token>
 * Returns: { success: true, hotelToken: newToken }
 */
router.post('/refresh', async (req, res) => {
  const oldToken = req.headers.authorization?.replace('Bearer ', '');

  if (!oldToken) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Verify old token (allow expired tokens for refresh within 7 days)
    const decoded = jwt.verify(
      oldToken,
      process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
      { ignoreExpiration: true }
    );

    if (decoded.type !== 'hotel') {
      return res.status(403).json({ error: 'Invalid token type' });
    }

    // Check expiration - only allow refresh within 7 days of expiry
    const now = Math.floor(Date.now() / 1000);
    const sevenDays = 7 * 24 * 60 * 60;

    if (decoded.exp && (now - decoded.exp) > sevenDays) {
      return res.status(401).json({
        error: 'Token too old to refresh, please re-register',
        code: 'TOKEN_TOO_OLD'
      });
    }

    // Check if hotel exists and active
    const db = await getFirestore();
    const hotel = await db.collection('hotels').doc(decoded.hotelId).get();

    if (!hotel.exists) {
      return res.status(401).json({ error: 'Hotel not found' });
    }

    const hotelData = hotel.data();

    if (hotelData.status !== 'active') {
      return res.status(403).json({ error: 'Hotel account suspended' });
    }

    // Generate new token
    const newToken = jwt.sign(
      {
        hotelId: decoded.hotelId,
        type: 'hotel',
        hotelName: hotelData.hotelName
      },
      process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
      { expiresIn: '30d' }
    );

    console.log(`[Hotel Refresh] Token refreshed for hotel: ${decoded.hotelId}`);

    res.json({
      success: true,
      hotelToken: newToken,
      expiresIn: '30 days'
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.error('[Hotel Refresh] Error:', error);
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

/**
 * Get hotel information
 * GET /api/hotels/me
 * Headers: Authorization: Bearer <hotelToken>
 * Returns: { hotel: { ...hotelData } }
 */
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-jwt-secret-change-in-production');

    if (decoded.type !== 'hotel') {
      return res.status(403).json({ error: 'Invalid token type' });
    }

    const db = await getFirestore();
    const hotel = await db.collection('hotels').doc(decoded.hotelId).get();

    if (!hotel.exists) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    const hotelData = hotel.data();

    // Don't expose secret name
    const safeHotelData = {
      hotelId: hotelData.hotelId,
      hotelName: hotelData.hotelName,
      contactEmail: hotelData.contactEmail,
      registeredAt: hotelData.registeredAt,
      status: hotelData.status,
      subscription: hotelData.subscription,
      limits: hotelData.limits,
      usage: hotelData.usage
    };

    res.json({
      hotel: safeHotelData
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.error('[Hotel Me] Error:', error);
    res.status(500).json({ error: 'Failed to fetch hotel information' });
  }
});

export default router;
