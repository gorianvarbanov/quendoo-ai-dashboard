/**
 * Test script to simulate file upload
 * This helps debug the upload timeout issue
 */

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testUpload() {
  console.log('[TestUpload] Starting file upload test...');

  // Create a test Excel file path (use any test file)
  const testFilePath = path.join(__dirname, 'test-file.txt');

  // Create a simple test file if it doesn't exist
  if (!fs.existsSync(testFilePath)) {
    console.log('[TestUpload] Creating test file...');
    fs.writeFileSync(testFilePath, 'Test document content for upload simulation\nLine 2\nLine 3');
  }

  try {
    // Step 1: Get auth token (login as test hotel)
    console.log('\n[TestUpload] Step 1: Getting auth token...');

    // For testing, we'll use a mock hotel token
    // In production, this would come from the login flow
    const mockHotelToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJob3RlbElkIjoiaG90ZWxfdGVzdF8xMjM0NTYiLCJpYXQiOjE2MzcxMjM0NTZ9.test';

    // Step 2: Prepare form data
    console.log('[TestUpload] Step 2: Preparing form data...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath), {
      filename: 'test-file.txt',
      contentType: 'text/plain'
    });
    formData.append('documentType', 'chat_attachment');
    formData.append('description', 'Test upload via simulation script');
    formData.append('tags', JSON.stringify(['test', 'simulation']));

    // Step 3: Upload file
    console.log('[TestUpload] Step 3: Uploading file to backend...');
    console.log('[TestUpload] URL: http://localhost:3100/api/documents/upload');
    console.log('[TestUpload] Timeout: 120 seconds');

    const startTime = Date.now();

    const response = await fetch('http://localhost:3100/api/documents/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mockHotelToken}`,
        ...formData.getHeaders()
      },
      body: formData,
      timeout: 120000 // 2 minutes
    });

    const elapsed = Date.now() - startTime;
    console.log(`[TestUpload] Request completed in ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)`);

    // Step 4: Check response
    const responseData = await response.json();
    console.log('[TestUpload] Response status:', response.status);
    console.log('[TestUpload] Response data:', JSON.stringify(responseData, null, 2));

    if (response.status === 200 && responseData.success) {
      console.log('\n✅ [TestUpload] Upload successful!');
      console.log('   Document ID:', responseData.document.id);
      console.log('   File name:', responseData.document.fileName);
      console.log('   Chunks count:', responseData.document.chunksCount);
    } else {
      console.log('\n❌ [TestUpload] Upload failed!');
      console.log('   Error:', responseData.error);
    }

  } catch (error) {
    console.error('\n❌ [TestUpload] Test failed with error:');
    console.error('   Error type:', error.name);
    console.error('   Error message:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Backend is not running. Start it with: npm run dev');
    } else if (error.name === 'AbortError' || error.message.includes('timeout')) {
      console.error('\n💡 Request timed out after 120 seconds');
      console.error('   This suggests the backend is taking too long to process the file');
    }
  }
}

// Run test
testUpload();
