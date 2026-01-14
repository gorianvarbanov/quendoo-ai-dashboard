import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  projectId: 'quendoo-ai-dashboard'
});

const db = getFirestore();

async function checkLatest() {
  try {
    // Get the most recent document
    const snapshot = await db.collection('competitor_price_cache')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('No documents found');
      return;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    console.log(`\n====== Latest Cache Document ======`);
    console.log(`Cache Key: ${doc.id}`);
    console.log(`Status: ${data.status}`);
    console.log(`Progress: ${data.progress}%`);
    console.log(`Timestamp: ${new Date(data.timestamp * 1000).toISOString()}`);
    console.log(`\n====== Result Data ======`);

    if (data.result) {
      console.log(JSON.stringify(data.result, null, 2));
    } else {
      console.log('No result data');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkLatest().then(() => process.exit(0));
