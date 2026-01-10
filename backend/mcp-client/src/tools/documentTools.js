/**
 * Document Search MCP Tool
 * Allows Claude to semantically search hotel documents using RAG
 */

import { searchDocumentsByVector, listDocumentsByHotel } from '../models/HotelDocument.js';
import { generateEmbedding } from '../services/embeddingService.js';
import { expandQuery, calculateBoost, extractKeyPhrases } from '../services/queryExpansionService.js';
import { performHybridSearch, extractKeywords } from '../services/hybridSearchService.js';

/**
 * Search hotel documents using semantic search
 * This tool is called by Claude when it needs to find information from uploaded documents
 *
 * @param {object} params - Search parameters
 * @param {string} params.query - Natural language search query
 * @param {string[]} params.documentTypes - Optional document type filters
 * @param {number} params.topK - Number of results to return (1-10, default 3)
 * @param {string} hotelId - Hotel ID from JWT token
 * @returns {Promise<object>} - Search results with relevant document excerpts
 */
export async function searchHotelDocuments(params, hotelId) {
  try {
    console.log('[DocumentTools] Searching documents:', {
      hotelId,
      query: params.query,
      documentTypes: params.documentTypes,
      topK: params.topK
    });

    // Validate parameters
    if (!params.query || typeof params.query !== 'string') {
      return {
        success: false,
        error: 'Query parameter is required and must be a string'
      };
    }

    if (!hotelId) {
      return {
        success: false,
        error: 'Hotel ID is required (must be authenticated)'
      };
    }

    const topK = Math.min(Math.max(params.topK || 3, 1), 10); // Limit between 1 and 10

    // Step 1: Query Expansion
    console.log('[DocumentTools] Expanding query...');
    const queryExpansion = expandQuery(params.query, {
      maxSynonyms: 3,
      includeOriginal: true,
      languageMix: true
    });

    console.log('[DocumentTools] Query expansion:', {
      original: queryExpansion.original,
      expanded: queryExpansion.expanded,
      hasExpansion: queryExpansion.hasExpansion
    });

    // Step 2: Extract keywords and phrases for hybrid search
    const keywords = extractKeywords(params.query);
    const phrases = extractKeyPhrases(params.query);

    console.log('[DocumentTools] Extracted keywords:', keywords);
    console.log('[DocumentTools] Extracted phrases:', phrases);

    // Step 3: Generate embedding for semantic search
    const queryText = queryExpansion.hasExpansion ? queryExpansion.expanded : params.query;
    console.log('[DocumentTools] Generating query embedding...');
    const queryEmbedding = await generateEmbedding(queryText);

    // Step 4: Perform semantic (vector) search
    console.log('[DocumentTools] Performing semantic search...');
    let results = await searchDocumentsByVector(hotelId, queryEmbedding, {
      limit: topK * 3, // Get more results for hybrid reranking
      documentTypes: params.documentTypes || []
    });

    // Step 5: Hybrid reranking (combine semantic + keyword scores)
    console.log('[DocumentTools] Applying hybrid reranking...');
    results = performHybridSearch(
      results, // All chunks with text
      keywords,
      phrases,
      results  // Semantic results
    );

    // Step 6: Apply boost based on important terms
    if (queryExpansion.importantTerms && queryExpansion.importantTerms.length > 0) {
      console.log('[DocumentTools] Applying importance boost...');
      results = results.map(result => ({
        ...result,
        similarity: result.similarity * calculateBoost(result.textChunk, queryExpansion.importantTerms)
      }));

      // Re-sort by final boosted scores
      results.sort((a, b) => b.similarity - a.similarity);
    }

    // Step 7: Limit to requested topK after all reranking
    results = results.slice(0, topK);

    // Format results for Claude with contextual information
    const formattedResults = results.map((result, index) => ({
      rank: index + 1,
      fileName: result.fileName,
      documentType: result.documentType,
      relevanceScore: Math.round(result.similarity * 100) / 100,
      excerpt: result.textChunk.substring(0, 500) + (result.textChunk.length > 500 ? '...' : ''),
      fullText: result.textChunk,
      // Hybrid search scores (for debugging/transparency)
      semanticScore: result.originalSemanticScore ? Math.round(result.originalSemanticScore * 100) / 100 : null,
      keywordScore: result.keywordScore ? Math.round(result.keywordScore * 100) / 100 : null,
      hybridScore: result.hybridScore ? Math.round(result.hybridScore * 100) / 100 : null,
      // Contextual metadata (if available)
      heading: result.heading || null,
      position: result.position ? Math.round(result.position * 100) + '%' : null,
      // Structured data and tags
      structuredData: result.structuredData,
      tags: result.tags
    }));

    console.log(`[DocumentTools] Found ${formattedResults.length} relevant documents`);

    // Return results in a format Claude can easily work with
    return {
      success: true,
      query: params.query,
      resultsCount: formattedResults.length,
      results: formattedResults,
      summary: generateSearchSummary(formattedResults)
    };
  } catch (error) {
    console.error('[DocumentTools] Error searching documents:', error);
    return {
      success: false,
      error: error.message || 'Failed to search documents'
    };
  }
}

