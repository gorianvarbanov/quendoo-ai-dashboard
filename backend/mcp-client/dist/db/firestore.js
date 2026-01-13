/**
 * Firestore Database Integration
 * Provides database connection and base operations for Cloud Firestore
 */
import admin from 'firebase-admin';

let db = null;
let initialized = false;

/**
 * Initialize Firestore connection
 */
export async function initializeFirestore() {
  if (initialized) {
    return db;
  }

  try {
    // Initialize Firebase Admin SDK
    // In Cloud Run, it will automatically use the service account
    // For local development, set GOOGLE_APPLICATION_CREDENTIALS env variable
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: process.env.GOOGLE_CLOUD_PROJECT || 'quendoo-ai-dashboard'
      });
    }

    db = admin.firestore();

    // Configure Firestore settings
    db.settings({
      ignoreUndefinedProperties: true,
      timestampsInSnapshots: true
    });

    initialized = true;
    console.log('[Firestore] Successfully initialized');

    return db;
  } catch (error) {
    console.error('[Firestore] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Get Firestore instance (ensures initialization)
 */
export async function getFirestore() {
  if (!db) {
    await initializeFirestore();
  }
  return db;
}

/**
 * Collection names (centralized for consistency)
 */
export const COLLECTIONS = {
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  USERS: 'users',
  SETTINGS: 'settings',
  AUDIT_LOGS: 'auditLogs',
  SESSIONS: 'sessions'
};

/**
 * Helper to get a collection reference
 */
export async function getCollection(collectionName) {
  const firestore = await getFirestore();
  return firestore.collection(collectionName);
}

/**
 * Helper to get a document reference
 */
export async function getDocument(collectionName, documentId) {
  const collection = await getCollection(collectionName);
  return collection.doc(documentId);
}

/**
 * Health check for Firestore connection
 */
export async function checkFirestoreHealth() {
  try {
    const firestore = await getFirestore();
    // Try to read from settings collection as a health check
    const settingsRef = firestore.collection(COLLECTIONS.SETTINGS).limit(1);
    await settingsRef.get();
    return { healthy: true, message: 'Firestore connection OK' };
  } catch (error) {
    return { healthy: false, message: error.message };
  }
}

export default {
  initializeFirestore,
  getFirestore,
  getCollection,
  getDocument,
  checkFirestoreHealth,
  COLLECTIONS
};
