/**
 * Quendoo Scheduled Tasks - Cloud Functions
 *
 * This Cloud Function executes scheduled automation tasks stored in Firestore.
 * It can be triggered by Cloud Scheduler or HTTP requests.
 */

import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { executeTask, scheduleDailyTaskCheck } from "./taskExecutor.js";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import fetch from "node-fetch";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

/**
 * HTTP endpoint to manually execute a task
 * POST /executeCronJob_http
 * Body: { taskId: "job_123" }
 */
export const executeCronJob_http = onRequest(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 540 // 9 minutes max
  },
  async (request, response) => {
    try {
      const { taskId } = request.body;

      if (!taskId) {
        response.status(400).json({ error: "Missing taskId parameter" });
        return;
      }

      console.log(`[TaskExecutor] HTTP request to execute job: ${taskId}`);

      const result = await executeTask(db, taskId);

      response.json({
        success: true,
        taskId,
        result
      });
    } catch (error) {
      console.error("[TaskExecutor] Error:", error);
      response.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Scheduled function that checks and executes due tasks
 * Runs every 15 minutes to check for jobs that need execution
 */
export const checkAndExecuteTasks = onSchedule(
  {
    schedule: "every 15 minutes",
    region: "us-central1",
    timeoutSeconds: 540
  },
  async (event) => {
    console.log("[TaskScheduler] Starting scheduled task check...");

    try {
      const result = await scheduleDailyTaskCheck(db);
      console.log(`[TaskScheduler] Completed. Executed ${result.executed} jobs, Skipped ${result.skipped}`);
    } catch (error) {
      console.error("[TaskScheduler] Error:", error);
      throw error;
    }
  }
);

/**
 * HTTP endpoint to get task status
 * GET /getTaskStatus?taskId=job_123
 */
export const getTaskStatus = onRequest(
  {
    region: "us-central1",
    cors: true
  },
  async (request, response) => {
    try {
      const taskId = request.query.taskId;

      if (!taskId) {
        response.status(400).json({ error: "Missing taskId parameter" });
        return;
      }

      // Get task details
      const taskDoc = await db.collection("scheduled_tasks").doc(taskId).get();

      if (!taskDoc.exists) {
        response.status(404).json({ error: "Job not found" });
        return;
      }

      // Get last 10 executions
      const historySnapshot = await db
        .collection("task_history")
        .where("taskId", "==", taskId)
        .orderBy("executedAt", "desc")
        .limit(10)
        .get();

      const history = historySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      response.json({
        job: { id: taskDoc.id, ...taskDoc.data() },
        history
      });
    } catch (error) {
      console.error("[GetStatus] Error:", error);
      response.status(500).json({
        error: error.message
      });
    }
  }
);

/**
 * Fetch free proxy list from ProxyScrape
 */
async function fetchFreeProxies() {
  try {
    const response = await fetch(
      'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=elite&format=textplain'
    );
    const text = await response.text();
    const proxies = text.split('\n')
      .map(p => p.trim())
      .filter(p => p && p.includes(':'))
      .slice(0, 20); // Take first 20 proxies

    console.log(`[fetchFreeProxies] Found ${proxies.length} free proxies`);
    return proxies;
  } catch (error) {
    console.error('[fetchFreeProxies] Error fetching proxies:', error);
    return [];
  }
}

/**
 * Get a random proxy (paid or free)
 */
async function getRandomProxy() {
  // Option 1: Use paid proxy if configured (WebShare, ProxyMesh, etc.)
  const paidProxyUrl = process.env.PROXY_URL; // Format: http://username:password@proxy.example.com:port
  if (paidProxyUrl) {
    console.log('[getRandomProxy] Using paid proxy');
    return paidProxyUrl;
  }

  // Option 2: Use free proxy pool
  const freeProxies = await fetchFreeProxies();
  if (freeProxies.length > 0) {
    const randomProxy = freeProxies[Math.floor(Math.random() * freeProxies.length)];
    console.log(`[getRandomProxy] Using free proxy: ${randomProxy}`);
    return `http://${randomProxy}`;
  }

  // Option 3: No proxy available
  console.log('[getRandomProxy] No proxy available, using direct connection');
  return null;
}

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 2, baseDelay = 5000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.error(`[retryWithBackoff] Attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (attempt === maxRetries) {
        console.error(`[retryWithBackoff] All ${maxRetries} attempts failed`);
        throw error; // Last attempt - throw the error
      }

      // Exponential backoff: 5s, 10s, 20s
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`[retryWithBackoff] Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * HTTP endpoint to scrape Booking.com competitor prices
 * POST /scrapeBooking
 * Body: { url, checkIn, checkOut, adults, children, rooms }
 */
export const scrapeBooking = onRequest(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 120,
    memory: "2GiB"
  },
  async (request, response) => {
    const { url, checkIn, checkOut, adults = 2, children = 0, rooms = 1, cacheKey } = request.body;

    if (!url) {
      response.status(400).json({ error: "Missing required parameter: url" });
      return;
    }

    console.log("[scrapeBooking] Starting browser for URL:", url);
    if (cacheKey) {
      console.log("[scrapeBooking] Cache key provided:", cacheKey);
    }

    // Helper function to update progress in Firestore
    const updateProgress = async (progress, message) => {
      if (!cacheKey) return;
      try {
        await db.collection('competitor_price_cache').doc(cacheKey).set({
          status: 'in_progress',
          progress: progress,
          message: message,
          timestamp: Date.now() / 1000,
          url: url,
          checkIn: checkIn || null,
          checkOut: checkOut || null
        }, { merge: true });
        console.log(`[scrapeBooking] Progress: ${progress}% - ${message}`);
      } catch (error) {
        console.error(`[scrapeBooking] Failed to update progress:`, error);
      }
    };

    // Wrap scraping logic in retry function
    const performScraping = async () => {
      // Configure @sparticuz/chromium for Cloud Functions
      chromium.setHeadlessMode = true;
      chromium.setGraphicsMode = false;

      await updateProgress(5, 'Initializing browser...');

      // ✅ GET PROXY (paid or free)
      const proxyUrl = await getRandomProxy();
      const launchArgs = [...chromium.args];

      if (proxyUrl) {
        launchArgs.push(`--proxy-server=${proxyUrl}`);
        console.log(`[scrapeBooking] Using proxy: ${proxyUrl}`);
      } else {
        console.log(`[scrapeBooking] No proxy - using direct connection`);
      }

      await updateProgress(10, 'Starting browser...');

      // Launch headless browser with bundled Chromium + proxy
      const browser = await puppeteer.launch({
        args: launchArgs,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless
      });

      const page = await browser.newPage();

      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
      await page.setViewport({ width: 1920, height: 1080 });

      await updateProgress(20, 'Browser ready, preparing URL...');

      // Build URL with search parameters
      let searchUrl = url;
      if (checkIn && checkOut) {
        const urlObj = new URL(url);
        urlObj.searchParams.set("checkin", checkIn);
        urlObj.searchParams.set("checkout", checkOut);
        urlObj.searchParams.set("group_adults", adults);
        urlObj.searchParams.set("group_children", children);
        urlObj.searchParams.set("no_rooms", rooms);
        searchUrl = urlObj.toString();
      }

      console.log("[scrapeBooking] Navigating to:", searchUrl);

      await updateProgress(30, 'Loading Booking.com page...');

      // Navigate with timeout (increased to 60s to handle slow responses)
      await page.goto(searchUrl, {
        waitUntil: "networkidle0",
        timeout: 60000
      });

      await updateProgress(60, 'Page loaded, waiting for content...');

      // Wait for content to load
      await page.waitForSelector("body", { timeout: 5000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      await updateProgress(70, 'Extracting hotel data...');

      // Extract hotel data with improved accuracy logic
      const hotelData = await page.evaluate(() => {
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

            // Get final (discounted) price - avoid strikethrough
            const finalPriceEl = roomElement.querySelector(
              "[data-testid='price-final'], " +
              ".bui-price-display__value--highlighted, " +
              ".prco-valign-middle-helper:not(.bui-text--strikethrough)"
            );

            if (finalPriceEl) {
              const finalPriceText = finalPriceEl.textContent.trim();
              console.log('[extractPriceData] Final price element text:', finalPriceText);
              const finalPriceMatch = finalPriceText.match(/([\d\s,.]+)/);
              if (finalPriceMatch) {
                priceData.finalPrice = parseFloat(finalPriceMatch[1].replace(/[\s,]/g, ""));
              }

              // Extract currency
              priceData.currency = extractCurrency(finalPriceText, finalPriceEl);
              console.log('[extractPriceData] Extracted currency:', priceData.currency, 'from text:', finalPriceText);
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
              console.log('[extractPriceData] Single price element text:', priceText);
              const priceMatch = priceText.match(/([\d\s,.]+)/);
              if (priceMatch) {
                const price = parseFloat(priceMatch[1].replace(/[\s,]/g, ""));
                priceData.finalPrice = price;
                priceData.basePrice = price;
              }

              // Extract currency
              priceData.currency = extractCurrency(priceText, priceElement);
              console.log('[extractPriceData] Extracted currency:', priceData.currency, 'from text:', priceText);
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
        console.log('[Scraper] Starting room extraction...');

        // Try multiple selector strategies for room blocks
        let roomBlocks = document.querySelectorAll([
          "[data-block-id]",
          ".hprt-table tbody tr",
          ".room-table tbody tr",
          "[data-testid='room-table'] tbody tr",
          ".roomstable tbody tr",
          ".ftb-room-row",
          // NEW: Additional selectors for 2026 Booking.com layout
          "[data-testid='roomtable-row']",
          "[data-testid='room-row']",
          "tr[data-block-id]",
          ".js-room-container",
          "[class*='RoomRow']",
          "[class*='room-row']",
          "table[data-testid*='room'] tbody tr",
          "[data-testid='property-card__room-list'] > *"
        ].join(","));

        console.log(`[Scraper] Initial query found ${roomBlocks.length} room blocks`);

        // Fallback: If no rooms found, try broader table search
        if (roomBlocks.length === 0) {
          console.warn('[Scraper] No rooms found with primary selectors, trying fallback...');

          // Look for any table that might contain rooms
          const tables = document.querySelectorAll('table');
          console.log(`[Scraper] Found ${tables.length} tables on page`);

          tables.forEach((table, idx) => {
            const rows = table.querySelectorAll('tbody tr');
            if (rows.length > 0) {
              console.log(`[Scraper] Table ${idx} has ${rows.length} rows`);
              // Check if any row contains price information
              const hasPrice = Array.from(rows).some(row =>
                /[\d\s,.]+/.test(row.textContent) &&
                /(€|лв|\$|USD|EUR|BGN)/i.test(row.textContent)
              );
              if (hasPrice) {
                console.log(`[Scraper] Table ${idx} contains price data, using its rows`);
                roomBlocks = rows;
              }
            }
          });

          console.log(`[Scraper] After fallback: ${roomBlocks.length} room blocks`);
        }

        // Debug: Log selectors that matched
        if (roomBlocks.length > 0) {
          const firstRoom = roomBlocks[0];
          console.log('[Scraper] First room element classes:', firstRoom.className);
          console.log('[Scraper] First room data attributes:',
            Array.from(firstRoom.attributes)
              .filter(attr => attr.name.startsWith('data-'))
              .map(attr => `${attr.name}="${attr.value}"`)
              .join(', ')
          );
        }

        roomBlocks.forEach((room, index) => {
          try {
            // Extract room name
            let roomName = null;
            const roomNameSelectors = [
              "[data-testid='room-name']",
              ".hprt-roomtype-link",
              ".room-name",
              ".roomType",
              "[class*='room'][class*='name']",
              // NEW: Additional selectors for 2026 layout
              "[data-testid='title']",
              "a[href*='room']",
              "h3", "h4", // Headers might contain room names
              ".bui-card__title",
              "[class*='RoomName']",
              "[class*='room-type']"
            ];
            for (const selector of roomNameSelectors) {
              const el = room.querySelector(selector);
              if (el && el.textContent.trim()) {
                roomName = el.textContent.trim();
                console.log(`[Room ${index}] Found room name "${roomName}" via selector: ${selector}`);
                break;
              }
            }

            if (!roomName) {
              // Debug: log room content to help identify selector
              const roomText = room.textContent.trim().substring(0, 200);
              console.warn(`[Room ${index}] No room name found. Room content preview: "${roomText}..."`);
              return; // Skip this room
            }

            // Extract price data (enhanced)
            const priceData = extractPriceData(room);

            // Debug: Log raw price extraction details
            console.log(`[Room ${index}] Price extraction for "${roomName}":`, {
              finalPrice: priceData.finalPrice,
              basePrice: priceData.basePrice,
              currency: priceData.currency,
              isDiscounted: priceData.isDiscounted
            });

            if (!priceData.finalPrice || priceData.finalPrice <= 0) {
              // Debug: log room content to help identify price selector
              const priceAreaText = room.textContent.match(/[\d\s,.]+\s*(€|лв|\$|USD|EUR|BGN)/gi);
              console.warn(`[Room ${index}] No valid price found for "${roomName}". Price patterns in content:`, priceAreaText);
              return; // Skip rooms without valid price
            }

            console.log(`[Room ${index}] Successfully extracted: "${roomName}" - ${priceData.finalPrice} ${priceData.currency}`);

            // Extract meal plan
            const mealPlan = extractMealPlan(room);

            // Extract cancellation policy
            const cancellationPolicy = extractCancellationPolicy(room);

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

              // Room details
              bedType: bedType,
              maxOccupancy: maxOccupancy,

              // Availability
              available: availability.isAvailable,
              availability: availability
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

        console.log(`[Scraper] Room extraction complete: ${data.rooms.length} rooms extracted from ${roomBlocks.length} room blocks`);

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
          variantCount: group.variants.length,
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
      });

      await browser.close();

      await updateProgress(90, 'Processing extracted data...');
      console.log("[scrapeBooking] Extracted data:", JSON.stringify(hotelData, null, 2));

      await updateProgress(95, 'Validating data quality...');

      // ===== ENHANCED DATA VALIDATION =====

      const quality = hotelData.extractionQuality;
      const validationErrors = [];
      const validationWarnings = [];

      // Critical validations (must pass)
      if (!hotelData.hotelName) {
        validationErrors.push("Hotel name not found");
      }

      if (!hotelData.rooms || hotelData.rooms.length === 0) {
        if (!hotelData.prices || hotelData.prices.length === 0) {
          validationErrors.push("No rooms or prices extracted");
        } else {
          validationWarnings.push("Found prices but no room details");
        }
      }

      // Check for rooms with valid prices
      const roomsWithValidPrices = hotelData.rooms.filter(r => r.finalPrice && r.finalPrice > 0);
      if (hotelData.rooms.length > 0 && roomsWithValidPrices.length === 0) {
        validationErrors.push("Rooms found but all prices are invalid");
      }

      // Quality warnings (non-critical)
      if (!hotelData.rating) {
        validationWarnings.push("Hotel rating not extracted");
      }

      if (hotelData.rooms.length > 0 && quality.roomsWithMealPlan === 0) {
        validationWarnings.push("No meal plan information extracted");
      }

      if (hotelData.rooms.length > 0 && quality.roomsWithCancellationPolicy === 0) {
        validationWarnings.push("No cancellation policy information extracted");
      }

      // Currency consistency check
      const currencies = [...new Set(hotelData.rooms.map(r => r.currency))];
      if (currencies.length > 1) {
        validationWarnings.push(`Multiple currencies detected: ${currencies.join(', ')}`);
      }

      // Log validation results
      console.log(`[scrapeBooking] Validation results:`, {
        errors: validationErrors.length,
        warnings: validationWarnings.length,
        quality: quality,
        hotelName: !!hotelData.hotelName,
        rooms: hotelData.rooms.length,
        roomGroups: hotelData.roomGroups ? hotelData.roomGroups.length : 0,
        roomsWithValidPrices: roomsWithValidPrices.length
      });

      // Fail if critical validation errors exist
      if (validationErrors.length > 0) {
        throw new Error(
          "Data validation failed: " + validationErrors.join("; ") + ". " +
          "Booking.com page structure may have changed or page did not load properly. " +
          "URL: " + searchUrl
        );
      }

      // Log warnings (non-critical)
      if (validationWarnings.length > 0) {
        console.warn("[scrapeBooking] Data quality warnings:", validationWarnings.join("; "));
      }

      console.log(`[scrapeBooking] ✅ Validation passed with ${validationWarnings.length} warnings`);

      // Return the hotel data to be used outside the retry function
      return { hotelData, searchUrl };
    }; // End of performScraping function

    // Execute scraping with retry logic
    try {
      const { hotelData, searchUrl } = await retryWithBackoff(performScraping, 2, 5000);

      // Save to Firestore cache if cacheKey provided
      if (cacheKey) {
        try {
          await db.collection('competitor_price_cache').doc(cacheKey).set({
            status: 'completed',
            progress: 100,
            message: 'Scraping completed successfully',
            result: hotelData,
            timestamp: Date.now() / 1000, // Convert to seconds for consistency with Python
            url: url,
            checkIn: checkIn || null,
            checkOut: checkOut || null,
            adults: adults,
            children: children,
            rooms: rooms
          });
          console.log("[scrapeBooking] Saved to Firestore cache:", cacheKey);
        } catch (firestoreError) {
          console.error("[scrapeBooking] Failed to save to Firestore:", firestoreError);
          // Don't fail the whole request if Firestore save fails
        }
      }

      // Update batch document if this scrape is part of a batch
      const { batchId, batchIndex } = request.body || {};
      if (batchId && cacheKey) {
        try {
          console.log("[scrapeBooking] Updating batch document:", batchId, "index:", batchIndex);

          const batchRef = db.collection('scraper_batches').doc(batchId);
          const batchDoc = await batchRef.get();

          if (batchDoc.exists) {
            const batchData = batchDoc.data();
            const hotels = batchData.hotels || [];

            // Find hotel by cacheKey
            const hotelIndex = hotels.findIndex(h => h.cacheKey === cacheKey);

            if (hotelIndex !== -1) {
              // Calculate min/max prices from rooms (more accurate than prices array)
              const roomPrices = hotelData.rooms
                ? hotelData.rooms
                    .map(r => r.price)
                    .filter(p => p && p > 0)
                : [];

              // Normalize currency symbol to currency code
              const normalizeCurrency = (curr) => {
                if (!curr) return 'USD';
                const currencyMap = {
                  '$': 'USD',
                  '€': 'EUR',
                  'лв': 'BGN',
                  'BGN': 'BGN',
                  'USD': 'USD',
                  'EUR': 'EUR'
                };
                return currencyMap[curr] || 'USD';
              };

              const rawCurrency = hotelData.rooms && hotelData.rooms[0] ? hotelData.rooms[0].currency : 'USD';

              // Update hotel status
              hotels[hotelIndex] = {
                ...hotels[hotelIndex],
                status: 'completed',
                hotelName: hotelData.hotelName,
                minPrice: roomPrices.length > 0 ? Math.min(...roomPrices) : null,
                maxPrice: roomPrices.length > 0 ? Math.max(...roomPrices) : null,
                currency: normalizeCurrency(rawCurrency),
                rating: hotelData.rating || null,
                roomCount: hotelData.rooms ? hotelData.rooms.length : 0
              };

              // Calculate progress
              const completedHotels = hotels.filter(h => h.status === 'completed').length;
              const failedHotels = hotels.filter(h => h.status === 'error').length;
              const progress = Math.round((completedHotels / batchData.totalHotels) * 100);

              // Check if all done
              const allDone = (completedHotels + failedHotels) >= batchData.totalHotels;
              const newStatus = allDone ? (completedHotels > 0 ? 'completed' : 'error') : 'in_progress';

              // Update batch
              await batchRef.update({
                hotels: hotels,
                completedHotels: completedHotels,
                failedHotels: failedHotels,
                progress: progress,
                status: newStatus,
                updatedAt: Math.floor(Date.now() / 1000)
              });

              console.log("[scrapeBooking] Updated batch:", batchId, "progress:", progress + "%");
            }
          }
        } catch (batchError) {
          console.error("[scrapeBooking] Failed to update batch document:", batchError);
          // Don't fail the whole request if batch update fails
        }
      }

      // Return structured data
      response.json({
        success: true,
        data: hotelData,
        scrapedAt: new Date().toISOString(),
        url: searchUrl
      });

    } catch (error) {
      console.error("[scrapeBooking] Error:", error);

      // Save error to Firestore cache if cacheKey provided
      const { cacheKey: errorCacheKey, url: errorUrl, checkIn: errorCheckIn, checkOut: errorCheckOut, batchId: errorBatchId } = request.body || {};
      if (errorCacheKey) {
        try {
          await db.collection('competitor_price_cache').doc(errorCacheKey).set({
            status: 'error',
            error: error.message,
            timestamp: Date.now() / 1000,
            url: errorUrl,
            checkIn: errorCheckIn || null,
            checkOut: errorCheckOut || null
          });
          console.log("[scrapeBooking] Saved error to Firestore cache:", errorCacheKey);
        } catch (firestoreError) {
          console.error("[scrapeBooking] Failed to save error to Firestore:", firestoreError);
        }
      }

      // Update batch document if error occurred during batch scraping
      if (errorBatchId && errorCacheKey) {
        try {
          console.log("[scrapeBooking] Updating batch with error:", errorBatchId);

          const batchRef = db.collection('scraper_batches').doc(errorBatchId);
          const batchDoc = await batchRef.get();

          if (batchDoc.exists) {
            const batchData = batchDoc.data();
            const hotels = batchData.hotels || [];

            // Find hotel by cacheKey
            const hotelIndex = hotels.findIndex(h => h.cacheKey === errorCacheKey);

            if (hotelIndex !== -1) {
              // Update hotel with error status
              hotels[hotelIndex] = {
                ...hotels[hotelIndex],
                status: 'error',
                error: error.message
              };

              // Calculate progress
              const completedHotels = hotels.filter(h => h.status === 'completed').length;
              const failedHotels = hotels.filter(h => h.status === 'error').length;
              const progress = Math.round((completedHotels / batchData.totalHotels) * 100);

              // Check if all done
              const allDone = (completedHotels + failedHotels) >= batchData.totalHotels;
              const newStatus = allDone ? (completedHotels > 0 ? 'completed' : 'error') : 'in_progress';

              // Update batch
              await batchRef.update({
                hotels: hotels,
                completedHotels: completedHotels,
                failedHotels: failedHotels,
                progress: progress,
                status: newStatus,
                updatedAt: Math.floor(Date.now() / 1000)
              });

              console.log("[scrapeBooking] Updated batch with error:", errorBatchId, "progress:", progress + "%");
            }
          }
        } catch (batchError) {
          console.error("[scrapeBooking] Failed to update batch document with error:", batchError);
        }
      }

      response.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined
      });
    }
  }
);
