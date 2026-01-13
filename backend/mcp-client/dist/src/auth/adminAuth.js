/**
 * Admin Authentication Module
 * Handles admin login, JWT generation, and credential verification
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { getSecret, createOrUpdateSecret, isSecretConfigured, SECRET_NAMES } from '../secretManager.js';

// Load environment variables first
dotenv.config();

class AdminAuth {
  constructor() {
    // Get credentials from environment variables (fallback)
    this.adminUsername = process.env.ADMIN_USERNAME || 'admin';
    this.adminPassword = process.env.ADMIN_PASSWORD;
    this.jwtSecret = process.env.JWT_SECRET || this.generateDefaultSecret();
    this.jwtExpiration = '24h'; // Token expires in 24 hours
    this.initialized = false;

    // Initialize async (will load from Secret Manager)
    this.initialize().catch(err => {
      console.error('[Auth] Failed to initialize:', err);
    });
  }

  /**
   * Initialize authentication - load credentials from Secret Manager
   */
  async initialize() {
    try {
      // Try to load password from Secret Manager
      const passwordConfigured = await isSecretConfigured(SECRET_NAMES.ADMIN_PASSWORD);
      if (passwordConfigured) {
        this.adminPassword = await getSecret(SECRET_NAMES.ADMIN_PASSWORD);
        console.log('[Auth] Loaded admin password from Secret Manager');
      } else if (!this.adminPassword) {
        console.warn('[Auth] WARNING: No password in Secret Manager or environment. Using default.');
        this.adminPassword = 'change-this-password';
      }

      this.initialized = true;
      console.log('[Auth] Admin authentication initialized');
      console.log(`[Auth] Admin username: ${this.adminUsername}`);
      console.log(`[Auth] Admin password loaded: ***${this.adminPassword?.slice(-3)}`);
    } catch (error) {
      console.warn('[Auth] Could not load from Secret Manager, using environment variables:', error.message);
      if (!this.adminPassword) {
        console.warn('[Auth] WARNING: ADMIN_PASSWORD not set. Using insecure default.');
        this.adminPassword = 'change-this-password';
      }
      this.initialized = true;
    }
  }

  /**
   * Ensure authentication is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Generate a random JWT secret if not provided
   */
  generateDefaultSecret() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Verify admin credentials
   * @param {string} username
   * @param {string} password
   * @returns {boolean}
   */
  verifyCredentials(username, password) {
    // Simple comparison for single admin account
    // TODO: In production, use bcrypt for password hashing
    console.log(`[Auth] Verifying: provided="${username}" vs stored="${this.adminUsername}"`);
    console.log(`[Auth] Password match: ${password === this.adminPassword} (provided length: ${password?.length}, stored length: ${this.adminPassword?.length})`);
    return username === this.adminUsername && password === this.adminPassword;
  }

  /**
   * Generate JWT token for authenticated admin
   * @param {string} username
   * @returns {string} JWT token
   */
  generateToken(username) {
    const payload = {
      username,
      role: 'admin',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiration
    });
  }

  /**
   * Verify JWT token
   * @param {string} token
   * @returns {object|null} Decoded token payload or null if invalid
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return decoded;
    } catch (error) {
      console.error('[Auth] Token verification failed:', error.message);
      return null;
    }
  }

  /**
   * Handle login request
   * @param {string} username
   * @param {string} password
   * @returns {object} Login response with token or error
   */
  login(username, password) {
    console.log(`[Auth] Login attempt for username: ${username}`);

    if (!username || !password) {
      return {
        success: false,
        error: 'Username and password are required'
      };
    }

    if (this.verifyCredentials(username, password)) {
      const token = this.generateToken(username);
      console.log(`[Auth] Login successful for: ${username}`);

      return {
        success: true,
        token,
        user: {
          username,
          role: 'admin'
        },
        expiresIn: this.jwtExpiration
      };
    }

    console.log(`[Auth] Login failed for: ${username} - Invalid credentials`);
    return {
      success: false,
      error: 'Invalid username or password'
    };
  }

  /**
   * Verify authentication status
   * @param {string} token
   * @returns {object} Verification response
   */
  verify(token) {
    if (!token) {
      return {
        authenticated: false,
        error: 'No token provided'
      };
    }

    const decoded = this.verifyToken(token);

    if (decoded) {
      return {
        authenticated: true,
        user: {
          username: decoded.username,
          role: decoded.role
        }
      };
    }

    return {
      authenticated: false,
      error: 'Invalid or expired token'
    };
  }

  /**
   * Change admin password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<object>} Change password response
   */
  async changePassword(currentPassword, newPassword) {
    await this.ensureInitialized();

    console.log('[Auth] Password change attempt');

    // Verify current password
    if (currentPassword !== this.adminPassword) {
      console.log('[Auth] Password change failed: incorrect current password');
      return {
        success: false,
        error: 'Current password is incorrect'
      };
    }

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      return {
        success: false,
        error: 'New password must be at least 8 characters long'
      };
    }

    if (newPassword === currentPassword) {
      return {
        success: false,
        error: 'New password must be different from current password'
      };
    }

    try {
      // Store new password in Secret Manager
      await createOrUpdateSecret(SECRET_NAMES.ADMIN_PASSWORD, newPassword);

      // Update in-memory password
      this.adminPassword = newPassword;

      console.log('[Auth] Password changed successfully');
      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      console.error('[Auth] Failed to change password:', error);
      return {
        success: false,
        error: 'Failed to update password: ' + error.message
      };
    }
  }
}

// Export singleton instance
export default new AdminAuth();
