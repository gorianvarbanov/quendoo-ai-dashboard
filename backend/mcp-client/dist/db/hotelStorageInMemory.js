/**
 * In-Memory Hotel Storage for Development
 * Simulates Firestore without requiring Google Cloud credentials
 */

// In-memory storage
const hotels = new Map();
const apiKeys = new Map(); // Simulates Secret Manager

/**
 * Save hotel data
 */
export async function saveHotel(hotelId, hotelData) {
  hotels.set(hotelId, {
    ...hotelData,
    createdAt: hotelData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  console.log(`[InMemory Hotel Storage] Saved hotel: ${hotelId}`);
  return { success: true };
}

/**
 * Get hotel data
 */
export async function getHotel(hotelId) {
  const hotel = hotels.get(hotelId);
  if (!hotel) {
    return { exists: false };
  }
  return {
    exists: true,
    data: () => hotel
  };
}

/**
 * Update hotel data
 */
export async function updateHotel(hotelId, updates) {
  const hotel = hotels.get(hotelId);
  if (!hotel) {
    throw new Error('Hotel not found');
  }

  const updatedHotel = {
    ...hotel,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  hotels.set(hotelId, updatedHotel);
  console.log(`[InMemory Hotel Storage] Updated hotel: ${hotelId}`);
  return { success: true };
}

/**
 * Save API key (simulates Secret Manager)
 */
export async function saveApiKey(secretName, apiKey) {
  apiKeys.set(secretName, apiKey);
  console.log(`[InMemory Secret Storage] Saved secret: ${secretName}`);
  return { success: true };
}

/**
 * Get API key (simulates Secret Manager)
 */
export async function getApiKey(secretName) {
  const apiKey = apiKeys.get(secretName);
  if (!apiKey) {
    throw new Error(`Secret not found: ${secretName}`);
  }
  return apiKey;
}

/**
 * Increment hotel usage
 */
export async function incrementHotelUsage(hotelId, type) {
  const hotel = hotels.get(hotelId);
  if (!hotel) {
    throw new Error('Hotel not found');
  }

  const now = new Date();
  const lastReset = new Date(hotel.usage?.lastResetAt || now);
  const monthsSinceReset = (now.getFullYear() - lastReset.getFullYear()) * 12 +
                            (now.getMonth() - lastReset.getMonth());

  if (monthsSinceReset >= 1) {
    // Reset monthly counter
    hotel.usage = {
      messagesThisMonth: type === 'message' ? 1 : 0,
      conversations: hotel.usage?.conversations || 0,
      lastResetAt: now.toISOString()
    };
  } else {
    // Increment counter
    if (!hotel.usage) {
      hotel.usage = {
        messagesThisMonth: 0,
        conversations: 0,
        lastResetAt: now.toISOString()
      };
    }

    if (type === 'message') {
      hotel.usage.messagesThisMonth++;
    } else if (type === 'conversation') {
      hotel.usage.conversations++;
    }
  }

  hotel.updatedAt = now.toISOString();
  hotels.set(hotelId, hotel);

  console.log(`[InMemory Hotel Storage] Incremented ${type} for hotel ${hotelId}: `, hotel.usage);
  return { success: true };
}

/**
 * Get all hotels (for debugging)
 */
export function getAllHotels() {
  return Array.from(hotels.entries()).map(([hotelId, data]) => ({
    hotelId,
    ...data
  }));
}

/**
 * Clear all data (for testing)
 */
export function clearAll() {
  hotels.clear();
  apiKeys.clear();
  console.log('[InMemory Hotel Storage] Cleared all data');
}

export default {
  saveHotel,
  getHotel,
  updateHotel,
  saveApiKey,
  getApiKey,
  incrementHotelUsage,
  getAllHotels,
  clearAll
};
