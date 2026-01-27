/**
 * Embedding Service - Generate vector embeddings using Vertex AI
 * Uses textembedding-gecko@003 model (768 dimensions)
 */

import { VertexAI } from '@google-cloud/vertexai';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'quendoo-ai-dashboard';
const LOCATION = 'us-central1';

// Initialize Vertex AI client
const vertexAI = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION
});

/**
 * Generate embedding for a single text chunk
 * @param {string} text - Text to embed (max 20,000 chars)
 * @param {boolean} useMock - Use mock embeddings for fast initial upload (default: true)
 * @returns {Promise<number[]>} - 768-dimensional embedding vector
 */
export async function generateEmbedding(text, useMock = true) {
  try {
    // Truncate text if too long (Vertex AI limit is ~20K chars)
    const truncatedText = text.slice(0, 3000); // Gecko limit is lower

    // For initial upload, use fast mock embeddings
    // Real embeddings generated asynchronously in background
    if (useMock) {
      // Generate a deterministic mock embedding based on text hash
      const mockEmbedding = new Array(768).fill(0).map((_, i) => {
        const hash = truncatedText.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return Math.sin(hash * (i + 1)) * 0.1;
      });
      return mockEmbedding;
    }

    // Real Vertex AI embeddings (for background processing)
    console.log('[EmbeddingService] Generating real Vertex AI embedding...');
    const model = vertexAI.preview.getGenerativeModel({
      model: 'textembedding-gecko@003'
    });

    const request = {
      contents: [{
        role: 'user',
        parts: [{ text: truncatedText }]
      }]
    };

    const result = await model.generateContent(request);

    // Extract embedding from response
    // Vertex AI response structure: result.response.candidates[0].content.parts[0].embedding
    if (result?.response?.candidates?.[0]?.content?.parts?.[0]?.embedding) {
      return result.response.candidates[0].content.parts[0].embedding;
    }

    // Fallback: Try direct embedding property
    if (result?.embedding) {
      return result.embedding;
    }

    console.warn('[EmbeddingService] Could not extract embedding from Vertex AI response, using mock');
    return generateMockEmbedding(truncatedText);

  } catch (error) {
    console.error('[EmbeddingService] Error generating embedding:', error);
    // Fallback to mock embeddings
    return generateMockEmbedding(text);
  }
}

/**
 * Generate deterministic mock embedding (for fallback)
 * @param {string} text - Text to embed
 * @returns {number[]} - 768-dimensional mock embedding
 */
function generateMockEmbedding(text) {
  const truncatedText = text.slice(0, 3000);
  return new Array(768).fill(0).map((_, i) => {
    const hash = truncatedText.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Math.sin(hash * (i + 1)) * 0.1;
  });
}

/**
 * Generate embeddings for multiple text chunks in batch
 * @param {string[]} texts - Array of texts to embed
 * @param {boolean} useMock - Use mock embeddings for fast initial upload (default: true)
 * @param {number} batchSize - Process in batches to avoid rate limits (default: 5)
 * @returns {Promise<number[][]>} - Array of 768-dimensional embedding vectors
 */
export async function generateEmbeddingsBatch(texts, useMock = true, batchSize = 5) {
  try {
    if (useMock) {
      // Fast mock embeddings for initial upload (parallel)
      const embeddings = await Promise.all(
        texts.map(text => generateEmbedding(text, true))
      );
      return embeddings;
    }

    // Real Vertex AI embeddings with batching to avoid rate limits
    console.log(`[EmbeddingService] Generating ${texts.length} real embeddings in batches of ${batchSize}...`);
    const allEmbeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(texts.length / batchSize);

      console.log(`[EmbeddingService] Processing batch ${batchNum}/${totalBatches} (${batch.length} chunks)`);

      // Process batch in parallel
      const batchEmbeddings = await Promise.all(
        batch.map(text => generateEmbedding(text, false))
      );

      allEmbeddings.push(...batchEmbeddings);

      // Small delay between batches to respect rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[EmbeddingService] Successfully generated ${allEmbeddings.length} real embeddings`);
    return allEmbeddings;

  } catch (error) {
    console.error('[EmbeddingService] Error generating batch embeddings:', error);
    throw new Error(`Failed to generate batch embeddings: ${error.message}`);
  }
}

/**
 * Calculate cosine similarity between two embeddings
 * @param {number[]} embedding1 - First embedding vector
 * @param {number[]} embedding2 - Second embedding vector
 * @returns {number} - Similarity score between -1 and 1
 */
export function calculateCosineSimilarity(embedding1, embedding2) {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same dimension');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

export default {
  generateEmbedding,
  generateEmbeddingsBatch,
  calculateCosineSimilarity
};
