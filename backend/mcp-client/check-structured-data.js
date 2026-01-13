/**
 * Check if Excel file has structuredData in Firestore
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkStructuredData() {
  try {
    const hotelId = 'hotel_9ce94bc37976';
    const fileName = 'export-20260110-163315.xlsx';

    console.log(`Checking structuredData for: ${fileName}`);
    console.log('='.repeat(80));

    const docsRef = db.collection(hotelId).doc('documents').collection('hotel_documents');
    const snapshot = await docsRef.where('fileName', '==', fileName).get();

    if (snapshot.empty) {
      console.log('❌ Document not found!');
      return;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    console.log(`\n✅ Document found: ${doc.id}`);
    console.log(`   File: ${data.fileName}`);
    console.log(`   MIME: ${data.mimeType}`);
    console.log(`   Size: ${data.fileSize} bytes`);

    // Check for structuredData
    if (!data.structuredData) {
      console.log('\n❌ NO structuredData field!');
      return;
    }

    console.log('\n✅ structuredData exists');

    const structured = data.structuredData;
    if (structured.excel) {
      const excel = structured.excel;
      console.log(`\n📊 Excel Data:`);
      console.log(`   Headers: ${excel.headers?.length || 0} columns`);
      console.log(`   Rows: ${excel.rows?.length || 0} records`);

      if (excel.headers && excel.headers.length > 0) {
        console.log(`\n   First 10 headers:`);
        excel.headers.slice(0, 10).forEach((header, i) => {
          console.log(`     ${i + 1}. ${header}`);
        });
      }

      if (excel.rows && excel.rows.length > 0) {
        console.log(`\n   First row data:`);
        const firstRow = excel.rows[0];
        excel.headers.slice(0, 10).forEach((header, i) => {
          console.log(`     ${header}: ${firstRow[i]}`);
        });

        // Check for reservation numbers
        const reservationColIndex = excel.headers.findIndex(h =>
          h.includes('Резервация') || h.includes('Reservation')
        );

        if (reservationColIndex >= 0) {
          console.log(`\n   Reservation column: "${excel.headers[reservationColIndex]}" (index ${reservationColIndex})`);

          // Get all reservation numbers
          const reservations = excel.rows.map(row => row[reservationColIndex]).filter(Boolean);
          const numeric = reservations.filter(r => !isNaN(parseFloat(r)));

          console.log(`   Total reservations: ${reservations.length}`);
          console.log(`   Numeric values: ${numeric.length}`);

          if (numeric.length > 0) {
            const sorted = numeric.map(r => parseFloat(r)).sort((a, b) => b - a);
            console.log(`\n   Highest 5:`);
            sorted.slice(0, 5).forEach((num, i) => {
              console.log(`     ${i + 1}. ${num}`);
            });

            console.log(`\n   Lowest 5:`);
            sorted.slice(-5).reverse().forEach((num, i) => {
              console.log(`     ${i + 1}. ${num}`);
            });
          }
        } else {
          console.log('\n   ⚠️ No reservation number column found!');
        }
      }
    } else {
      console.log('\n❌ No excel data in structuredData!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkStructuredData();
