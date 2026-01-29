import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  projectId: 'quendoo-ai-dashboard'
});

const db = getFirestore();

async function checkSingleScrape() {
  try {
    const snapshot = await db.collection('competitor_price_cache')
      .where('status', '==', 'completed')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('No completed scrapes found');
      return;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    
    console.log('Latest single scrape:', doc.id);
    console.log('Status:', data.status);
    console.log('URL:', data.url);
    console.log('CheckIn:', data.checkIn);
    console.log('CheckOut:', data.checkOut);
    console.log('Adults:', data.adults);
    console.log('Children:', data.children);
    console.log('Rooms:', data.rooms);
    console.log('\nResult data:', JSON.stringify(data.result, null, 2).substring(0, 500));
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSingleScrape().then(() => process.exit(0));
