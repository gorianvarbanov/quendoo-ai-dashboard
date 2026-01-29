import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./backend/mcp-client/serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkHotelSubscriptions() {
  console.log('Hotel Subscriptions:');
  console.log('====================\n');

  const hotelsSnapshot = await db.collection('hotels').get();

  for (const doc of hotelsSnapshot.docs) {
    const data = doc.data();
    console.log(`Hotel ID: ${doc.id}`);
    console.log(`Name: ${data.name || 'N/A'}`);
    console.log(`Email: ${data.email || 'N/A'}`);

    if (data.subscription) {
      console.log('\nSubscription:');
      console.log(`  Status: ${data.subscription.status}`);
      console.log(`  Plan: ${data.subscription.plan || 'N/A'}`);

      if (data.subscription.trialEndsAt) {
        const trialEnd = new Date(data.subscription.trialEndsAt);
        const now = new Date();
        const expired = now > trialEnd;

        console.log(`  Trial Ends: ${trialEnd.toISOString()}`);
        console.log(`  Current Time: ${now.toISOString()}`);
        console.log(`  Trial Expired: ${expired ? '❌ YES' : '✅ NO'}`);
      }

      if (data.subscription.limits) {
        console.log('\n  Limits:');
        console.log(`    Max Messages/Month: ${data.subscription.limits.maxMessagesPerMonth}`);
        console.log(`    Max Conversations: ${data.subscription.limits.maxConversations}`);
      }

      if (data.subscription.usage) {
        console.log('\n  Usage:');
        console.log(`    Messages This Month: ${data.subscription.usage.messagesThisMonth}`);
        console.log(`    Conversations: ${data.subscription.usage.conversations}`);
      }
    } else {
      console.log('Subscription: None');
    }

    console.log('\n' + '='.repeat(50) + '\n');
  }
}

checkHotelSubscriptions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
