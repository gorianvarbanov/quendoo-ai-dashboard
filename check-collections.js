import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  projectId: 'quendoo-ai-dashboard'
});

const db = getFirestore();

async function listCollections() {
  try {
    const collections = await db.listCollections();
    console.log('Firestore Collections:');
    console.log('=====================');
    collections.forEach(collection => {
      console.log(`- ${collection.id}`);
    });

    // Check specifically for currency/exchange rate collections
    const currencyPatterns = ['currency', 'exchange', 'rate', 'ecb', 'валути'];
    console.log('\n\nChecking for currency-related collections:');
    const found = collections.filter(col =>
      currencyPatterns.some(pattern => col.id.toLowerCase().includes(pattern))
    );

    if (found.length > 0) {
      console.log('Found currency collections:');
      found.forEach(col => console.log(`  ✅ ${col.id}`));

      // Get sample documents from each
      for (const col of found) {
        console.log(`\n--- Sample from ${col.id} ---`);
        const snapshot = await db.collection(col.id).limit(3).get();
        snapshot.forEach(doc => {
          console.log(`Document: ${doc.id}`);
          console.log(JSON.stringify(doc.data(), null, 2));
        });
      }
    } else {
      console.log('❌ No currency-related collections found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

listCollections().then(() => process.exit(0));
