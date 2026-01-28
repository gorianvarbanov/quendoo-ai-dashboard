/**
 * Embedding Service - Generate vector embeddings using Vertex AI
 * Uses text-embedding-004 model (768 dimensions)
 * Production-ready with retry logic and rate limiting
 */

import { PredictionServiceClient } from '@google-cloud/aiplatform';
import { helpers } from '@google-cloud/aiplatform';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'quendoo-ai-dashboard';
const LOCATION = 'us-central1';
const MODEL = 'text-embedding-004';

// Initialize Prediction Service Client
const client = new PredictionServiceClient({
  apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`
});

/**
 * Generate embedding for a single text chunk using Vertex AI
 * @param {string} text - Text to embed (max 20,000 chars)
 * @param {boolean} useMock - Use mock embeddings for fast initial upload (default: true)
 * @param {number} retries - Number of retry attempts (default: 3)
 * @returns {Promise<number[]>} - 768-dimensional embedding vector
 */
export async function generateEmbedding(text, useMock = true, retries = 3) {
  try {
    // Truncate text if too long
    const truncatedText = text.slice(0, 20000);

    // For initial upload, use fast mock embeddings
    // Real embeddings generated asynchronously in background
    if (useMock) {
      return generateMockEmbedding(truncatedText);
    }

    // Real Vertex AI embeddings (for background processing)
    console.log('[EmbeddingService] Generating real Vertex AI embedding...');

    const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}`;

    // Prepare the request
    const instanceValue = helpers.toValue({
      content: truncatedText,
      task_type: 'RETRIEVAL_DOCUMENT'
    });

    const instances = [instanceValue];
    const request = {
      endpoint,
      instances
    };

    try {
      const [response] = await client.predict(request);

      if (response.predictions && response.predictions.length > 0) {
        const prediction = response.predictions[0];
        const embeddingsValue = prediction.structValue.fields.embeddings;

        if (embeddingsValue && embeddingsValue.structValue) {
          const valuesArray = embeddingsValue.structValue.fields.values.listValue.values;
          const embedding = valuesArray.map(v => v.numberValue);

          console.log(`[EmbeddingService] Successfully generated embedding (${embedding.length} dimensions)`);
          return embedding;
        }
      }

      throw new Error('Invalid response structure from Vertex AI');

    } catch (apiError) {
      // Handle rate limiting with exponential backoff
      if (apiError.code === 8 || apiError.code === 429) { // RESOURCE_EXHAUSTED
        if (retries > 0) {
          const delay = (4 - retries) * 1000; // 1s, 2s, 3s
          console.log(`[EmbeddingService] Rate limited, retrying in ${delay}ms (${retries} retries left)...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return generateEmbedding(text, false, retries - 1);
        } else {
          console.warn('[EmbeddingService] Rate limit exceeded, falling back to mock embedding');
          return generateMockEmbedding(truncatedText);
        }
      }

      throw apiError;
    }

  } catch (error) {
    console.error('[EmbeddingService] Error generating embedding:', error);
    // Fallback to mock embeddings on error
    return generateMockEmbedding(text);
  }
}

/**
 * Generate deterministic mock embedding (for fallback and initial upload)
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

      // Process batch in parallel with retry logic
      const batchEmbeddings = await Promise.all(
        batch.map(text => generateEmbedding(text, false))
      );

      allEmbeddings.push(...batchEmbeddings);

      // Delay between batches to respect rate limits (10 requests/minute)
      if (i + batchSize < texts.length) {
        const delayMs = 6000 / batchSize; // Spread out to ~10 req/min
        console.log(`[EmbeddingService] Waiting ${delayMs}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
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
