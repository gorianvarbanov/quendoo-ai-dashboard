/**
 * Migration Script: Add language and customPrompt fields to existing hotels
 *
 * This script updates all hotels in Firestore to include:
 * - language: 'bg' (default for Bulgarian hotels)
 * - customPrompt: '' (empty by default)
 *
 * Only updates hotels that don't already have these fields.
 */

import { getFirestore } from '../db/firestore.js';

async function migrateHotelSettings() {
  console.log('[Migration] Starting hotel settings migration...');

  try {
    const db = await getFirestore();
    const hotelsSnapshot = await db.collection('hotels').get();

    console.log(`[Migration] Found ${hotelsSnapshot.size} hotels`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const doc of hotelsSnapshot.docs) {
      const hotelData = doc.data();
      const hotelId = doc.id;

      try {
        // Check if hotel already has language and customPrompt fields
        const hasLanguage = hotelData.language !== undefined;
        const hasCustomPrompt = hotelData.customPrompt !== undefined;

        if (hasLanguage && hasCustomPrompt) {
          console.log(`[Migration] Hotel ${hotelId} (${hotelData.hotelName}) already has settings, skipping`);
          skippedCount++;
          continue;
        }

        // Prepare update data
        const updateData = {};

        if (!hasLanguage) {
          // Default to Bulgarian since most hotels are Bulgarian
          updateData.language = 'bg';
        }

        if (!hasCustomPrompt) {
          updateData.customPrompt = '';
        }

        // Add updatedAt timestamp
        updateData.updatedAt = new Date().toISOString();

        // Update hotel document
        await db.collection('hotels').doc(hotelId).update(updateData);

        console.log(`[Migration] ✓ Updated hotel ${hotelId} (${hotelData.hotelName}):`, updateData);
        updatedCount++;

      } catch (error) {
        console.error(`[Migration] ✗ Error updating hotel ${hotelId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n[Migration] Migration completed!');
    console.log(`  ✓ Updated: ${updatedCount} hotels`);
    console.log(`  - Skipped: ${skippedCount} hotels (already had settings)`);
    console.log(`  ✗ Errors: ${errorCount} hotels`);

    if (errorCount === 0) {
      console.log('\n[Migration] SUCCESS: All hotels migrated successfully! 🎉');
    } else {
      console.log('\n[Migration] WARNING: Some hotels failed to migrate. Check errors above.');
    }

  } catch (error) {
    console.error('[Migration] Fatal error:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
migrateHotelSettings();
