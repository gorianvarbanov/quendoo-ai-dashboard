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

      // Extract hotel data
      const hotelData = await page.evaluate(() => {
        // Helper function to try multiple selectors with fallback
        function extractWithFallback(selectors) {
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              return element.textContent.trim();
            }
          }
          return null;
        }

        const data = {
          hotelName: null,
          prices: [],
          rooms: [],
          availability: null,
          rating: null,
          reviews: null
        };

        // Extract hotel name with multiple fallback selectors
        data.hotelName = extractWithFallback([
          "[data-testid='title']",              // New Booking.com
          "h2.pp-header__title",                 // Common variant
          "h1.hp__hotel-name",                   // Old variant 1
          "h2.hp__hotel-name",                   // Old variant 2
          ".hp-header__title",                   // Alternative
          ".pp-header-title",                    // Another variant
          "h1[class*='hotel']",                  // Generic h1 with 'hotel'
          "h1",                                  // Last resort - first h1
        ]);

        // Extract rating with fallback selectors
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
          }
        }

        // Extract number of reviews with fallback
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

        // Extract room prices with multiple selector fallbacks
        const roomBlocks = document.querySelectorAll([
          "[data-block-id]",
          ".hprt-table tbody tr",
          ".room-table tbody tr",
          "[data-testid='room-table'] tbody tr",
          ".roomstable tbody tr",
          ".ftb-room-row"
        ].join(","));
        roomBlocks.forEach(room => {
          try {
            const roomData = {
              name: null,
              price: null,
              currency: null,
              available: true,
              bedType: null,
              maxOccupancy: null
            };

            // Room name with fallback
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
                roomData.name = el.textContent.trim();
                break;
              }
            }

            // Price with fallback
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
              priceElement = room.querySelector(selector);
              if (priceElement && priceElement.textContent.trim()) {
                break;
              }
            }
            if (priceElement) {
              const priceText = priceElement.textContent.trim();
              const priceMatch = priceText.match(/([\d\s,.]+)/);
              if (priceMatch) {
                roomData.price = parseFloat(priceMatch[1].replace(/[\s,]/g, ""));
              }

              // Currency
              const currencyMatch = priceText.match(/([A-Z]{3}|лв\.?|€|\$|£)/i);
              if (currencyMatch) {
                roomData.currency = currencyMatch[1];
              }
            }

            // Bed type
            const bedInfo = room.querySelector(".hprt-lightbox-title, .room-bed-info");
            if (bedInfo) {
              roomData.bedType = bedInfo.textContent.trim();
            }

            // Max occupancy
            const occupancy = room.querySelector(".bui-u-sr-only, [data-testid='max-occupancy']");
            if (occupancy) {
              const match = occupancy.textContent.match(/(\d+)/);
              if (match) {
                roomData.maxOccupancy = parseInt(match[1]);
              }
            }

            if (roomData.name || roomData.price) {
              data.rooms.push(roomData);
            }
          } catch (err) {
            console.error("Error extracting room:", err);
          }
        });

        // Extract prices from summary with fallback selectors
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
              if (price > 0) {
                data.prices.push(price);
              }
            }
          } catch (err) {
            console.error("Error extracting price:", err);
          }
        });

        // Check availability with fallback selectors
        const soldOutSelectors = [
          "[data-sold-out='true']",
          ".sold-out",
          ".unavailable",
          "[class*='soldout']",
          "[class*='not-available']"
        ].join(",");
        const soldOutElements = document.querySelectorAll(soldOutSelectors);
        data.availability = soldOutElements.length === 0 ? "available" : "limited";

        return data;
      });

      await browser.close();

      await updateProgress(90, 'Processing extracted data...');
      console.log("[scrapeBooking] Extracted data:", JSON.stringify(hotelData, null, 2));

      await updateProgress(95, 'Validating data...');

      // ✅ VALIDATE EXTRACTED DATA
      const isValidData = (
        hotelData.hotelName ||
        (hotelData.prices && hotelData.prices.length > 0) ||
        (hotelData.rooms && hotelData.rooms.length > 0)
      );

      if (!isValidData) {
        throw new Error(
          "Failed to extract hotel data - all fields empty. " +
          "Booking.com page structure may have changed or page did not load properly. " +
          "URL: " + searchUrl
        );
      }

      // Quality check warnings
      if (hotelData.rooms.length === 0 && hotelData.prices.length > 0) {
        console.warn("[scrapeBooking] Warning: Found prices but no room details");
      }

      if (!hotelData.hotelName) {
        console.warn("[scrapeBooking] Warning: Could not extract hotel name");
      }

      console.log(`[scrapeBooking] Validation passed: hotelName=${!!hotelData.hotelName}, rooms=${hotelData.rooms.length}, prices=${hotelData.prices.length}`);

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
