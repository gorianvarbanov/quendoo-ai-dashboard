import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  projectId: 'quendoo-ai-dashboard'
});

const db = getFirestore();

async function checkForECBRates() {
  try {
    // Check for a dedicated exchange_rates or ecb_rates collection
    const possibleNames = [
      'exchange_rates',
      'currency_rates',
      'ecb_rates',
      'rates',
      'currencies',
      'валутни_курсове'
    ];

    console.log('Searching for ECB exchange rate collections...\n');

    for (const name of possibleNames) {
      try {
        const snapshot = await db.collection(name).limit(1).get();
        if (!snapshot.empty) {
          console.log(`✅ Found collection: ${name}`);
          const doc = snapshot.docs[0];
          console.log(`   Sample document: ${doc.id}`);
          console.log(`   Data:`, JSON.stringify(doc.data(), null, 2));
          return;
        }
      } catch (err) {
        // Collection doesn't exist, continue
      }
    }

    // Check if rates are stored in hotels settings or global config
    console.log('Checking hotels collection for embedded rates...');
    const hotelsSnapshot = await db.collection('hotels').limit(1).get();
    if (!hotelsSnapshot.empty) {
      const hotelDoc = hotelsSnapshot.docs[0];
      const data = hotelDoc.data();
      if (data.exchangeRates || data.exchange_rates || data.currencies) {
        console.log('✅ Found exchange rates in hotel document:');
        console.log(JSON.stringify({
          exchangeRates: data.exchangeRates,
          exchange_rates: data.exchange_rates,
          currencies: data.currencies
        }, null, 2));
        return;
      }
    }

    console.log('\n❌ No ECB exchange rate data found in Firestore');
    console.log('The exchange rates are currently hardcoded in the frontend components.');

  } catch (error) {
    console.error('Error:', error);
  }
}

checkForECBRates().then(() => process.exit(0));