/**
 * Generate a summary of search results for Claude
 * @param {object[]} results - Search results
 * @returns {string} - Summary text
 */
function generateSearchSummary(results) {
  if (results.length === 0) {
    return 'No relevant documents found for this query.';
  }

  const documentTypes = [...new Set(results.map(r => r.documentType))];
  const fileNames = [...new Set(results.map(r => r.fileName))];

  let summary = `Found ${results.length} relevant excerpt(s) from ${fileNames.length} document(s).\n`;
  summary += `Document types: ${documentTypes.join(', ')}.\n`;
  summary += `Top result: "${results[0].fileName}" with ${Math.round(results[0].relevanceScore * 100)}% relevance.`;

  return summary;
}

/**
 * Tool definition for MCP protocol
 * This defines the tool's interface for Claude
 */
export const searchHotelDocumentsTool = {
  name: 'search_hotel_documents',
  description: `Search through hotel documents using semantic search to find relevant information.

Use this tool when you need to:
- Find information from uploaded contracts, invoices, menus, policies, procedures, or manuals
- Answer questions about hotel documentation
- Retrieve specific clauses, terms, or data from documents
- Compare information across multiple documents

The search uses AI embeddings to understand the semantic meaning of your query, so you can search naturally (e.g., "What are the cancellation terms?" or "Find pricing for catering services").`,

  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query. Be specific about what information you are looking for.',
        minLength: 1
      },
      documentTypes: {
        type: 'array',
        description: 'Optional filter by document types. Available types: contract, invoice, menu, policy, procedure, manual, other.',
        items: {
          type: 'string',
          enum: ['contract', 'invoice', 'menu', 'policy', 'procedure', 'manual', 'other']
        },
        default: []
      },
      topK: {
        type: 'number',
        description: 'Number of results to return (1-10). Default is 3.',
        minimum: 1,
        maximum: 10,
        default: 3
      }
    },
    required: ['query']
  }
};

/**
 * List all hotel documents
 * This tool is called by Claude when it needs to show what documents are available
 *
 * @param {object} params - List parameters
 * @param {string[]} params.documentTypes - Optional document type filters
 * @param {string} hotelId - Hotel ID from JWT token
 * @returns {Promise<object>} - List of documents
 */
export async function listHotelDocuments(params, hotelId) {
  try {
    console.log('[DocumentTools] Listing documents:', {
      hotelId,
      documentTypes: params?.documentTypes
    });

    if (!hotelId) {
      return {
        success: false,
        error: 'Hotel ID is required (must be authenticated)'
      };
    }

    // Get documents from Firestore
    const documents = await listDocumentsByHotel(hotelId, {
      documentTypes: params?.documentTypes || []
    });

    // Format results for Claude
    const formattedDocuments = documents.map(doc => {
      // Format upload date
      let uploadDate = 'N/A';
      if (doc.createdAt) {
        try {
          uploadDate = doc.createdAt.toDate ? doc.createdAt.toDate().toLocaleDateString('bg-BG') : new Date(doc.createdAt).toLocaleDateString('bg-BG');
        } catch (e) {
          uploadDate = 'N/A';
        }
      }

      // Format file size
      let fileSizeFormatted = 'N/A';
      if (doc.fileSize) {
        const mb = doc.fileSize / (1024 * 1024);
        fileSizeFormatted = mb >= 1 ? `${mb.toFixed(2)} MB` : `${(doc.fileSize / 1024).toFixed(2)} KB`;
      }

      return {
        fileName: doc.fileName,
        documentType: doc.documentType,
        description: doc.description || '',
        tags: doc.tags || [],
        uploadedAt: uploadDate,
        fileSize: fileSizeFormatted
      };
    });

    console.log(`[DocumentTools] Found ${formattedDocuments.length} documents`);

    return {
      success: true,
      count: formattedDocuments.length,
      documents: formattedDocuments
    };
  } catch (error) {
    console.error('[DocumentTools] Error listing documents:', error);
    return {
      success: false,
      error: error.message || 'Failed to list documents'
    };
  }
}

/**
 * Tool definition for MCP protocol - List Documents
 */
export const listHotelDocumentsTool = {
  name: 'list_hotel_documents',
  description: `List all uploaded hotel documents.

Use this tool when you need to:
- Show what documents are available
- List documents by type
- Check if specific documents have been uploaded

Returns a list of all documents with their names, types, descriptions, and metadata.`,

  inputSchema: {
    type: 'object',
    properties: {
      documentTypes: {
        type: 'array',
        description: 'Optional filter by document types. Available types: contract, invoice, menu, policy, procedure, manual, other.',
        items: {
          type: 'string',
          enum: ['contract', 'invoice', 'menu', 'policy', 'procedure', 'manual', 'other']
        },
        default: []
      }
    },
    required: []
  }
};

export default {
  searchHotelDocuments,
  searchHotelDocumentsTool,
  listHotelDocuments,
  listHotelDocumentsTool
};
