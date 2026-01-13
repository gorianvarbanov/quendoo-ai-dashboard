/**
 * Scheduled Tasks API Routes
 *
 * Endpoints for managing scheduled automation tasks
 */

import express from 'express';
import fetch from 'node-fetch';
import { Timestamp } from 'firebase-admin/firestore';
import { getFirestore } from '../db/firestore.js';

const router = express.Router();

/**
 * Get all tasks for a hotel
 * GET /api/tasks
 * Uses hotelId from JWT token
 */
router.get('/', async (req, res) => {
  try {
    // Get hotelId from JWT token (set by requireHotelAuth middleware)
    const hotelId = req.hotelId;

    if (!hotelId) {
      return res.status(400).json({ error: 'Missing hotelId parameter' });
    }

    const snapshot = await getFirestore()
      .collection('scheduled_tasks')
      .where('hotelId', '==', hotelId)
      .orderBy('createdAt', 'desc')
      .get();

    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ tasks });
  } catch (error) {
    console.error('[Tasks] Error getting tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a specific task by ID
 * GET /api/cron-jobs/:taskId
 */
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    const taskDoc = await getFirestore().collection('scheduled_tasks').doc(taskId).get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get execution history
    const historySnapshot = await getFirestore()
      .collection('task_history')
      .where('taskId', '==', taskId)
      .orderBy('executedAt', 'desc')
      .limit(20)
      .get();

    const history = historySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      job: { id: taskDoc.id, ...taskDoc.data() },
      history
    });
  } catch (error) {
    console.error('[Tasks] Error getting task:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new task
 * POST /api/cron-jobs
 * Body: { hotelId, name, description, schedule, action, enabled }
 */
router.post('/', async (req, res) => {
  try {
    // Get hotelId from JWT token (set by requireHotelAuth middleware)
    const hotelId = req.hotelId;
    const { name, description, schedule, action, actions, enabled = true } = req.body;

    // Support both single action and multi-step actions
    const taskActions = actions || (action ? [action] : null);

    // Validation
    if (!hotelId) {
      return res.status(401).json({ error: 'Unauthorized - missing hotel authentication' });
    }

    if (!name || !schedule || !taskActions) {
      return res.status(400).json({
        error: 'Missing required fields: name, schedule, actions'
      });
    }

    // Validate all actions
    for (const act of taskActions) {
      if (!act.type || !['mcp_tool', 'api_call'].includes(act.type)) {
        return res.status(400).json({
          error: 'Invalid action type. Must be "mcp_tool" or "api_call"'
        });
      }
    }

    // Calculate next run time (simplified)
    const now = new Date();
    const nextRun = new Date(now.getTime() + 60000); // Start in 1 minute

    const taskData = {
      hotelId,
      name,
      description: description || '',
      schedule,
      actions: taskActions,  // Store as actions array
      enabled,
      lastRun: null,
      nextRun: nextRun.toISOString(),
      lastStatus: null,
      createdAt: Timestamp.now().toDate().toISOString(),
      createdBy: req.user?.uid || 'system'
    };

    const docRef = await getFirestore().collection('scheduled_tasks').add(taskData);

    console.log(`[Tasks] Created new task: ${docRef.id}`);

    res.status(201).json({
      id: docRef.id,
      ...taskData
    });
  } catch (error) {
    console.error('[Tasks] Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update a task
 * PUT /api/cron-jobs/:taskId
 * Body: { name, description, schedule, action, enabled }
 */
router.put('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { name, description, schedule, action, enabled } = req.body;

    const taskDoc = await getFirestore().collection('scheduled_tasks').doc(taskId).get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (schedule !== undefined) updateData.schedule = schedule;
    if (action !== undefined) updateData.action = action;
    if (enabled !== undefined) updateData.enabled = enabled;

    updateData.updatedAt = Timestamp.now().toDate().toISOString();

    await getFirestore().collection('scheduled_tasks').doc(taskId).update(updateData);

    console.log(`[Tasks] Updated task: ${taskId}`);

    const updated = await getFirestore().collection('scheduled_tasks').doc(taskId).get();

    res.json({
      id: updated.id,
      ...updated.data()
    });
  } catch (error) {
    console.error('[Tasks] Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a task
 * DELETE /api/cron-jobs/:taskId
 */
router.delete('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    const taskDoc = await getFirestore().collection('scheduled_tasks').doc(taskId).get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await getFirestore().collection('scheduled_tasks').doc(taskId).delete();

    console.log(`[Tasks] Deleted task: ${taskId}`);

    res.json({ success: true, taskId });
  } catch (error) {
    console.error('[Tasks] Error deleting task:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Toggle task enabled status
 * POST /api/cron-jobs/:taskId/toggle
 */
router.post('/:taskId/toggle', async (req, res) => {
  try {
    const { taskId } = req.params;

    const taskDoc = await getFirestore().collection('scheduled_tasks').doc(taskId).get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const currentTask = taskDoc.data();
    const newEnabled = !currentTask.enabled;

    await getFirestore().collection('scheduled_tasks').doc(taskId).update({
      enabled: newEnabled,
      updatedAt: Timestamp.now().toDate().toISOString()
    });

    console.log(`[Tasks] Toggled task ${taskId}: enabled=${newEnabled}`);

    res.json({
      id: taskId,
      enabled: newEnabled
    });
  } catch (error) {
    console.error('[Tasks] Error toggling task:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manually execute a task now
 * POST /api/cron-jobs/:taskId/execute
 */
router.post('/:taskId/execute', async (req, res) => {
  try {
    const { taskId } = req.params;

    const taskDoc = await getFirestore().collection('scheduled_tasks').doc(taskId).get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Call Cloud Function to execute the task
    const functionUrl = process.env.CRON_EXECUTOR_URL ||
      'https://us-central1-quendoo-ai-dashboard.cloudfunctions.net/executeCronJob_http';

    console.log(`[Tasks] Triggering manual execution for task: ${taskId}`);

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId })
    });

    if (!response.ok) {
      throw new Error(`Function call failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    res.json(result);
  } catch (error) {
    console.error('[Tasks] Error executing task:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
