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
    const hotelId = req.hotel?.hotelId;

    if (!hotelId) {
      return res.status(400).json({ error: 'Missing hotelId parameter' });
    }

    const db = await getFirestore();
    const snapshot = await db
      .collection('scheduled_tasks')
      .where('hotelId', '==', hotelId)
      .get();

    // Sort in memory while Firestore index is being built
    const sortedDocs = snapshot.docs.sort((a, b) => {
      const aDate = new Date(a.data().createdAt || 0);
      const bDate = new Date(b.data().createdAt || 0);
      return bDate - aDate; // Descending order
    });

    const tasks = sortedDocs.map(doc => ({
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

    const db = await getFirestore();
    const taskDoc = await db.collection('scheduled_tasks').doc(taskId).get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get execution history
    const historySnapshot = await db
      .collection('task_history')
      .where('taskId', '==', taskId)
      .get();

    // Sort in memory and limit to 20
    const sortedHistory = historySnapshot.docs
      .sort((a, b) => {
        const aDate = new Date(a.data().executedAt || 0);
        const bDate = new Date(b.data().executedAt || 0);
        return bDate - aDate; // Descending order
      })
      .slice(0, 20);

    const history = sortedHistory.map(doc => ({
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
    const hotelId = req.hotel?.hotelId;
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
    for (let i = 0; i < taskActions.length; i++) {
      const act = taskActions[i];

      // Log for debugging
      console.log(`[Tasks] Validating action ${i}:`, JSON.stringify(act, null, 2));

      if (!act.type || !['mcp_tool', 'api_call'].includes(act.type)) {
        return res.status(400).json({
          error: `Invalid action type at index ${i}. Must be "mcp_tool" or "api_call". Received: ${act.type}`,
          action: act
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

    const db = await getFirestore();
    const docRef = await db.collection('scheduled_tasks').add(taskData);

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
 * Body: { name, description, schedule, actions, enabled }
 */
router.put('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { name, description, schedule, action, actions, enabled } = req.body;

    const db = await getFirestore();
    const taskDoc = await db.collection('scheduled_tasks').doc(taskId).get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (schedule !== undefined) updateData.schedule = schedule;

    // Support both single action and multi-step actions
    if (actions !== undefined) {
      updateData.actions = actions;
    } else if (action !== undefined) {
      updateData.actions = [action];
    }

    if (enabled !== undefined) updateData.enabled = enabled;

    updateData.updatedAt = Timestamp.now().toDate().toISOString();

    await db.collection('scheduled_tasks').doc(taskId).update(updateData);

    console.log(`[Tasks] Updated task: ${taskId}`);

    const updated = await db.collection('scheduled_tasks').doc(taskId).get();

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

    const db = await getFirestore();
    const taskDoc = await db.collection('scheduled_tasks').doc(taskId).get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await db.collection('scheduled_tasks').doc(taskId).delete();

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

    const db = await getFirestore();
    const taskDoc = await db.collection('scheduled_tasks').doc(taskId).get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const currentTask = taskDoc.data();
    const newEnabled = !currentTask.enabled;

    await db.collection('scheduled_tasks').doc(taskId).update({
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
 * POST /api/tasks/:taskId/execute
 */
router.post('/:taskId/execute', async (req, res) => {
  try {
    const { taskId } = req.params;

    const db = await getFirestore();
    const taskDoc = await db.collection('scheduled_tasks').doc(taskId).get();

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

/**
 * Get logs for a specific task
 * GET /api/tasks/:taskId/logs?executionId=xxx&level=info&limit=100
 */
router.get('/:taskId/logs', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { executionId, level, limit = 100 } = req.query;

    const db = await getFirestore();
    let query = db.collection('task_logs').where('taskId', '==', taskId);

    // Filter by execution ID if provided
    if (executionId) {
      query = query.where('executionId', '==', executionId);
    }

    // Filter by level if provided
    if (level) {
      query = query.where('level', '==', level);
    }

    // Get logs (we'll sort in memory since Firestore index might not be ready)
    const snapshot = await query.get();

    // Sort by timestamp descending
    const sortedDocs = snapshot.docs.sort((a, b) => {
      const aDate = new Date(a.data().timestamp || 0);
      const bDate = new Date(b.data().timestamp || 0);
      return bDate - aDate; // Descending order
    });

    // Apply limit
    const limitedDocs = sortedDocs.slice(0, parseInt(limit));

    const logs = limitedDocs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ logs, total: snapshot.size });
  } catch (error) {
    console.error('[Tasks] Error getting task logs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get logs for a specific execution
 * GET /api/tasks/executions/:executionId/logs
 */
router.get('/executions/:executionId/logs', async (req, res) => {
  try {
    const { executionId } = req.params;
    const { level } = req.query;

    const db = await getFirestore();
    let query = db.collection('task_logs').where('executionId', '==', executionId);

    // Filter by level if provided
    if (level) {
      query = query.where('level', '==', level);
    }

    const snapshot = await query.get();

    // Sort by timestamp and step
    const sortedDocs = snapshot.docs.sort((a, b) => {
      const aData = a.data();
      const bData = b.data();

      // First sort by step
      if (aData.step !== bData.step) {
        return aData.step - bData.step;
      }

      // Then by timestamp
      const aDate = new Date(aData.timestamp || 0);
      const bDate = new Date(bData.timestamp || 0);
      return aDate - bDate; // Ascending order for execution flow
    });

    const logs = sortedDocs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ logs, total: logs.length, executionId });
  } catch (error) {
    console.error('[Tasks] Error getting execution logs:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
