/**
 * Hybrid Search Service
 * Combines semantic (vector) search with keyword (BM25-style) search
 */

/**
 * Calculate BM25-style score for keyword matching
 * @param {string} text - Document text
 * @param {string[]} keywords - Search keywords
 * @param {object} params - BM25 parameters
 * @returns {number} - Keyword match score (0-1)
 */
export function calculateKeywordScore(text, keywords, params = {}) {
  const {
    k1 = 1.5,        // Term frequency saturation parameter
    b = 0.75,        // Length normalization parameter
    avgLength = 1500 // Average document length
  } = params;

  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\s+/);
  const docLength = words.length;

  let score = 0;

  keywords.forEach(keyword => {
    const term = keyword.toLowerCase();

    // Count term frequency in document
    let tf = 0;
    const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi');
    const matches = normalizedText.match(regex);
    if (matches) {
      tf = matches.length;
    }

    // Calculate BM25 component for this term
    if (tf > 0) {
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLength / avgLength));
      score += numerator / denominator;
    }
  });

  // Normalize score to 0-1 range
  const maxPossibleScore = keywords.length * 2.0;
  return Math.min(score / maxPossibleScore, 1.0);
}

/**
 * Escape special regex characters
 * @param {string} string - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate phrase match bonus
 * @param {string} text - Document text
 * @param {string[]} phrases - Key phrases to find
 * @returns {number} - Phrase match bonus (0-0.5)
 */
export function calculatePhraseBonus(text, phrases) {
  if (!phrases || phrases.length === 0) return 0;

  const normalizedText = text.toLowerCase();
  let matchCount = 0;

  phrases.forEach(phrase => {
    if (normalizedText.includes(phrase.toLowerCase())) {
      matchCount++;
    }
  });

  // Up to 50% bonus for phrase matches
  return Math.min(matchCount * 0.15, 0.5);
}

/**
 * Merge and rerank results from semantic and keyword search
 * @param {object[]} semanticResults - Results from vector search
 * @param {object[]} keywordScores - Keyword scores for same chunks
 * @param {object} weights - Weight parameters
 * @returns {object[]} - Merged and reranked results
 */
export function mergeSearchResults(semanticResults, keywordScores, weights = {}) {
  const {
    semanticWeight = 0.7,
    keywordWeight = 0.3
  } = weights;

  // Create map of keyword scores
  const scoreMap = new Map();
  keywordScores.forEach(item => {
    const key = `${item.documentId}_${item.chunkIndex}`;
    scoreMap.set(key, item.keywordScore);
  });

  // Combine scores
  const mergedResults = semanticResults.map(result => {
    const key = `${result.documentId}_${result.chunkIndex}`;
    const keywordScore = scoreMap.get(key) || 0;

    // Weighted combination
    const hybridScore = (result.similarity * semanticWeight) + (keywordScore * keywordWeight);

    return {
      ...result,
      keywordScore,
      hybridScore,
      originalSemanticScore: result.similarity,
      similarity: hybridScore // Update similarity with hybrid score
    };
  });

  // Sort by hybrid score
  mergedResults.sort((a, b) => b.hybridScore - a.hybridScore);

  return mergedResults;
}

/**
 * Perform hybrid search combining semantic and keyword approaches
 * @param {object[]} allChunks - All document chunks with text
 * @param {string[]} keywords - Search keywords
 * @param {string[]} phrases - Key phrases
 * @param {object[]} semanticResults - Semantic search results
 * @returns {object[]} - Reranked hybrid results
 */
export function performHybridSearch(allChunks, keywords, phrases, semanticResults) {
  // Calculate keyword scores for all semantic results
  const keywordScores = semanticResults.map(result => {
    const keywordScore = calculateKeywordScore(result.textChunk, keywords);
    const phraseBonus = calculatePhraseBonus(result.textChunk, phrases);

    return {
      documentId: result.documentId,
      chunkIndex: result.chunkIndex,
      keywordScore: Math.min(keywordScore + phraseBonus, 1.0)
    };
  });

  // Merge results with weighted combination
  return mergeSearchResults(semanticResults, keywordScores);
}

/**
 * Extract keywords from query
 * @param {string} query - Search query
 * @returns {string[]} - Extracted keywords
 */
export function extractKeywords(query) {
  // Remove common stop words
  const stopWords = new Set([
    'и', 'в', 'на', 'с', 'за', 'от', 'до', 'по', 'при', 'или', 'но',
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has',
    'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was',
    'will', 'with', 'the', 'this', 'these', 'those', 'каква', 'какво', 'какви',
    'колко', 'кога', 'къде', 'защо', 'как', 'what', 'when', 'where', 'why', 'how'
  ]);

  // Split and filter
  const words = query.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  return [...new Set(words)]; // Remove duplicates
}

export default {
  calculateKeywordScore,
  calculatePhraseBonus,
  mergeSearchResults,
  performHybridSearch,
  extractKeywords
};
