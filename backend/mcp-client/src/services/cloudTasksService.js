/**
 * Cloud Tasks Service - Trigger background jobs
 * Used for async embedding generation
 */

import { CloudTasksClient } from '@google-cloud/tasks';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'quendoo-ai-dashboard';
const LOCATION = 'us-central1';
const QUEUE_NAME = 'document-processing';

// Initialize Cloud Tasks client
const client = new CloudTasksClient();

/**
 * Create a Cloud Task to process embeddings in the background
 * @param {string} hotelId - Hotel ID
 * @param {string} documentId - Document ID
 * @param {string} targetUrl - Backend URL for the processing endpoint
 * @returns {Promise<string>} - Task name
 */
export async function createEmbeddingTask(hotelId, documentId, targetUrl) {
  try {
    const parent = client.queuePath(PROJECT_ID, LOCATION, QUEUE_NAME);

    const task = {
      httpRequest: {
        httpMethod: 'POST',
        url: targetUrl,
        headers: {
          'Content-Type': 'application/json'
        },
        body: Buffer.from(JSON.stringify({ hotelId, documentId })).toString('base64')
      },
      // Schedule task to run after 2 seconds (allows upload response to complete first)
      scheduleTime: {
        seconds: Math.floor(Date.now() / 1000) + 2
      }
    };

    const [response] = await client.createTask({ parent, task });

    console.log(`[CloudTasks] Created embedding task: ${response.name}`);
    return response.name;

  } catch (error) {
    console.error('[CloudTasks] Error creating task:', error);

    // If Cloud Tasks not available (local dev), fall back to immediate processing
    if (error.code === 5 || error.message?.includes('NOT_FOUND')) {
      console.warn('[CloudTasks] Queue not found, falling back to direct processing');
      return null; // Caller should handle this
    }

    throw error;
  }
}

/**
 * Trigger embedding processing (with fallback for local development)
 * @param {string} hotelId - Hotel ID
 * @param {string} documentId - Document ID
 * @returns {Promise<void>}
 */
export async function triggerEmbeddingProcessing(hotelId, documentId) {
  try {
    // In production, use Cloud Tasks
    const backendUrl = process.env.BACKEND_URL || 'https://quendoo-backend-222402522800.us-central1.run.app';
    const targetUrl = `${backendUrl}/api/documents/process-embeddings`;

    const taskName = await createEmbeddingTask(hotelId, documentId, targetUrl);

    if (taskName) {
      console.log(`[CloudTasks] Scheduled embedding processing for document ${documentId}`);
    } else {
      // Fallback: Call endpoint directly (for local dev)
      console.log(`[CloudTasks] Fallback: Calling processing endpoint directly`);
      const fetch = (await import('node-fetch')).default;

      // Fire and forget (don't wait for response)
      fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelId, documentId })
      }).catch(err => {
        console.error('[CloudTasks] Fallback processing failed:', err);
      });
    }

  } catch (error) {
    console.error('[CloudTasks] Failed to trigger embedding processing:', error);
    // Don't throw - let upload succeed even if background task fails
  }
}

export default {
  createEmbeddingTask,
  triggerEmbeddingProcessing
};
