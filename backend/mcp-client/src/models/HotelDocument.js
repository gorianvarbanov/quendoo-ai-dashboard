/**
 * HotelDocument Model - Firestore document with vector embeddings
 * CRITICAL: Multi-tenant security with namespace isolation
 */

import admin from 'firebase-admin';

const COLLECTION_NAME = 'hotel_documents';

/**
 * Document type enumeration
 */
export const DOCUMENT_TYPES = {
  CONTRACT: 'contract',
  INVOICE: 'invoice',
  MENU: 'menu',
  POLICY: 'policy',
  PROCEDURE: 'procedure',
  MANUAL: 'manual',
  OTHER: 'other'
};

/**
 * Get Firestore collection reference for a specific hotel
 * SECURITY: Uses namespace isolation - hotel_{hotelId}
 * @param {string} hotelId - Hotel ID (from JWT token)
 * @returns {FirebaseFirestore.CollectionReference}
 */
function getHotelCollection(hotelId) {
  if (!hotelId) {
    throw new Error('Hotel ID is required for document operations');
  }

  const db = admin.firestore();

  // Use namespace-based isolation: hotel_{hotelId}.hotel_documents
  // This ensures complete data isolation between hotels at the database level
  return db.collection(`hotel_${hotelId}`).doc('documents').collection(COLLECTION_NAME);
}

/**
 * Create a new hotel document with vector embeddings
 * @param {string} hotelId - Hotel ID (immutable)
 * @param {object} documentData - Document data
 * @returns {Promise<object>} - Created document with ID
 */
export async function createDocument(hotelId, documentData) {
  try {
    // Validate required fields
    if (!hotelId) {
      throw new Error('Hotel ID is required');
    }
    if (!documentData.fileName) {
      throw new Error('File name is required');
    }
    if (!documentData.fileType) {
      throw new Error('File type is required');
    }
    if (!documentData.storageUrl) {
      throw new Error('Storage URL is required');
    }

    const collection = getHotelCollection(hotelId);

    // Prepare document with immutable hotelId
    // Note: We store embeddings as a base64 encoded JSON string to avoid Firestore nested array limitations
    const embeddingsString = documentData.embeddings
      ? Buffer.from(JSON.stringify(documentData.embeddings)).toString('base64')
      : '';

    const document = {
      // Immutable fields
      hotelId, // CRITICAL: This field cannot be changed after creation
      fileName: documentData.fileName,
      fileType: documentData.fileType,
      documentType: documentData.documentType || DOCUMENT_TYPES.OTHER,

      // Storage information
      storageUrl: documentData.storageUrl,
      storagePath: documentData.storagePath,

      // Content and metadata
      fullText: documentData.fullText || '',
      textChunks: documentData.textChunks || [],
      embeddingsEncoded: embeddingsString, // Base64 encoded JSON of embeddings array
      embeddingsCount: documentData.embeddings?.length || 0,

      // Structured data (extracted by AI)
      structuredData: documentData.structuredData || {},

      // Metadata
      fileSize: documentData.fileSize || 0,
      mimeType: documentData.mimeType || '',
      tags: documentData.tags || [],
      description: documentData.description || '',

      // Timestamps
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),

      // Search metadata
      searchableText: `${documentData.fileName} ${documentData.description || ''} ${documentData.tags?.join(' ') || ''}`.toLowerCase()
    };

    // Add document to Firestore
    const docRef = await collection.add(document);

    console.log(`[HotelDocument] Created document ${docRef.id} for hotel ${hotelId}`);

    return {
      id: docRef.id,
      ...document
    };
  } catch (error) {
    console.error('[HotelDocument] Error creating document:', error);
    throw new Error(`Failed to create document: ${error.message}`);
  }
}

/**
 * Get all documents for a hotel
 * @param {string} hotelId - Hotel ID (from JWT token)
 * @param {object} filters - Optional filters
 * @returns {Promise<object[]>} - Array of documents
 */
