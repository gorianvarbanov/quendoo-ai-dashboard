/**
 * Inspect newly uploaded Excel document to verify enriched text
 */

import admin from 'firebase-admin';

admin.initializeApp({
  projectId: 'quendoo-ai-dashboard'
});

const db = admin.firestore();

async function inspectNewUpload() {
  try {
    const hotelId = 'hotel_9ce94bc37976';

    console.log(`\n=== Inspecting latest Excel upload for hotel: ${hotelId} ===\n`);

    const documentsRef = db.collection(hotelId).doc('documents').collection('hotel_documents');

    // Get all documents and filter in memory (to avoid index requirement)
    const allDocs = await documentsRef.get();

    const excelDocs = allDocs.docs
      .filter(doc => {
        const data = doc.data();
        return data.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
               data.mimeType === 'application/vnd.ms-excel';
      })
      .sort((a, b) => {
        const aTime = a.data().createdAt?.toMillis() || 0;
        const bTime = b.data().createdAt?.toMillis() || 0;
        return bTime - aTime; // Newest first
      });

    const snapshot = { empty: excelDocs.length === 0, docs: excelDocs };

    if (snapshot.empty) {
      console.log('❌ No Excel documents found');
      process.exit(0);
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    console.log('📄 Latest Excel Document:');
    console.log(`   ID: ${doc.id}`);
    console.log(`   File: ${data.fileName}`);
    console.log(`   Created: ${data.createdAt?.toDate?.()?.toLocaleString() || 'N/A'}`);
    console.log(`   Chunks: ${data.chunksCount}`);
    console.log(`   Size: ${(data.fileSize / 1024).toFixed(2)} KB\n`);

    // Check first 1000 chars of fullText
    console.log('📝 Full Text Preview (first 1000 chars):\n');
    console.log(data.fullText.substring(0, 1000));
    console.log('\n...(truncated)\n');

    // Check if it has enriched text format
    const hasEnrichedFormat = data.fullText.includes('|') &&
                             !data.fullText.includes('| --- |');

    console.log('🔍 Format Analysis:');
    console.log(`   Has markdown table: ${data.fullText.includes('| --- |') ? 'YES ❌' : 'NO ✅'}`);
    console.log(`   Has enriched text (pipe-separated): ${hasEnrichedFormat ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Has labels (e.g., "Резервация номер:"): ${data.fullText.includes('Резервация номер:') ? 'YES ✅' : 'NO ❌'}`);

    // Get first chunk to verify
    console.log('\n📦 First Chunk:');
    const chunksSnapshot = await doc.ref.collection('chunks').orderBy('chunkIndex').limit(1).get();

    if (!chunksSnapshot.empty) {
      const chunkData = chunksSnapshot.docs[0].data();
      console.log('\nChunk Text:');
      console.log('─'.repeat(80));
      console.log(chunkData.text);
      console.log('─'.repeat(80));
    }

    // Check structured data
    if (data.structuredData?.excel) {
      console.log('\n📊 Structured Data:');
      console.log(`   Sheets: ${data.structuredData.excel.sheetsCount}`);
      console.log(`   Type: ${data.structuredData.excel.type}`);

      const sheetNames = Object.keys(data.structuredData.excel.sheets || {});
      if (sheetNames.length > 0) {
        const firstSheet = data.structuredData.excel.sheets[sheetNames[0]];
        console.log(`   First sheet: ${sheetNames[0]}`);
        console.log(`   Records: ${firstSheet.recordCount}`);
        console.log(`   Fields: ${firstSheet.schema?.length || 0}`);
      }
    }

    console.log('\n✅ Inspection complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

inspectNewUpload();
