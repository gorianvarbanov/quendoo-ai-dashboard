const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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
      console.log(`Document ${idx + 1}: ${doc.id}`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Progress: ${data.progress}%`);
      console.log(`  Message: ${data.message}`);
      console.log(`  Timestamp: ${new Date(data.timestamp * 1000).toISOString()}`);

      if (data.result) {
        console.log(`  ✅ Has result data`);
        if (data.result.hotels) {
          console.log(`  Hotels found: ${data.result.hotels.length}`);
        }
      } else {
        console.log(`  ⚠️ No result data yet`);
      }

      if (data.error) {
        console.log(`  ❌ Error: ${data.error}`);
      }

      console.log('');
    });

  } catch (error) {
    console.error('Error reading Firestore:', error);
  }
}

checkCache();
