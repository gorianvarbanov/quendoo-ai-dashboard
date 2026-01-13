/**
 * Tasks Store - Pinia
 *
 * Manages scheduled automation tasks state
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api'

export const useTasksStore = defineStore('tasks', () => {
  // State
  const tasks = ref([])
  const currentTask = ref(null)
  const taskHistory = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Computed
  const activeTasks = computed(() => {
    return tasks.value.filter(task => task.enabled)
  })

  const inactiveTasks = computed(() => {
    return tasks.value.filter(task => !task.enabled)
  })

  const taskCount = computed(() => tasks.value.length)

  // Actions

  /**
   * Fetch all tasks for the current hotel
   */
  async function fetchTasks() {
    loading.value = true
    error.value = null

    try {
      const response = await api.get('/api/tasks')
      tasks.value = response.data.tasks || []
      return tasks.value
    } catch (err) {
      console.error('[TasksStore] Error fetching tasks:', err)
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch a specific task with its history
   */
  async function fetchTask(taskId) {
    loading.value = true
    error.value = null

    try {
      const response = await api.get(`/api/tasks/${taskId}`)
      console.log('[TasksStore] fetchTask response:', response.data)

      // Backend returns 'job', not 'task'
      currentTask.value = response.data.job || response.data.task
      taskHistory.value = response.data.history || []

      console.log('[TasksStore] Set currentTask:', currentTask.value)
      return currentTask.value
    } catch (err) {
      console.error('[TasksStore] Error fetching task:', err)
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new task
   */
  async function createTask(taskData) {
    loading.value = true
    error.value = null

    try {
      console.log('[TasksStore] Creating task with data:', JSON.stringify(taskData, null, 2))
      const response = await api.post('/api/tasks', taskData)
      console.log('[TasksStore] Task created successfully:', response.data)
      const newTask = response.data

      // Add to tasks list
      tasks.value.unshift(newTask)

      return newTask
    } catch (err) {
      console.error('[TasksStore] Error creating task:', err)
      console.error('[TasksStore] Error response:', err.response?.data)
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update an existing task
   */
  async function updateTask(taskId, updates) {
    loading.value = true
    error.value = null

    try {
      console.log('[TasksStore] Updating task:', taskId)
      console.log('[TasksStore] Update data:', JSON.stringify(updates, null, 2))

      const response = await api.put(`/api/tasks/${taskId}`, updates)
      const updatedTask = response.data

      console.log('[TasksStore] Task updated successfully:', JSON.stringify(updatedTask, null, 2))

      // Update in tasks list
      const index = tasks.value.findIndex(t => t.id === taskId)
      if (index !== -1) {
        console.log('[TasksStore] Updating task at index:', index)
        tasks.value[index] = updatedTask
      } else {
        console.warn('[TasksStore] Task not found in list:', taskId)
      }

      // Update current task if it's the same
      if (currentTask.value?.id === taskId) {
        console.log('[TasksStore] Updating currentTask')
        currentTask.value = updatedTask
      }

      return updatedTask
    } catch (err) {
      console.error('[TasksStore] Error updating task:', err)
      console.error('[TasksStore] Error response:', err.response?.data)
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a task
   */
  async function deleteTask(taskId) {
    loading.value = true
    error.value = null

    try {
      await api.delete(`/api/tasks/${taskId}`)

      // Remove from tasks list
      tasks.value = tasks.value.filter(t => t.id !== taskId)

      // Clear current task if it's the same
      if (currentTask.value?.id === taskId) {
        currentTask.value = null
      }

      return true
    } catch (err) {
      console.error('[TasksStore] Error deleting task:', err)
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Toggle task enabled status
   */
  async function toggleTask(taskId) {
    loading.value = true
    error.value = null

    try {
      const response = await api.post(`/api/tasks/${taskId}/toggle`)
      const { enabled } = response.data

      // Update in tasks list
      const index = tasks.value.findIndex(t => t.id === taskId)
      if (index !== -1) {
        tasks.value[index].enabled = enabled
      }

      // Update current task if it's the same
      if (currentTask.value?.id === taskId) {
        currentTask.value.enabled = enabled
      }

      return enabled
    } catch (err) {
      console.error('[TasksStore] Error toggling task:', err)
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Manually execute a task now
   */
  async function executeTask(taskId) {
    loading.value = true
    error.value = null

    try {
      const response = await api.post(`/api/tasks/${taskId}/execute`)

      // Refresh task history
      await fetchTask(taskId)

      return response.data
    } catch (err) {
      console.error('[TasksStore] Error executing task:', err)
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch logs for a specific task
   */
  async function fetchTaskLogs(taskId, options = {}) {
    const { executionId, level, limit = 100 } = options

    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      if (executionId) params.append('executionId', executionId)
      if (level) params.append('level', level)
      params.append('limit', limit)

      const response = await api.get(`/api/tasks/${taskId}/logs?${params}`)
      return response.data.logs || []
    } catch (err) {
      console.error('[TasksStore] Error fetching task logs:', err)
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch logs for a specific execution
   */
  async function fetchExecutionLogs(executionId, options = {}) {
    const { level } = options

    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      if (level) params.append('level', level)

      const response = await api.get(`/api/tasks/executions/${executionId}/logs?${params}`)
      return response.data.logs || []
    } catch (err) {
      console.error('[TasksStore] Error fetching execution logs:', err)
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear error
   */
  function clearError() {
    error.value = null
  }

  /**
   * Reset store
   */
  function $reset() {
    tasks.value = []
    currentTask.value = null
    taskHistory.value = []
    loading.value = false
    error.value = null
  }

  return {
    // State
    tasks,
    currentTask,
    taskHistory,
    loading,
    error,

    // Computed
    activeTasks,
    inactiveTasks,
    taskCount,

    // Actions
    fetchTasks,
    fetchTask,
    createTask,
    updateTask,
    deleteTask,
    toggleTask,
    executeTask,
    fetchTaskLogs,
    fetchExecutionLogs,
    clearError,
    $reset
  }
})
