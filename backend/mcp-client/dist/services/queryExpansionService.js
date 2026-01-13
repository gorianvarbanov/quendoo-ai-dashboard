/**
 * Query Expansion Service
 * Expands search queries with synonyms for better recall in hotel/hospitality domain
 */

/**
 * Hotel/Hospitality domain synonyms (Bulgarian and English)
 */
const SYNONYMS = {
  // Accommodation
  'стая': ['room', 'апартамент', 'помещение', 'accommodation', 'suite'],
  'room': ['стая', 'апартамент', 'suite', 'accommodation'],
  'апартамент': ['стая', 'room', 'suite', 'apartment'],
  'suite': ['стая', 'room', 'апартамент', 'люкс'],

  // Pricing
  'цена': ['price', 'rate', 'тариф', 'стойност', 'сума', 'cost'],
  'price': ['цена', 'rate', 'тариф', 'cost', 'fee'],
  'тариф': ['rate', 'цена', 'price', 'tariff'],
  'rate': ['тариф', 'цена', 'price'],

  // Booking
  'резервация': ['booking', 'reservation', 'запазване', 'бронирование'],
  'booking': ['резервация', 'reservation', 'запазване'],
  'reservation': ['резервация', 'booking', 'запазване'],

  // Availability
  'наличност': ['availability', 'свободни', 'налични', 'available'],
  'availability': ['наличност', 'свободни', 'available'],
  'свободен': ['available', 'free', 'vacant', 'наличен'],
  'available': ['свободен', 'наличен', 'vacant'],

  // Guests
  'гост': ['guest', 'клиент', 'посетител', 'customer'],
  'guest': ['гост', 'клиент', 'customer', 'visitor'],
  'клиент': ['client', 'customer', 'гост', 'guest'],

  // Services
  'услуга': ['service', 'facility', 'amenity', 'удобство'],
  'service': ['услуга', 'facility', 'amenity'],
  'удобство': ['amenity', 'facility', 'услуга'],

  // Time periods
  'сезон': ['season', 'период', 'period'],
  'season': ['сезон', 'период', 'period'],
  'нощувка': ['night', 'overnight', 'stay'],
  'night': ['нощувка', 'overnight', 'evening'],

  // Meal plans
  'закуска': ['breakfast', 'morning meal'],
  'breakfast': ['закуска', 'morning meal'],
  'вечеря': ['dinner', 'evening meal', 'supper'],
  'dinner': ['вечеря', 'evening meal'],

  // Payment
  'плащане': ['payment', 'charge', 'fee', 'такса'],
  'payment': ['плащане', 'charge', 'fee'],
  'такса': ['fee', 'charge', 'плащане'],

  // Cancellation
  'анулация': ['cancellation', 'отмяна', 'cancel'],
  'cancellation': ['анулация', 'отмяна', 'refund'],
  'отмяна': ['cancellation', 'анулация', 'cancel'],

  // Documents
  'договор': ['contract', 'agreement', 'споразумение'],
  'contract': ['договор', 'agreement'],
  'фактура': ['invoice', 'bill', 'сметка'],
  'invoice': ['фактура', 'bill'],
  'меню': ['menu', 'catalog', 'каталог'],
  'menu': ['меню', 'list', 'catalog'],

  // Policies
  'политика': ['policy', 'правило', 'rule'],
  'policy': ['политика', 'rule', 'regulation'],
  'правило': ['rule', 'policy', 'regulation'],

  // Contact
  'телефон': ['phone', 'telephone', 'tel', 'mobile'],
  'phone': ['телефон', 'tel', 'telephone'],
  'имейл': ['email', 'e-mail', 'mail'],
  'email': ['имейл', 'e-mail', 'mail'],

  // Location
  'адрес': ['address', 'location', 'място'],
  'address': ['адрес', 'location'],
  'локация': ['location', 'място', 'address'],

  // Capacity
  'капацитет': ['capacity', 'вместимост', 'places'],
  'capacity': ['капацитет', 'вместимост'],
  'вместимост': ['capacity', 'капацитет', 'space']
};

/**
 * Common hotel amenities and features (add weight to these terms)
 */
