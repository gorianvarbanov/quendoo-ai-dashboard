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

  // Use namespace-based isolation: {hotelId}/documents/hotel_documents
  // Note: hotelId already contains 'hotel_' prefix from JWT token
  // This ensures complete data isolation between hotels at the database level
  return db.collection(hotelId).doc('documents').collection(COLLECTION_NAME);
}

/**
 * Create a new hotel document with vector embeddings in subcollection
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

    const document = {
      // Immutable fields
      hotelId, // CRITICAL: This field cannot be changed after creation
      fileName: documentData.fileName,
      fileType: documentData.fileType,
      documentType: documentData.documentType || DOCUMENT_TYPES.OTHER,

      // Storage information
      storageUrl: documentData.storageUrl,
      storagePath: documentData.storagePath,

      // Content metadata (full text stored in chunks subcollection)
      // NOTE: We don't store fullText in main document to avoid 1MB Firestore limit
      // Large documents (Excel files with lots of data) would exceed this limit
      // Full text can be reconstructed from chunks subcollection if needed
      chunksCount: documentData.embeddings?.length || 0,
      textPreview: documentData.fullText ? documentData.fullText.slice(0, 500) : '', // First 500 chars for preview

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

    // Add main document to Firestore
    const docRef = await collection.add(document);

    // Store chunks and embeddings in subcollection (no size limit)
    if (documentData.textChunks && documentData.embeddings) {
      const chunksCollection = docRef.collection('chunks');
      const batch = admin.firestore().batch();

      for (let i = 0; i < documentData.textChunks.length; i++) {
        const chunkRef = chunksCollection.doc(`chunk_${i}`);

        // Contextual enrichment: add surrounding context
        const prevChunk = i > 0 ? documentData.textChunks[i - 1].slice(-150) : '';
        const nextChunk = i < documentData.textChunks.length - 1 ? documentData.textChunks[i + 1].slice(0, 150) : '';

        // Extract heading if present (markdown ## or bold text)
        const heading = extractHeading(documentData.textChunks[i]);

        batch.set(chunkRef, {
          chunkIndex: i,
          text: documentData.textChunks[i],
          embedding: documentData.embeddings[i],
          // Contextual metadata
          position: i / documentData.textChunks.length, // Relative position (0-1)
          prevContext: prevChunk,
          nextContext: nextChunk,
          heading: heading,
          wordCount: documentData.textChunks[i].split(/\s+/).length,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      await batch.commit();
      console.log(`[HotelDocument] Created ${documentData.textChunks.length} chunks with context for document ${docRef.id}`);
    }

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
 * @param {boolean} includeFullText - Whether to reconstruct full text from chunks (default: true)
 * @returns {Promise<object|null>} - Document or null if not found
 */
export async function getDocumentById(hotelId, documentId, includeFullText = true) {
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

    const docData = doc.data();

    // If full text is needed, reconstruct it from chunks subcollection
    if (includeFullText) {
      const chunksSnapshot = await docRef.collection('chunks')
        .orderBy('chunkIndex', 'asc')
        .get();

      if (!chunksSnapshot.empty) {
        const fullText = chunksSnapshot.docs
          .map(chunkDoc => chunkDoc.data().text)
          .join('\n\n');

        docData.fullText = fullText;
      }
    }

    return {
      id: doc.id,
      ...docData
    };
  } catch (error) {
    console.error('[HotelDocument] Error getting document:', error);
    throw new Error(`Failed to get document: ${error.message}`);
  }
}

/**
 * Delete a document (and its chunks subcollection)
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

    // Delete all chunks in subcollection first
    const chunksCollection = docRef.collection('chunks');
    const chunksSnapshot = await chunksCollection.get();

    if (!chunksSnapshot.empty) {
      const batch = admin.firestore().batch();
      chunksSnapshot.docs.forEach(chunkDoc => {
        batch.delete(chunkDoc.ref);
      });
      await batch.commit();
      console.log(`[HotelDocument] Deleted ${chunksSnapshot.size} chunks for document ${documentId}`);
    }

    // Delete main document
    await docRef.delete();

    console.log(`[HotelDocument] Deleted document ${documentId} for hotel ${hotelId}`);

    return true;
  } catch (error) {
    console.error('[HotelDocument] Error deleting document:', error);
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

/**
 * Search documents using vector similarity (reads from chunks subcollection)
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

    // Fetch all documents
    const snapshot = await query.get();

    const results = [];

    // For each document, fetch chunks from subcollection and calculate similarity
    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Fetch chunks from subcollection
      const chunksSnapshot = await doc.ref.collection('chunks').get();

      chunksSnapshot.forEach(chunkDoc => {
        const chunkData = chunkDoc.data();
        const similarity = calculateCosineSimilarity(queryEmbedding, chunkData.embedding);

        results.push({
          id: doc.id,
          documentId: doc.id,
          fileName: data.fileName,
          documentType: data.documentType,
          chunkIndex: chunkData.chunkIndex,
          textChunk: chunkData.text,
          similarity,
          structuredData: data.structuredData,
          tags: data.tags
        });
      });
    }

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
 * Extract heading from chunk text (markdown headers or first line)
 * @param {string} text - Chunk text
 * @returns {string} - Extracted heading or empty string
 */
function extractHeading(text) {
  // Look for markdown headers (## Header)
  const markdownMatch = text.match(/^##\s+(.+)/m);
  if (markdownMatch) {
    return markdownMatch[1].trim();
  }

  // Look for first line if it's short (likely a heading)
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length > 0 && firstLine.length < 100 && !firstLine.endsWith('.')) {
    return firstLine;
  }

  return '';
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
