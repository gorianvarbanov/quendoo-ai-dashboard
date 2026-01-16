import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  projectId: 'quendoo-ai-dashboard'
});

const db = getFirestore();

async function checkBatches() {
  try {
    console.log('Checking scraper_batches collection...\n');

    const snapshot = await db.collection('scraper_batches')
      .orderBy('timestamp', 'desc')
      .limit(3)
      .get();

    if (snapshot.empty) {
      console.log('❌ No batch documents found');
      return;
    }

    console.log(`✅ Found ${snapshot.size} batch documents:\n`);

    snapshot.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`====== Batch ${idx + 1}: ${doc.id} ======`);
      console.log(`Status: ${data.status}`);
      console.log(`Progress: ${data.progress}%`);
      console.log(`Hotels: ${data.completedHotels}/${data.totalHotels}`);
      console.log(`Failed: ${data.failedHotels || 0}`);
      console.log(`Timestamp: ${new Date(data.timestamp * 1000).toISOString()}`);
      console.log(`Hotels data:`, data.hotels?.map(h => ({
        url: h.url.substring(0, 50),
        status: h.status,
        hotelName: h.hotelName
      })));
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkBatches().then(() => process.exit(0));
