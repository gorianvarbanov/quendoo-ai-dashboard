import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  projectId: 'quendoo-ai-dashboard'
});

const db = getFirestore();

async function checkBatchDetails() {
  try {
    const snapshot = await db.collection('scraper_batches')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('No batches found');
      return;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    
    console.log('Latest batch:', doc.id);
    console.log('Status:', data.status);
    console.log('\nHotels array:');
    console.log(JSON.stringify(data.hotels, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

checkBatchDetails().then(() => process.exit(0));
