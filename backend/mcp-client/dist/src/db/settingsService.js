/**
 * Settings Service
 * Handles database operations for application settings
 */
import { getFirestore, COLLECTIONS } from './firestore.js';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Get system settings
 */
export async function getSettings(settingsId = 'system') {
  try {
    const db = await getFirestore();
    const docRef = db.collection(COLLECTIONS.SETTINGS).doc(settingsId);
    const doc = await docRef.get();

    if (!doc.exists) {
      // Return default settings if not found
      return getDefaultSettings();
    }

    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error('[SettingsService] Error getting settings:', error);
    throw error;
  }
}

/**
 * Update system settings
 */
export async function updateSettings(settings, settingsId = 'system') {
  try {
    const db = await getFirestore();
    const docRef = db.collection(COLLECTIONS.SETTINGS).doc(settingsId);

    await docRef.set({
      ...settings,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error('[SettingsService] Error updating settings:', error);
    throw error;
  }
}

/**
 * Get default settings
 */
function getDefaultSettings() {
  return {
    mcpClientUrl: 'https://quendoo-backend-222402522800.us-central1.run.app',
    mcpServerUrl: 'https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse',
    theme: 'light',
    autoScroll: true,
    notifications: true,
    model: 'claude-sonnet-4-5-20250929'
  };
}

/**
 * Get user-specific settings
 */
export async function getUserSettings(userId) {
  try {
    const db = await getFirestore();
    const docRef = db.collection(COLLECTIONS.SETTINGS).doc(`user_${userId}`);
    const doc = await docRef.get();

    if (!doc.exists) {
      return getDefaultSettings();
    }

    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error('[SettingsService] Error getting user settings:', error);
    throw error;
  }
}

/**
 * Update user-specific settings
 */
export async function updateUserSettings(userId, settings) {
  try {
    const db = await getFirestore();
    const docRef = db.collection(COLLECTIONS.SETTINGS).doc(`user_${userId}`);

    await docRef.set({
      userId,
      ...settings,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error('[SettingsService] Error updating user settings:', error);
    throw error;
  }
}

export default {
  getSettings,
  updateSettings,
  getUserSettings,
  updateUserSettings,
  getDefaultSettings
};