export async function getDocuments(hotelId, filters = {}) {
  try {
    if (!hotelId) {
      throw new Error('Hotel ID is required');
    }

    const collection = getHotelCollection(hotelId);
    let query = collection;

    // Apply filters
    if (filters.documentType) {
      query = query.where('documentType', '==', filters.documentType);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.where('tags', 'array-contains-any', filters.tags);
    }

    // Order by creation date (newest first)
    query = query.orderBy('createdAt', 'desc');

    // Apply limit if specified
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const snapshot = await query.get();

    const documents = [];
    snapshot.forEach(doc => {
      documents.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`[HotelDocument] Retrieved ${documents.length} documents for hotel ${hotelId}`);

    return documents;
  } catch (error) {
    console.error('[HotelDocument] Error getting documents:', error);
    throw new Error(`Failed to get documents: ${error.message}`);
  }
}

/**
 * Get a single document by ID
 * @param {string} hotelId - Hotel ID (from JWT token)
 * @param {string} documentId - Document ID
 * @returns {Promise<object|null>} - Document or null if not found
 */
export async function getDocumentById(hotelId, documentId) {
  try {
    if (!hotelId) {
      throw new Error('Hotel ID is required');
    }
    if (!documentId) {
      throw new Error('Document ID is required');
    }

    const collection = getHotelCollection(hotelId);
    const docRef = collection.doc(documentId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error('[HotelDocument] Error getting document:', error);
    throw new Error(`Failed to get document: ${error.message}`);
  }
}

/**
 * Delete a document (and its vector data)
 * @param {string} hotelId - Hotel ID (from JWT token)
 * @param {string} documentId - Document ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteDocument(hotelId, documentId) {
  try {
    if (!hotelId) {
      throw new Error('Hotel ID is required');
    }
    if (!documentId) {
      throw new Error('Document ID is required');
    }

    const collection = getHotelCollection(hotelId);
    const docRef = collection.doc(documentId);

    // Check if document exists
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error('Document not found');
    }

    // Verify hotelId matches (additional security check)
    const data = doc.data();
    if (data.hotelId !== hotelId) {
      throw new Error('Unauthorized: Document does not belong to this hotel');
    }

    // Delete document (this also deletes the vector embeddings stored in the document)
    await docRef.delete();

    console.log(`[HotelDocument] Deleted document ${documentId} for hotel ${hotelId}`);

    return true;
  } catch (error) {
    console.error('[HotelDocument] Error deleting document:', error);
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

/**
 * Search documents using vector similarity (Firestore vector search)
 * @param {string} hotelId - Hotel ID (from JWT token)
 * @param {number[]} queryEmbedding - Query embedding vector (768 dimensions)
 * @param {object} options - Search options
 * @returns {Promise<object[]>} - Array of matching documents with similarity scores
 */
export async function searchDocumentsByVector(hotelId, queryEmbedding, options = {}) {
  try {
    if (!hotelId) {
      throw new Error('Hotel ID is required');
    }
    if (!queryEmbedding || queryEmbedding.length !== 768) {
      throw new Error('Valid 768-dimensional query embedding is required');
    }

    const collection = getHotelCollection(hotelId);
    const limit = options.limit || 3;
    const documentTypes = options.documentTypes || [];

    // Build base query
    let query = collection;

    // Apply document type filter if specified
    if (documentTypes.length > 0) {
      query = query.where('documentType', 'in', documentTypes);
    }

    // IMPORTANT: Firestore vector search syntax
    // This requires a vector index to be created on the 'embeddings' field
    // The vector search will find the most similar documents based on cosine similarity

    // For now, we'll fetch all documents and calculate similarity manually
    // In production, use Firestore's native vector search once the index is created
    const snapshot = await query.get();

    const results = [];

    snapshot.forEach(doc => {
      const data = doc.data();

      // Decode embeddings from base64
      let embeddings = [];
      if (data.embeddingsEncoded) {
        try {
          const decodedString = Buffer.from(data.embeddingsEncoded, 'base64').toString('utf-8');
          embeddings = JSON.parse(decodedString);
        } catch (error) {
          console.error(`[HotelDocument] Failed to decode embeddings for doc ${doc.id}:`, error);
        }
      }

      // Calculate similarity for each chunk embedding
      if (embeddings && embeddings.length > 0) {
        embeddings.forEach((embedding, chunkIndex) => {
          const similarity = calculateCosineSimilarity(queryEmbedding, embedding);

          results.push({
            id: doc.id,
            documentId: doc.id,
            fileName: data.fileName,
            documentType: data.documentType,
            chunkIndex,
            textChunk: data.textChunks[chunkIndex],
            similarity,
            structuredData: data.structuredData,
            tags: data.tags
          });
        });
      }
    });

    // Sort by similarity (highest first) and limit results
    results.sort((a, b) => b.similarity - a.similarity);
    const topResults = results.slice(0, limit);

    console.log(`[HotelDocument] Vector search found ${topResults.length} results for hotel ${hotelId}`);

    return topResults;
  } catch (error) {
    console.error('[HotelDocument] Error searching documents:', error);
    throw new Error(`Failed to search documents: ${error.message}`);
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vec1 - First vector
 * @param {number[]} vec2 - Second vector
 * @returns {number} - Similarity score (-1 to 1)
 */
function calculateCosineSimilarity(vec1, vec2) {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

/**
 * Alias for getDocuments - for consistency with tool naming
 */
export const listDocumentsByHotel = getDocuments;

export default {
  DOCUMENT_TYPES,
  createDocument,
  getDocuments,
  listDocumentsByHotel,
  getDocumentById,
  deleteDocument,
  searchDocumentsByVector
};
