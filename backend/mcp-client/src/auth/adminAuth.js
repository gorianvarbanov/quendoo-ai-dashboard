/**
 * Admin Authentication Module
 * Handles admin login, JWT generation, and credential verification
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

class AdminAuth {
  constructor() {
    // Get credentials from environment variables
    this.adminUsername = process.env.ADMIN_USERNAME || 'admin';
    this.adminPassword = process.env.ADMIN_PASSWORD;
    this.jwtSecret = process.env.JWT_SECRET || this.generateDefaultSecret();
    this.jwtExpiration = '24h'; // Token expires in 24 hours

    // Warn if using default credentials
    if (!process.env.ADMIN_PASSWORD) {
      console.warn('[Auth] WARNING: ADMIN_PASSWORD not set in environment variables. Using insecure default.');
      this.adminPassword = 'change-this-password'; // Insecure default
    }

    if (!process.env.JWT_SECRET) {
      console.warn('[Auth] WARNING: JWT_SECRET not set in environment variables. Generated random secret.');
    }

    console.log('[Auth] Admin authentication initialized');
    console.log(`[Auth] Admin username: ${this.adminUsername}`);
    console.log(`[Auth] Admin password loaded: ${this.adminPassword ? '***' + this.adminPassword.slice(-4) : 'NOT SET'}`);
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
}

// Export singleton instance
export default new AdminAuth();
