/**
 * IMPROVED BOOKING.COM SCRAPER LOGIC
 * Focus on data accuracy and quality
 *
 * This file contains the improved page.evaluate() logic to replace lines 315-502 in index.js
 */

// This function runs in browser context (page.evaluate)
const improvedScraperLogic = () => {
  // ===== HELPER FUNCTIONS =====

  /**
   * Try multiple selectors with fallback
   */
  function extractWithFallback(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    return null;
  }

  /**
   * Extract currency from text and element attributes
   * Returns normalized currency code (USD, EUR, BGN, GBP)
   */
  function extractCurrency(priceText, priceElement) {
    // Priority 1: Check data attribute (most reliable)
    if (priceElement) {
      const dataCurrency = priceElement.getAttribute('data-currency');
      if (dataCurrency && /^[A-Z]{3}$/.test(dataCurrency)) {
        return dataCurrency;
      }
    }

    // Priority 2: Check currency patterns in text
    const currencyPatterns = {
      'USD': /\$|USD|US\$/i,
      'EUR': /€|EUR/i,
      'BGN': /лв\.?|BGN|лева|лев/i,
      'GBP': /£|GBP/i,
      'CHF': /CHF|Fr\./i
    };

    for (const [code, pattern] of Object.entries(currencyPatterns)) {
      if (pattern.test(priceText)) {
        return code;
      }
    }

    // Priority 3: Check parent elements for currency info
    if (priceElement) {
      let parent = priceElement.parentElement;
      let levels = 0;
      while (parent && levels < 3) {
        const parentText = parent.textContent;
        for (const [code, pattern] of Object.entries(currencyPatterns)) {
          if (pattern.test(parentText)) {
            return code;
          }
        }
        parent = parent.parentElement;
        levels++;
      }
    }

    // Default fallback
    return 'USD';
  }

  /**
   * Extract price from element, distinguishing between base and final price
   * Returns: { basePrice, finalPrice, totalPrice, pricePerNight, isDiscounted }
   */
  function extractPriceData(roomElement) {
    const priceData = {
      basePrice: null,
      finalPrice: null,
      totalPrice: null,
      pricePerNight: null,
      isDiscounted: false,
      currency: 'USD'
    };

    // Look for discounted price structure (most accurate)
    const discountedPriceEl = roomElement.querySelector(
      "[data-testid='price-and-discounted-price'], " +
      ".bui-price-display__original"
    );

    if (discountedPriceEl) {
      // Has discount - extract both old and new price
      const strikethroughPrice = roomElement.querySelector(
        ".bui-text--strikethrough, " +
        "[data-testid='price-old'], " +
        ".bui-price-display__original"
      );

      if (strikethroughPrice) {
        const oldPriceText = strikethroughPrice.textContent.trim();
        const oldPriceMatch = oldPriceText.match(/([\d\s,.]+)/);
        if (oldPriceMatch) {
          priceData.basePrice = parseFloat(oldPriceMatch[1].replace(/[\s,]/g, ""));
          priceData.isDiscounted = true;
        }
      }

      // Get final (discounted) price
      const finalPriceEl = roomElement.querySelector(
        "[data-testid='price-final'], " +
        ".bui-price-display__value--highlighted, " +
        ".prco-valign-middle-helper:not(.bui-text--strikethrough)"
      );

      if (finalPriceEl) {
        const finalPriceText = finalPriceEl.textContent.trim();
        const finalPriceMatch = finalPriceText.match(/([\d\s,.]+)/);
        if (finalPriceMatch) {
          priceData.finalPrice = parseFloat(finalPriceMatch[1].replace(/[\s,]/g, ""));
        }

        // Extract currency
        priceData.currency = extractCurrency(finalPriceText, finalPriceEl);
      }
    } else {
      // No discount - single price
      const priceSelectors = [
        "[data-testid='price-and-discounted-price']",
        ".prco-valign-middle-helper",
        ".bui-price-display__value",
        ".prco-text-nowrap-helper",
        "[class*='price'][class*='value']",
        ".room-price"
      ];

      let priceElement = null;
      for (const selector of priceSelectors) {
        priceElement = roomElement.querySelector(selector);
        if (priceElement && priceElement.textContent.trim()) {
          break;
        }
      }

      if (priceElement) {
        const priceText = priceElement.textContent.trim();
        const priceMatch = priceText.match(/([\d\s,.]+)/);
        if (priceMatch) {
          const price = parseFloat(priceMatch[1].replace(/[\s,]/g, ""));
          priceData.finalPrice = price;
          priceData.basePrice = price;
        }

        // Extract currency
        priceData.currency = extractCurrency(priceText, priceElement);
      }
    }

    // Check for "per night" indicator
    const perNightText = roomElement.textContent;
    if (/per\s+night|\/\s*night|на\s+нощувка/i.test(perNightText)) {
      priceData.pricePerNight = priceData.finalPrice;
      priceData.totalPrice = null; // Don't know total without nights count
    } else {
      priceData.totalPrice = priceData.finalPrice;
      priceData.pricePerNight = null;
    }

    return priceData;
  }

  /**
   * Extract meal plan information
   */
  function extractMealPlan(roomElement) {
    // Check for meal plan indicators
    const mealSelectors = [
      "[data-testid='meal-plan']",
      ".bui-price-display__policy",
      ".hprt-facilities-facility",
      "[class*='meal']",
      "[class*='breakfast']"
    ];

    for (const selector of mealSelectors) {
      const el = roomElement.querySelector(selector);
      if (el) {
        const text = el.textContent.trim().toLowerCase();

        // Breakfast included
        if (/breakfast\s+included|закуска\s+включена/i.test(text)) {
          return 'Breakfast included';
        }

        // Room only
        if (/room\s+only|само\s+стая/i.test(text)) {
          return 'Room only';
        }

        // Half board
        if (/half\s+board|полупансион/i.test(text)) {
          return 'Half board';
        }

        // Full board
        if (/full\s+board|пълен\s+пансион/i.test(text)) {
          return 'Full board';
        }

        // All inclusive
        if (/all\s+inclusive|всичко\s+включено/i.test(text)) {
          return 'All inclusive';
        }
      }
    }

    // Check in room facilities
    const facilities = roomElement.querySelectorAll(".hprt-facilities-facility, .rt-facilities li");
    for (const facility of facilities) {
      const text = facility.textContent.trim().toLowerCase();
      if (/breakfast/i.test(text)) {
        return 'Breakfast included';
      }
    }

    return 'Room only'; // Default
  }

  /**
   * Extract cancellation policy
   */
  function extractCancellationPolicy(roomElement) {
    const policySelectors = [
      "[data-testid='cancellation-policy']",
      ".bui-price-display__policy",
      ".hprt-cancellation-policy",
      "[class*='cancellation']"
    ];

    for (const selector of policySelectors) {
      const el = roomElement.querySelector(selector);
      if (el) {
        const text = el.textContent.trim();

        // Check if it's non-refundable
        if (/non[- ]refundable|without\s+refund|няма\s+възстановяване/i.test(text)) {
          return {
            isRefundable: false,
            policy: 'Non-refundable',
            policyText: text
          };
        }

        // Free cancellation
        if (/free\s+cancellation|безплатно\s+отказване/i.test(text)) {
          // Extract deadline if present
          const deadlineMatch = text.match(/until\s+(\d{1,2}\s+\w+)|before\s+(\d{1,2}\s+\w+)/i);
          return {
            isRefundable: true,
            policy: 'Free cancellation',
            policyText: text,
            deadline: deadlineMatch ? deadlineMatch[0] : null
          };
        }

        // Partial refund
        if (/partial\s+refund|частично\s+възстановяване/i.test(text)) {
          return {
            isRefundable: true,
            policy: 'Partially refundable',
            policyText: text
          };
        }

        // Generic refundable
        return {
          isRefundable: true,
          policy: 'Refundable',
          policyText: text
        };
      }
    }

    // Check for non-refundable badge
    if (roomElement.querySelector("[data-testid='non-refundable'], .non-refundable-badge")) {
      return {
        isRefundable: false,
        policy: 'Non-refundable',
        policyText: null
      };
    }

    // Default: assume refundable if no explicit policy
    return {
      isRefundable: true,
      policy: 'Standard',
      policyText: null
    };
  }

  /**
   * Extract amenities/inclusions
   */
  function extractAmenities(roomElement) {
    const amenities = {
      freeWifi: false,
      freeParking: false,
      airConditioning: false,
      balcony: false,
      seaView: false,
      privateBathroom: false
    };

    // Check facilities list
    const facilities = roomElement.querySelectorAll(
      ".hprt-facilities-facility, " +
      ".rt-facilities li, " +
      "[data-testid='room-facilities'] li"
    );

    facilities.forEach(facility => {
      const text = facility.textContent.trim().toLowerCase();

      if (/wifi|wi-fi/i.test(text)) {
        amenities.freeWifi = true;
      }
      if (/parking/i.test(text)) {
        amenities.freeParking = true;
      }
      if (/air\s+conditioning|климатик/i.test(text)) {
        amenities.airConditioning = true;
      }
      if (/balcony|балкон|terrace|тераса/i.test(text)) {
        amenities.balcony = true;
      }
      if (/sea\s+view|изглед\s+към\s+море|ocean\s+view/i.test(text)) {
        amenities.seaView = true;
      }
      if (/private\s+bathroom|собствена\s+баня/i.test(text)) {
        amenities.privateBathroom = true;
      }
    });

    // Check for icons
    if (roomElement.querySelector("[data-icon-name='wifi'], [class*='wifi']")) {
      amenities.freeWifi = true;
    }
    if (roomElement.querySelector("[data-icon-name='parking'], [class*='parking']")) {
      amenities.freeParking = true;
    }

    return amenities;
  }

  /**
   * Extract availability info (rooms left at this price)
   */
  function extractAvailability(roomElement) {
    const availability = {
      isAvailable: true,
      roomsLeftAtThisPrice: null,
      scarcityMessage: null
    };

    // Check for sold out
    const soldOut = roomElement.querySelector(
      ".soldout, .unavailable, [data-sold-out='true']"
    );
    if (soldOut) {
      availability.isAvailable = false;
      availability.scarcityMessage = 'Sold out';
      return availability;
    }

    // Check for "only X left" messages
    const scarcitySelectors = [
      ".only_x_left",
      "[data-testid='scarcity-message']",
      "[class*='scarcity']",
      "[class*='urgency']"
    ];

    for (const selector of scarcitySelectors) {
      const el = roomElement.querySelector(selector);
      if (el) {
        const text = el.textContent.trim();
        availability.scarcityMessage = text;

        // Extract number
        const match = text.match(/(\d+)/);
        if (match) {
          availability.roomsLeftAtThisPrice = parseInt(match[1]);
        }
        break;
      }
    }

    return availability;
  }

  /**
   * Normalize room name (remove variants in parentheses)
   */
  function normalizeRoomName(name) {
    if (!name) return '';

    // Remove parentheses content (variants like "non-refundable")
    let normalized = name.replace(/\s*\([^)]*\)\s*/g, ' ');

    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  // ===== MAIN EXTRACTION LOGIC =====

  const data = {
    hotelName: null,
    prices: [],
    rooms: [],
    availability: null,
    rating: null,
    reviews: null,
    extractionQuality: {
      hasHotelName: false,
      hasRooms: false,
      hasPrices: false,
      hasRating: false,
      roomsWithMealPlan: 0,
      roomsWithCancellationPolicy: 0
    }
  };

  // ===== EXTRACT HOTEL NAME =====
  data.hotelName = extractWithFallback([
    "[data-testid='title']",
    "h2.pp-header__title",
    "h1.hp__hotel-name",
    "h2.hp__hotel-name",
    ".hp-header__title",
    ".pp-header-title",
    "h1[class*='hotel']",
    "h1"
  ]);
  data.extractionQuality.hasHotelName = !!data.hotelName;

  // ===== EXTRACT RATING =====
  const ratingText = extractWithFallback([
    "[data-testid='review-score']",
    ".bui-review-score__badge",
    ".review-score-badge",
    "[aria-label*='rating']",
    ".b-rating__score"
  ]);
  if (ratingText) {
    const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
    if (ratingMatch) {
      data.rating = parseFloat(ratingMatch[1]);
      data.extractionQuality.hasRating = true;
    }
  }

  // ===== EXTRACT REVIEWS COUNT =====
  const reviewsText = extractWithFallback([
    "[data-testid='review-score-subtitle']",
    ".bui-review-score__text",
    ".review-score-text",
    "[class*='review'][class*='count']"
  ]);
  if (reviewsText) {
    const match = reviewsText.match(/(\d+[\s,]?\d*)/);
    if (match) {
      data.reviews = parseInt(match[1].replace(/[\s,]/g, ""));
    }
  }

  // ===== EXTRACT ROOMS WITH ENHANCED DATA =====
  const roomBlocks = document.querySelectorAll([
    "[data-block-id]",
    ".hprt-table tbody tr",
    ".room-table tbody tr",
    "[data-testid='room-table'] tbody tr",
    ".roomstable tbody tr",
    ".ftb-room-row"
  ].join(","));

  roomBlocks.forEach((room, index) => {
    try {
      // Extract room name
      let roomName = null;
      const roomNameSelectors = [
        "[data-testid='room-name']",
        ".hprt-roomtype-link",
        ".room-name",
        ".roomType",
        "[class*='room'][class*='name']"
      ];
      for (const selector of roomNameSelectors) {
        const el = room.querySelector(selector);
        if (el && el.textContent.trim()) {
          roomName = el.textContent.trim();
          break;
        }
      }

      if (!roomName) {
        console.warn(`[Room ${index}] No room name found, skipping`);
        return; // Skip this room
      }

      // Extract price data (enhanced)
      const priceData = extractPriceData(room);

      if (!priceData.finalPrice || priceData.finalPrice <= 0) {
        console.warn(`[Room ${index}] No valid price found for "${roomName}", skipping`);
        return; // Skip rooms without valid price
      }

      // Extract meal plan
      const mealPlan = extractMealPlan(room);

      // Extract cancellation policy
      const cancellationPolicy = extractCancellationPolicy(room);

      // Extract amenities
      const amenities = extractAmenities(room);

      // Extract availability
      const availability = extractAvailability(room);

      // Extract bed type
      let bedType = null;
      const bedInfo = room.querySelector(".hprt-lightbox-title, .room-bed-info, [data-testid='bed-type']");
      if (bedInfo) {
        bedType = bedInfo.textContent.trim();
      }

      // Extract max occupancy
      let maxOccupancy = null;
      const occupancy = room.querySelector(".bui-u-sr-only, [data-testid='max-occupancy']");
      if (occupancy) {
        const match = occupancy.textContent.match(/(\d+)/);
        if (match) {
          maxOccupancy = parseInt(match[1]);
        }
      }

      // Build complete room data
      const roomData = {
        name: roomName,
        normalizedName: normalizeRoomName(roomName),

        // Price information
        price: priceData.finalPrice, // For backwards compatibility
        basePrice: priceData.basePrice,
        finalPrice: priceData.finalPrice,
        totalPrice: priceData.totalPrice,
        pricePerNight: priceData.pricePerNight,
        isDiscounted: priceData.isDiscounted,
        currency: priceData.currency,

        // Inclusions
        mealPlan: mealPlan,
        cancellationPolicy: cancellationPolicy,
        amenities: amenities,

        // Room details
        bedType: bedType,
        maxOccupancy: maxOccupancy,

        // Availability
        available: availability.isAvailable,
        availability: availability,

        // Metadata
        extractedAt: new Date().toISOString(),
        roomIndex: index
      };

      data.rooms.push(roomData);

      // Track quality metrics
      if (mealPlan && mealPlan !== 'Room only') {
        data.extractionQuality.roomsWithMealPlan++;
      }
      if (cancellationPolicy && cancellationPolicy.policy !== 'Standard') {
        data.extractionQuality.roomsWithCancellationPolicy++;
      }

    } catch (err) {
      console.error(`[Room ${index}] Error extracting room data:`, err.message);
    }
  });

  data.extractionQuality.hasRooms = data.rooms.length > 0;
  data.extractionQuality.hasPrices = data.rooms.some(r => r.finalPrice > 0);

  // ===== EXTRACT SUMMARY PRICES (fallback) =====
  // Only if no rooms were extracted, try to get prices from summary
  if (data.rooms.length === 0) {
    const priceSelectors = [
      ".prco-valign-middle-helper",
      ".bui-price-display__value",
      "[data-testid='price']",
      ".prco-text-nowrap-helper",
      "[class*='price']"
    ].join(",");

    const priceElements = document.querySelectorAll(priceSelectors);
    priceElements.forEach(el => {
      try {
        const priceText = el.textContent.trim();
        const priceMatch = priceText.match(/([\d\s,.]+)/);
        if (priceMatch) {
          const price = parseFloat(priceMatch[1].replace(/[\s,]/g, ""));
          if (price > 0 && !data.prices.includes(price)) {
            data.prices.push(price);
          }
        }
      } catch (err) {
        console.error("Error extracting summary price:", err.message);
      }
    });
  }

  // ===== CHECK OVERALL AVAILABILITY =====
  const soldOutElements = document.querySelectorAll([
    "[data-sold-out='true']",
    ".sold-out",
    ".unavailable",
    "[class*='soldout']",
    "[class*='not-available']"
  ].join(","));

  data.availability = soldOutElements.length === 0 ? "available" : "limited";

  // ===== DEDUPLICATE ROOMS BY NORMALIZED NAME =====
  // Group rooms by normalized name and keep best variant
  const roomsByName = {};

  data.rooms.forEach(room => {
    const key = room.normalizedName;

    if (!roomsByName[key]) {
      roomsByName[key] = {
        baseName: key,
        variants: [],
        cheapestPrice: Infinity,
        mostExpensivePrice: 0,
        bestVariant: null
      };
    }

    roomsByName[key].variants.push(room);

    // Track price range
    if (room.finalPrice < roomsByName[key].cheapestPrice) {
      roomsByName[key].cheapestPrice = room.finalPrice;
      roomsByName[key].bestVariant = room; // Prefer cheapest
    }
    if (room.finalPrice > roomsByName[key].mostExpensivePrice) {
      roomsByName[key].mostExpensivePrice = room.finalPrice;
    }
  });

  // Add room grouping metadata
  data.roomGroups = Object.values(roomsByName).map(group => ({
    name: group.baseName,
    variants: group.variants.length,
    minPrice: group.cheapestPrice,
    maxPrice: group.mostExpensivePrice,
    recommendedVariant: group.bestVariant,
    allVariants: group.variants.map(v => ({
      name: v.name,
      price: v.finalPrice,
      mealPlan: v.mealPlan,
      cancellationPolicy: v.cancellationPolicy.policy,
      isRefundable: v.cancellationPolicy.isRefundable
    }))
  }));

  console.log(`[Scraper] Extracted: ${data.rooms.length} rooms, ${data.roomGroups.length} unique room types`);
  console.log(`[Scraper] Quality: ${JSON.stringify(data.extractionQuality)}`);

  return data;
};

// Export for use in Cloud Function
module.exports = { improvedScraperLogic };
