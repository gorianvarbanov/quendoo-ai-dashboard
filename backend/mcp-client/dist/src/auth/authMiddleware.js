/**
 * Authentication Middleware
 * Protects routes requiring admin authentication
 */

import adminAuth from './adminAuth.js';

/**
 * Middleware to verify JWT token from request headers
 * Expects token in Authorization header: "Bearer <token>"
 */
export const requireAuth = (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No authorization header provided'
      });
    }

    // Check for Bearer token format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Invalid authorization header format. Expected: Bearer <token>'
      });
    }

    const token = parts[1];

    // Verify token
    const verification = adminAuth.verify(token);

    if (!verification.authenticated) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: verification.error || 'Invalid or expired token'
      });
    }

    // Attach user info to request for downstream use
    req.user = verification.user;

    // Proceed to next middleware/route handler
    next();
  } catch (error) {
    console.error('[Auth Middleware] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication check failed'
    });
  }
};

/**
 * Optional auth middleware - doesn't block if no token
 * Attaches user info if valid token present
 */
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const verification = adminAuth.verify(token);

        if (verification.authenticated) {
          req.user = verification.user;
        }
      }
    }

    next();
  } catch (error) {
    console.error('[Auth Middleware] Optional auth error:', error);
    next(); // Continue even on error for optional auth
  }
};

/**
 * Role-based access control middleware
 * Requires specific role (admin, user, etc.)
 */
export const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No user information found'
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires ${role} role`
      });
    }

    next();
  };
};
