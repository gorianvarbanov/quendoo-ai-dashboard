/**
 * Hash Utilities
 * Helper functions for hashing sensitive data
 */
import crypto from 'crypto';

/**
 * Create a SHA256 hash of a string
 * @param {string} input - String to hash
 * @returns {string} Hex-encoded hash (64 characters)
 */
export function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Create a hotel ID from Quendoo API key
 * Uses the API key to generate a consistent, unique identifier
 * @param {string} quendooApiKey - Quendoo API key
 * @returns {string} Hotel ID (format: hotel_XXXXXX)
 */
export function createHotelId(quendooApiKey) {
  if (!quendooApiKey || quendooApiKey.trim() === '') {
    return 'hotel_default';
  }
  const hash = sha256(quendooApiKey).substring(0, 12);
  return `hotel_${hash}`;
}

export default {
  sha256,
  createHotelId
};
