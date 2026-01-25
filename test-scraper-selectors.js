/**
 * Test scraper selectors on Booking.com page
 * Run with: node test-scraper-selectors.js
 */

const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

async function testScraperSelectors() {
  console.log('🔍 Testing Booking.com scraper selectors...\n');

  const url = 'https://www.booking.com/hotel/bg/park-madara.bg.html?checkin=2026-08-15&checkout=2026-08-18&group_adults=2&group_children=0&no_rooms=1';

  try {
    console.log('1️⃣ Launching browser...');
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();

    console.log('2️⃣ Navigating to URL...');
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    await page.waitForSelector('body', { timeout: 5000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('3️⃣ Testing selectors...\n');

    // Test room block selectors
    const roomBlockResults = await page.evaluate(() => {
      const selectors = [
        "[data-block-id]",
        ".hprt-table tbody tr",
        ".room-table tbody tr",
        "[data-testid='room-table'] tbody tr",
        ".roomstable tbody tr",
        ".ftb-room-row"
      ];

      const results = {};
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        results[selector] = elements.length;
      });

      return results;
    });

    console.log('📊 Room block selector results:');
    Object.entries(roomBlockResults).forEach(([selector, count]) => {
      console.log(`   ${selector.padEnd(40)} → ${count} elements`);
    });

    // Test if we can extract room data
    const roomData = await page.evaluate(() => {
      // Try the combined selector
      const roomBlocks = document.querySelectorAll([
        "[data-block-id]",
        ".hprt-table tbody tr",
        ".room-table tbody tr",
        "[data-testid='room-table'] tbody tr",
        ".roomstable tbody tr",
        ".ftb-room-row"
      ].join(","));

      console.log(`Found ${roomBlocks.length} room blocks`);

      const rooms = [];
      roomBlocks.forEach((room, index) => {
        // Try to extract room name
        const roomNameSelectors = [
          "[data-testid='room-name']",
          ".hprt-roomtype-link",
          ".room-name",
          ".roomType",
          "[class*='room'][class*='name']"
        ];

        let roomName = null;
        for (const selector of roomNameSelectors) {
          const el = room.querySelector(selector);
          if (el && el.textContent.trim()) {
            roomName = el.textContent.trim();
            break;
          }
        }

        // Try to extract price
        const priceSelectors = [
          "[data-testid='price-and-discounted-price']",
          ".prco-valign-middle-helper",
          ".bui-price-display__value",
          ".prco-text-nowrap-helper",
          "[class*='price'][class*='value']",
          ".room-price"
        ];

        let price = null;
        for (const selector of priceSelectors) {
          const priceEl = room.querySelector(selector);
          if (priceEl && priceEl.textContent.trim()) {
            const priceText = priceEl.textContent.trim();
            const priceMatch = priceText.match(/([\d\s,.]+)/);
            if (priceMatch) {
              price = parseFloat(priceMatch[1].replace(/[\s,]/g, ""));
              break;
            }
          }
        }

        if (roomName || price) {
          rooms.push({
            index,
            roomName: roomName || 'N/A',
            price: price || 'N/A',
            hasName: !!roomName,
            hasPrice: !!price
          });
        }
      });

      return { totalBlocks: roomBlocks.length, rooms };
    });

    console.log(`\n📦 Extraction results:`);
    console.log(`   Total room blocks found: ${roomData.totalBlocks}`);
    console.log(`   Rooms extracted: ${roomData.rooms.length}`);

    if (roomData.rooms.length > 0) {
      console.log(`\n🏨 Sample rooms:`);
      roomData.rooms.slice(0, 5).forEach(room => {
        console.log(`   [${room.index}] ${room.roomName.substring(0, 40)} - ${room.price} (name:${room.hasName}, price:${room.hasPrice})`);
      });
    } else {
      console.log(`\n❌ No rooms extracted!`);

      // Debug: check page structure
      const pageDebug = await page.evaluate(() => {
        return {
          hasTable: !!document.querySelector('table'),
          hasTbody: !!document.querySelector('tbody'),
          hasTr: !!document.querySelectorAll('tr').length,
          bodyText: document.body.textContent.substring(0, 500)
        };
      });

      console.log(`\n🔍 Page structure debug:`);
      console.log(`   Has table: ${pageDebug.hasTable}`);
      console.log(`   Has tbody: ${pageDebug.hasTbody}`);
      console.log(`   Has tr elements: ${pageDebug.hasTr}`);
      console.log(`   Body text preview: ${pageDebug.bodyText.substring(0, 200)}...`);
    }

    await browser.close();
    console.log(`\n✅ Test completed`);

  } catch (error) {
    console.error(`\n❌ Test failed:`, error.message);
    console.error(error.stack);
  }
}

testScraperSelectors();
