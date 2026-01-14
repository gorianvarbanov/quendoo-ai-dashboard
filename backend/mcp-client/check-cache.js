import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
initializeApp({
  projectId: 'quendoo-ai-dashboard'
});

const db = getFirestore();

async function checkCache() {
  try {
    console.log('Checking competitor_price_cache collection...\n');

    const snapshot = await db.collection('competitor_price_cache')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();

    if (snapshot.empty) {
      console.log('❌ No documents found in competitor_price_cache collection');
      return;
    }

    console.log(`✅ Found ${snapshot.size} recent cache documents:\n`);

    snapshot.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`\n====== Document ${idx + 1}: ${doc.id} ======`);
      console.log(`Status: ${data.status}`);
      console.log(`Progress: ${data.progress}%`);
      console.log(`Message: ${data.message || 'N/A'}`);
      console.log(`Timestamp: ${new Date(data.timestamp * 1000).toISOString()}`);

      if (data.result) {
        console.log(`✅ HAS RESULT DATA`);
        if (data.result.hotels) {
          console.log(`  - Hotels found: ${data.result.hotels.length}`);
          data.result.hotels.slice(0, 2).forEach((hotel, i) => {
            console.log(`  - Hotel ${i + 1}: ${hotel.name} - ${hotel.price || 'N/A'}`);
          });
        }
        if (data.result.url) {
          console.log(`  - Source URL: ${data.result.url.substring(0, 60)}...`);
        }
      } else {
        console.log(`⚠️ NO RESULT DATA YET (may still be scraping)`);
      }

      if (data.error) {
        console.log(`❌ ERROR: ${data.error}`);
      }
    });

    console.log('\n');

  } catch (error) {
    console.error('Error reading Firestore:', error);
    console.error(error.stack);
  }
}

checkCache().then(() => process.exit(0));