const IMPORTANT_TERMS = new Set([
  'wifi', 'parking', 'breakfast', 'pool', 'spa', 'gym', 'fitness',
  'балкон', 'балкони', 'изглед', 'море', 'планина',
  'кондиционер', 'отопление', 'mini-bar', 'tv', 'телевизор',
  'check-in', 'check-out', 'reception', 'рецепция'
]);

/**
 * Expand query with synonyms
 * @param {string} query - Original search query
 * @param {object} options - Expansion options
 * @returns {object} - Expanded query data
 */
export function expandQuery(query, options = {}) {
  const {
    maxSynonyms = 3,          // Max synonyms per term
    includeOriginal = true,   // Include original term
    languageMix = true        // Include cross-language synonyms
  } = options;

  // Normalize query
  const normalizedQuery = query.toLowerCase().trim();

  // Split into words
  const words = normalizedQuery.split(/\s+/);

  // Expanded terms
  const expandedTerms = new Set();
  const importantTermsFound = [];

  // Process each word
  words.forEach(word => {
    // Always add original word
    if (includeOriginal) {
      expandedTerms.add(word);
    }

    // Check if it's an important term
    if (IMPORTANT_TERMS.has(word)) {
      importantTermsFound.push(word);
      expandedTerms.add(word);
    }

    // Add synonyms
    if (SYNONYMS[word]) {
      let synonymsAdded = 0;
      for (const synonym of SYNONYMS[word]) {
        if (synonymsAdded >= maxSynonyms) break;

        // Check if synonym is same language or cross-language
        const isCyrillic = /[\u0400-\u04FF]/.test(word);
        const synonymIsCyrillic = /[\u0400-\u04FF]/.test(synonym);

        if (languageMix || isCyrillic === synonymIsCyrillic) {
          expandedTerms.add(synonym);
          synonymsAdded++;
        }
      }
    }
  });

  // Create expanded query string
  const expandedQuery = Array.from(expandedTerms).join(' ');

  return {
    original: query,
    expanded: expandedQuery,
    terms: Array.from(expandedTerms),
    importantTerms: importantTermsFound,
    hasExpansion: expandedTerms.size > words.length
  };
}

/**
 * Boost score based on important terms match
 * @param {string} text - Text to check
 * @param {string[]} importantTerms - Important terms from query
 * @returns {number} - Boost multiplier (1.0 - 1.5)
 */
export function calculateBoost(text, importantTerms) {
  if (!importantTerms || importantTerms.length === 0) {
    return 1.0;
  }

  const normalizedText = text.toLowerCase();
  let matchCount = 0;

  importantTerms.forEach(term => {
    if (normalizedText.includes(term)) {
      matchCount++;
    }
  });

  // Boost by 10% for each important term match (max 50%)
  const boost = 1.0 + (matchCount * 0.1);
  return Math.min(boost, 1.5);
}

/**
 * Extract key phrases from query for better matching
 * @param {string} query - Search query
 * @returns {string[]} - Key phrases
 */
export function extractKeyPhrases(query) {
  const phrases = [];

  // Check for quoted phrases
  const quotedPhrases = query.match(/"([^"]+)"/g);
  if (quotedPhrases) {
    quotedPhrases.forEach(phrase => {
      phrases.push(phrase.replace(/"/g, ''));
    });
  }

  // Check for multi-word important terms
  const multiWordPatterns = [
    /\b(check.?in|check.?out)\b/gi,
    /\b(full board|half board|bed and breakfast|b&b)\b/gi,
    /\b(sea view|mountain view|city view)\b/gi,
    /\b(double room|single room|twin room|triple room)\b/gi,
    /\b(стая за двама|двойна стая|единична стая)\b/gi,
    /\b(изглед към море|изглед планина)\b/gi
  ];

  multiWordPatterns.forEach(pattern => {
    const matches = query.match(pattern);
    if (matches) {
      matches.forEach(match => phrases.push(match.toLowerCase()));
    }
  });

  return phrases;
}

export default {
  expandQuery,
  calculateBoost,
  extractKeyPhrases,
  SYNONYMS,
  IMPORTANT_TERMS
};
