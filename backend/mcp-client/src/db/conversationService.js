/**
 * Conversation Service
 * Handles all database operations for conversations and messages
 */
import { getFirestore, COLLECTIONS } from './firestore.js';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Create a new conversation
 */
export async function createConversation(userId = 'default', metadata = {}) {
  try {
    const db = await getFirestore();
    const conversationsRef = db.collection(COLLECTIONS.CONVERSATIONS);

    const conversationData = {
      userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      messageCount: 0,
      title: metadata.title || 'New Conversation',
      metadata: metadata || {}
    };

    const docRef = await conversationsRef.add(conversationData);

    return {
      id: docRef.id,
      ...conversationData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  } catch (error) {
    console.error('[ConversationService] Error creating conversation:', error);
    throw error;
  }
}

/**
 * Get a conversation by ID
 */
export async function getConversation(conversationId) {
  try {
    const db = await getFirestore();
    const docRef = db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error('[ConversationService] Error getting conversation:', error);
    throw error;
  }
}

/**
 * Get all conversations for a user
 */
export async function getConversations(userId = 'default', limit = 50) {
  try {
    const db = await getFirestore();
    const conversationsRef = db.collection(COLLECTIONS.CONVERSATIONS);

    const snapshot = await conversationsRef
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('[ConversationService] Error getting conversations:', error);
    throw error;
  }
}

/**
 * Update conversation metadata
 */
export async function updateConversation(conversationId, updates) {
  try {
    const db = await getFirestore();
    const docRef = db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId);

    await docRef.update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('[ConversationService] Error updating conversation:', error);
    throw error;
  }
}

/**
 * Delete a conversation (and all its messages)
 */
export async function deleteConversation(conversationId) {
  try {
    const db = await getFirestore();

    // Delete all messages in the conversation
    const messagesRef = db.collection(COLLECTIONS.MESSAGES);
    const messagesSnapshot = await messagesRef
      .where('conversationId', '==', conversationId)
      .get();

    const batch = db.batch();

    // Delete messages
    messagesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete conversation
    const conversationRef = db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId);
    batch.delete(conversationRef);

    await batch.commit();

    return { success: true };
  } catch (error) {
    console.error('[ConversationService] Error deleting conversation:', error);
    throw error;
  }
}

/**
 * Add a message to a conversation
 */
export async function addMessage(conversationId, role, content, metadata = {}) {
  try {
    const db = await getFirestore();
    const messagesRef = db.collection(COLLECTIONS.MESSAGES);

    const messageData = {
      conversationId,
      role, // 'user' or 'assistant'
      content,
      metadata,
      createdAt: FieldValue.serverTimestamp()
    };

    const docRef = await messagesRef.add(messageData);

    // Update conversation's message count and updatedAt
    const conversationRef = db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId);
    await conversationRef.update({
      messageCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    });

    return {
      id: docRef.id,
      ...messageData,
      createdAt: new Date()
    };
  } catch (error) {
    console.error('[ConversationService] Error adding message:', error);
    throw error;
  }
}

/**
 * Get all messages in a conversation
 */
export async function getMessages(conversationId, limit = 100) {
  try {
    const db = await getFirestore();
    const messagesRef = db.collection(COLLECTIONS.MESSAGES);

    const snapshot = await messagesRef
      .where('conversationId', '==', conversationId)
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('[ConversationService] Error getting messages:', error);
    throw error;
  }
}

/**
 * Get conversation with messages
 */
export async function getConversationWithMessages(conversationId) {
  try {
    const conversation = await getConversation(conversationId);
    if (!conversation) {
      return null;
    }

    const messages = await getMessages(conversationId);

    return {
      ...conversation,
      messages
    };
  } catch (error) {
    console.error('[ConversationService] Error getting conversation with messages:', error);
    throw error;
  }
}

/**
 * Search conversations by title or content
 */
export async function searchConversations(userId, searchTerm, limit = 20) {
  try {
    const db = await getFirestore();
    const conversationsRef = db.collection(COLLECTIONS.CONVERSATIONS);

    // Note: Firestore doesn't support full-text search natively
    // This is a simple prefix search on title
    // For production, consider using Algolia or Cloud Search for full-text search

    const snapshot = await conversationsRef
      .where('userId', '==', userId)
      .where('title', '>=', searchTerm)
      .where('title', '<=', searchTerm + '\uf8ff')
      .orderBy('title')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('[ConversationService] Error searching conversations:', error);
    throw error;
  }
}

export default {
  createConversation,
  getConversation,
  getConversations,
  updateConversation,
  deleteConversation,
  addMessage,
  getMessages,
  getConversationWithMessages,
  searchConversations
};
