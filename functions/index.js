/**
 * Quendoo Scheduled Tasks - Cloud Functions
 *
 * This Cloud Function executes scheduled automation tasks stored in Firestore.
 * It can be triggered by Cloud Scheduler or HTTP requests.
 */

import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { executeTask, scheduleDailyTaskCheck } from "./taskExecutor.js";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

/**
 * HTTP endpoint to manually execute a task
 * POST /executeCronJob_http
 * Body: { taskId: "job_123" }
 */
export const executeCronJob_http = onRequest(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 540 // 9 minutes max
  },
  async (request, response) => {
    try {
      const { taskId } = request.body;

      if (!taskId) {
        response.status(400).json({ error: "Missing taskId parameter" });
        return;
      }

      console.log(`[TaskExecutor] HTTP request to execute job: ${taskId}`);

      const result = await executeTask(db, taskId);

      response.json({
        success: true,
        taskId,
        result
      });
    } catch (error) {
      console.error("[TaskExecutor] Error:", error);
      response.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Scheduled function that checks and executes due tasks
 * Runs every 15 minutes to check for jobs that need execution
 */
export const checkAndExecuteTasks = onSchedule(
  {
    schedule: "every 15 minutes",
    region: "us-central1",
    timeoutSeconds: 540
  },
  async (event) => {
    console.log("[TaskScheduler] Starting scheduled task check...");

    try {
      const result = await scheduleDailyTaskCheck(db);
      console.log(`[TaskScheduler] Completed. Executed ${result.executed} jobs, Skipped ${result.skipped}`);
    } catch (error) {
      console.error("[TaskScheduler] Error:", error);
      throw error;
    }
  }
);

/**
 * HTTP endpoint to get task status
 * GET /getTaskStatus?taskId=job_123
 */
export const getTaskStatus = onRequest(
  {
    region: "us-central1",
    cors: true
  },
  async (request, response) => {
    try {
      const taskId = request.query.taskId;

      if (!taskId) {
        response.status(400).json({ error: "Missing taskId parameter" });
        return;
      }

      // Get task details
      const taskDoc = await db.collection("scheduled_tasks").doc(taskId).get();

      if (!taskDoc.exists) {
        response.status(404).json({ error: "Job not found" });
        return;
      }

      // Get last 10 executions
      const historySnapshot = await db
        .collection("task_history")
        .where("taskId", "==", taskId)
        .orderBy("executedAt", "desc")
        .limit(10)
        .get();

      const history = historySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      response.json({
        job: { id: taskDoc.id, ...taskDoc.data() },
        history
      });
    } catch (error) {
      console.error("[GetStatus] Error:", error);
      response.status(500).json({
        error: error.message
      });
    }
  }
);
