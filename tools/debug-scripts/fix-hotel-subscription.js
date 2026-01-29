import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDDq8d2QSp1w_Tl3KpmN8PQEsXqEv_j_pM",
  authDomain: "quendoo-ai-dashboard.firebaseapp.com",
  projectId: "quendoo-ai-dashboard",
  storageBucket: "quendoo-ai-dashboard.firebasestorage.app",
  messagingSenderId: "222402522800",
  appId: "1:222402522800:web:2e3ec7a1a82a7b8f9ab5c4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixSunriseSubscription() {
  console.log('Searching for Sunrise hotel...\n');

  const hotelsRef = collection(db, 'hotels');
  const q = query(hotelsRef, where('name', '==', 'Sunrise'));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    console.log('❌ Sunrise hotel not found!');
    console.log('Searching all hotels...\n');

    const allHotels = await getDocs(collection(db, 'hotels'));
    allHotels.forEach(doc => {
      const data = doc.data();
      console.log(`Hotel: ${data.name} (ID: ${doc.id})`);
      console.log(`  Status: ${data.subscription?.status || 'N/A'}`);
    });
    return;
  }

  for (const hotelDoc of querySnapshot.docs) {
    const hotelData = hotelDoc.data();
    console.log(`Found hotel: ${hotelData.name} (ID: ${hotelDoc.id})`);
    console.log(`Current subscription status: ${hotelData.subscription?.status || 'N/A'}`);

    if (hotelData.subscription?.trialEndsAt) {
      console.log(`Trial ends at: ${hotelData.subscription.trialEndsAt}`);
    }

    console.log('\n🔧 Updating subscription to active...\n');

    await updateDoc(doc(db, 'hotels', hotelDoc.id), {
      'subscription.status': 'active',
      'subscription.plan': 'premium',
      'subscription.trialEndsAt': null,
      'subscription.limits.maxMessagesPerMonth': -1,  // Unlimited
      'subscription.limits.maxConversations': -1,     // Unlimited
      'subscription.updatedAt': new Date().toISOString()
    });

    console.log('✅ Subscription updated successfully!');
    console.log('\nNew subscription:');
    console.log('  Status: active');
    console.log('  Plan: premium');
    console.log('  Max Messages: Unlimited');
    console.log('  Max Conversations: Unlimited');
  }
}

fixSunriseSubscription()
  .then(() => {
    console.log('\n✅ Done! You can now use the chatbot without trial restrictions.');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
