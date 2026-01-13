/**
 * Task Executor
 *
 * Handles execution of scheduled multi-step tasks:
 * - MCP tool calls
 * - API requests
 * - Sequential step execution with result passing
 */

import fetch from 'node-fetch';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

/**
 * Parse cron expression to get next run time
 * Simple implementation for common patterns
 */
function getNextRunTime(schedule) {
  const now = new Date();

  // Parse basic cron expressions
  // Format: "minute hour day month dayOfWeek"
  // Examples:
  // "0 9 * * *" = daily at 9:00 AM
  // "*/15 * * * *" = every 15 minutes
  // "0 8 * * 1" = every Monday at 8:00 AM

  const parts = schedule.split(' ');
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: ${schedule}`);
  }

  const [minute, hour, day, month, dayOfWeek] = parts;

  const next = new Date(now);

  // Handle hourly patterns (*/N)
  if (minute.startsWith('*/')) {
    const interval = parseInt(minute.substring(2));
    const currentMinute = now.getMinutes();
    const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval;

    if (nextMinute >= 60) {
      next.setHours(next.getHours() + 1);
      next.setMinutes(0);
    } else {
      next.setMinutes(nextMinute);
    }
    next.setSeconds(0);
    next.setMilliseconds(0);
    return next.toISOString();
  }

  // Handle daily patterns (0 9 * * *)
  if (minute !== '*' && hour !== '*' && day === '*' && month === '*' && dayOfWeek === '*') {
    next.setHours(parseInt(hour));
    next.setMinutes(parseInt(minute));
    next.setSeconds(0);
    next.setMilliseconds(0);

    // If time has passed today, schedule for tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next.toISOString();
  }

  // Handle weekly patterns (0 8 * * 1)
  if (minute !== '*' && hour !== '*' && day === '*' && month === '*' && dayOfWeek !== '*') {
    const targetDay = parseInt(dayOfWeek);
    const currentDay = now.getDay();

    next.setHours(parseInt(hour));
    next.setMinutes(parseInt(minute));
    next.setSeconds(0);
    next.setMilliseconds(0);

    // Calculate days until target day
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0 || (daysToAdd === 0 && next <= now)) {
      daysToAdd += 7;
    }

    next.setDate(next.getDate() + daysToAdd);
    return next.toISOString();
  }

  // For complex patterns, just add 1 day as fallback
  next.setDate(next.getDate() + 1);
  return next.toISOString();
}

/**
 * Check if a cron task should run now
 */
function shouldRunNow(task) {
  const now = new Date();
  const nextRun = task.nextRun ? new Date(task.nextRun) : null;

  if (!nextRun) return true; // First run

  return now >= nextRun;
}

/**
 * Replace template variables in parameters
 * {TODAY} -> 2026-01-11
 * {TODAY+7} -> 2026-01-18
 * {TODAY-7} -> 2026-01-04
 * {HOTEL_ID} -> hotel ID from task
 * {TASK_NAME} -> task name
 * {RESULT} -> result from previous step
 */
function replaceTemplateVars(params, task, previousResult = null) {
  const result = {};
  const today = new Date();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      let replaced = value;

      // {TODAY}
      if (replaced.includes('{TODAY}')) {
        const todayStr = today.toISOString().split('T')[0];
        replaced = replaced.replace(/{TODAY}/g, todayStr);
      }

      // {TODAY+N}
      const todayPlusMatches = replaced.matchAll(/\{TODAY\+(\d+)\}/g);
      for (const match of todayPlusMatches) {
        const days = parseInt(match[1]);
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + days);
        const futureDateStr = futureDate.toISOString().split('T')[0];
        replaced = replaced.replace(match[0], futureDateStr);
      }

      // {TODAY-N}
      const todayMinusMatches = replaced.matchAll(/\{TODAY-(\d+)\}/g);
      for (const match of todayMinusMatches) {
        const days = parseInt(match[1]);
        const pastDate = new Date(today);
        pastDate.setDate(pastDate.getDate() - days);
        const pastDateStr = pastDate.toISOString().split('T')[0];
        replaced = replaced.replace(match[0], pastDateStr);
      }

      // {HOTEL_ID}
      if (replaced.includes('{HOTEL_ID}')) {
        replaced = replaced.replace(/{HOTEL_ID}/g, task.hotelId);
      }

      // {TASK_NAME}
      if (replaced.includes('{TASK_NAME}')) {
        replaced = replaced.replace(/{TASK_NAME}/g, task.name || 'Unnamed Task');
      }

      // {RESULT} - result from previous step
      if (replaced.includes('{RESULT}') && previousResult !== null) {
        const resultStr = typeof previousResult === 'string'
          ? previousResult
          : JSON.stringify(previousResult, null, 2);
        replaced = replaced.replace(/{RESULT}/g, resultStr);
      }

      result[key] = replaced;
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Execute MCP tool call
 */
async function executeMCPTool(db, task, action, params) {
  const mcpServerUrl = process.env.MCP_SERVER_URL ||
    'https://mcp-quendoo-chatbot-222402522800.us-central1.run.app';

  console.log(`[MCP] Calling tool: ${action.tool}`);
  console.log(`[MCP] Params:`, JSON.stringify(params, null, 2));

  // Get hotel's Quendoo API key from Secret Manager
  let quendooApiKey = null;
  if (task.hotelId) {
    try {
      const hotelDoc = await db.collection('hotels').doc(task.hotelId).get();
      if (hotelDoc.exists) {
        const hotelData = hotelDoc.data();
        const apiKeySecretName = hotelData.apiKeySecretName;

        if (apiKeySecretName) {
          console.log(`[MCP] Fetching API key from Secret Manager: ${apiKeySecretName}`);

          // Access Secret Manager
          const secretClient = new SecretManagerServiceClient();
          const projectId = process.env.GCLOUD_PROJECT || 'quendoo-ai-dashboard';
          const secretPath = `projects/${projectId}/secrets/${apiKeySecretName}/versions/latest`;

          const [version] = await secretClient.accessSecretVersion({ name: secretPath });
          quendooApiKey = version.payload.data.toString('utf8');

          console.log(`[MCP] Found Quendoo API key for hotel: ${task.hotelId}`);
        } else {
          console.warn(`[MCP] No apiKeySecretName found for hotel: ${task.hotelId}`);
        }
      } else {
        console.warn(`[MCP] Hotel not found: ${task.hotelId}`);
      }
    } catch (error) {
      console.error(`[MCP] Error fetching hotel API key:`, error);
    }
  }

  // Create a session for this execution
  const sessionId = `task_${task.id}_${Date.now()}`;

  // Build headers
  const headers = {
    'Content-Type': 'application/json',
  };

  // Add Quendoo API key if available
  if (quendooApiKey) {
    headers['X-Quendoo-Api-Key'] = quendooApiKey;
  }

  // Call MCP server
  const response = await fetch(`${mcpServerUrl}/messages/?session_id=${sessionId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      method: 'tools/call',
      params: {
        name: action.tool,
        arguments: params
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MCP call failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`[MCP] Tool executed successfully`);

  return result;
}

/**
 * Execute API call
 */
async function executeAPICall(task, action, params) {
  const { url, method = 'GET', headers = {} } = action;

  console.log(`[API] Calling: ${method} ${url}`);

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: method !== 'GET' ? JSON.stringify(params) : undefined
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log(`[API] Request completed successfully`);

  return result;
}

/**
 * Write a log entry to Firestore
 */
async function writeLog(db, taskId, executionId, level, step, action, message, data = null) {
  const logEntry = {
    taskId,
    executionId,
    timestamp: new Date().toISOString(),
    level, // 'info', 'warn', 'error', 'debug'
    step,
    action,
    message,
    data: data ? JSON.parse(JSON.stringify(data)) : null
  };

  try {
    await db.collection('task_logs').add(logEntry);
    console.log(`[TaskLog] ${level.toUpperCase()} - ${message}`);
  } catch (error) {
    console.error('[TaskLog] Failed to write log:', error);
  }
}

/**
 * Execute a single action step
 */
async function executeStep(db, task, action, stepNumber, executionId, previousResult = null) {
  const stepStartTime = Date.now();

  await writeLog(
    db,
    task.id,
    executionId,
    'info',
    stepNumber,
    action.tool || action.type,
    `Starting step ${stepNumber}: ${action.type}`,
    { actionType: action.type, tool: action.tool }
  );

  console.log(`[TaskExecutor] Executing step: ${action.type} - ${action.tool || 'api_call'}`);

  // Replace template variables in parameters
  const originalParams = action.params || {};
  const params = replaceTemplateVars(originalParams, task, previousResult);

  await writeLog(
    db,
    task.id,
    executionId,
    'debug',
    stepNumber,
    action.tool || action.type,
    'Parameters after template replacement',
    {
      originalParams,
      replacedParams: params,
      hadPreviousResult: previousResult !== null
    }
  );

  let result;
  let error = null;

  // Execute based on action type
  try {
    switch (action.type) {
      case 'mcp_tool':
        result = await executeMCPTool(db, task, action, params);
        break;

      case 'api_call':
        result = await executeAPICall(task, action, params);
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    const stepDuration = Date.now() - stepStartTime;

    await writeLog(
      db,
      task.id,
      executionId,
      'info',
      stepNumber,
      action.tool || action.type,
      `Step ${stepNumber} completed successfully`,
      { duration: stepDuration, resultSize: JSON.stringify(result).length }
    );

    return result;

  } catch (err) {
    const stepDuration = Date.now() - stepStartTime;

    await writeLog(
      db,
      task.id,
      executionId,
      'error',
      stepNumber,
      action.tool || action.type,
      `Step ${stepNumber} failed: ${err.message}`,
      {
        error: err.message,
        stack: err.stack,
        duration: stepDuration
      }
    );

    throw err;
  }
}

/**
 * Execute a scheduled task with multi-step support
 */
export async function executeTask(db, taskId) {
  const startTime = Date.now();
  const executionId = `exec_${taskId}_${Date.now()}`;

  console.log(`[TaskExecutor] Executing task: ${taskId} (execution: ${executionId})`);

  // Get task from Firestore
  const taskDoc = await db.collection('scheduled_tasks').doc(taskId).get();

  if (!taskDoc.exists) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const task = { id: taskDoc.id, ...taskDoc.data() };

  await writeLog(
    db,
    taskId,
    executionId,
    'info',
    0,
    'task_start',
    `Task execution started: ${task.name}`,
    {
      taskName: task.name,
      schedule: task.schedule,
      hotelId: task.hotelId
    }
  );

  // Check if task is enabled
  if (!task.enabled) {
    console.log(`[TaskExecutor] Task ${taskId} is disabled, skipping`);
    await writeLog(
      db,
      taskId,
      executionId,
      'warn',
      0,
      'task_skip',
      'Task is disabled, skipping execution'
    );
    return { skipped: true, reason: 'Task is disabled' };
  }

  let results = [];
  let status = 'success';
  let error = null;
  let previousResult = null;

  try {
    // Support both old single action and new multi-step actions
    const actions = task.actions || (task.action ? [task.action] : []);

    if (actions.length === 0) {
      throw new Error('Task has no actions defined');
    }

    console.log(`[TaskExecutor] Task has ${actions.length} step(s)`);

    await writeLog(
      db,
      taskId,
      executionId,
      'info',
      0,
      'task_start',
      `Task has ${actions.length} step(s) to execute`,
      { totalSteps: actions.length, actions: actions.map(a => ({ type: a.type, tool: a.tool })) }
    );

    // Execute each step sequentially
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const stepNumber = i + 1;
      console.log(`[TaskExecutor] Executing step ${stepNumber}/${actions.length}`);

      const stepResult = await executeStep(db, task, action, stepNumber, executionId, previousResult);
      results.push({
        step: stepNumber,
        action: action.tool || action.type,
        result: stepResult
      });

      // Pass result to next step
      previousResult = stepResult;
    }

    console.log(`[TaskExecutor] Task ${taskId} executed successfully (${actions.length} steps)`);

    await writeLog(
      db,
      taskId,
      executionId,
      'info',
      0,
      'task_complete',
      `Task completed successfully`,
      {
        totalSteps: actions.length,
        duration: Date.now() - startTime
      }
    );

  } catch (err) {
    console.error(`[TaskExecutor] Task ${taskId} failed:`, err);
    status = 'failed';
    error = err.message;

    await writeLog(
      db,
      taskId,
      executionId,
      'error',
      0,
      'task_error',
      `Task execution failed: ${err.message}`,
      {
        error: err.message,
        stack: err.stack,
        duration: Date.now() - startTime
      }
    );
  }

  const duration = Date.now() - startTime;
  const executedAt = new Date().toISOString();

  // Save execution history
  await db.collection('task_history').add({
    taskId,
    executionId,
    executedAt,
    status,
    results,
    error,
    duration
  });

  // Update task's last run and next run
  const nextRun = getNextRunTime(task.schedule);
  await db.collection('scheduled_tasks').doc(taskId).update({
    lastRun: executedAt,
    nextRun,
    lastStatus: status
  });

  console.log(`[TaskExecutor] Task ${taskId} next run: ${nextRun}`);

  await writeLog(
    db,
    taskId,
    executionId,
    'info',
    0,
    'task_scheduled',
    `Next execution scheduled`,
    { nextRun, currentStatus: status }
  );

  return {
    status,
    results,
    error,
    duration,
    nextRun,
    executionId
  };
}

/**
 * Check all scheduled tasks and execute those that are due
 */
export async function scheduleDailyTaskCheck(db) {
  console.log('[TaskScheduler] Checking for due scheduled tasks...');

  const now = new Date().toISOString();

  // Get all enabled tasks where nextRun <= now
  const tasksSnapshot = await db
    .collection('scheduled_tasks')
    .where('enabled', '==', true)
    .where('nextRun', '<=', now)
    .get();

  console.log(`[TaskScheduler] Found ${tasksSnapshot.size} tasks to execute`);

  let executed = 0;
  let skipped = 0;

  // Execute each task
  for (const taskDoc of tasksSnapshot.docs) {
    const taskId = taskDoc.id;

    try {
      const result = await executeTask(db, taskId);

      if (result.skipped) {
        skipped++;
      } else {
        executed++;
      }
    } catch (error) {
      console.error(`[TaskScheduler] Failed to execute task ${taskId}:`, error);
      skipped++;
    }
  }

  return { executed, skipped, total: tasksSnapshot.size };
}
