<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTasksStore } from '../stores/tasksStore'
import { t } from '@/i18n/translations'
import TaskCard from '../components/tasks/TaskCard.vue'
import TaskForm from '../components/tasks/TaskForm.vue'
import TaskLogViewer from '../components/tasks/TaskLogViewer.vue'

const router = useRouter()
const tasksStore = useTasksStore()

// Get language from localStorage (same as ChatContainer)
const language = ref(localStorage.getItem('language') || 'bg')

// UI Translations
const ui = computed(() => {
  const lang = language.value
  return {
    automatedTasks: t('automatedTasks', lang),
    backToChat: t('backToChat', lang),
    createNewTask: t('createNewTask', lang),
    automateRepeatingActions: t('automateRepeatingActions', lang),
    active: t('active', lang),
    inactive: t('inactive', lang),
    createTask: t('createTask', lang),
    noTasksCreated: t('noTasksCreated', lang),
    createFirstTask: t('createFirstTask', lang),
    createFirstTaskBtn: t('createFirstTaskBtn', lang),
    taskCreatedSuccess: t('taskCreatedSuccess', lang),
    taskUpdatedSuccess: t('taskUpdatedSuccess', lang),
    taskDeletedSuccess: t('taskDeletedSuccess', lang),
    taskActivated: t('taskActivated', lang),
    taskDeactivated: t('taskDeactivated', lang),
    taskExecutedSuccess: t('taskExecutedSuccess', lang),
    editTask: t('editTask', lang),
    deleteTask: t('deleteTask', lang),
    taskDetails: t('taskDetails', lang),
    name: t('name', lang),
    description: t('description', lang),
    schedule: t('schedule', lang),
    status: t('status', lang),
    lastRun: t('lastRun', lang),
    nextRun: t('nextRun', lang),
    successful: t('successful', lang),
    error: t('error', lang),
    executionHistory: t('executionHistory', lang),
    noResults: t('noResults', lang),
    logs: t('logs', lang),
    edit: t('edit', lang),
    executeNow: t('executeNow', lang),
    close: t('close', lang),
    cancel: t('cancel', lang),
    delete: t('delete', lang),
    areYouSure: t('areYouSure', lang),
    cannotBeUndone: t('cannotBeUndone', lang)
  }
})

const showTaskForm = ref(false)
const showDeleteDialog = ref(false)
const showDetailsDialog = ref(false)
const showLogViewer = ref(false)
const selectedTask = ref(null)
const selectedExecutionId = ref(null)
const taskToDelete = ref(null)
const deleting = ref(false)
const showSuccessSnackbar = ref(false)
const successMessage = ref('')

const tasks = computed(() => tasksStore.tasks)
const activeTasks = computed(() => tasksStore.activeTasks)
const inactiveTasks = computed(() => tasksStore.inactiveTasks)

// Clear selectedTask when form closes
watch(showTaskForm, (newValue) => {
  if (!newValue) {
    console.log('[TasksView] Form closed, clearing selectedTask')
    selectedTask.value = null
  }
})

onMounted(async () => {
  await refreshTasks()
})

async function refreshTasks() {
  try {
    await tasksStore.fetchTasks()
  } catch (error) {
    console.error('[TasksView] Error fetching tasks:', error)
  }
}

function goBackToChat() {
  router.push('/chat')
}

function openCreateDialog() {
  selectedTask.value = null
  showTaskForm.value = true
}

async function editTask(task) {
  try {
    console.log('[TasksView] Editing task, fetching fresh data:', task.id)
    // Fetch fresh data from server to ensure we have the latest version
    await tasksStore.fetchTask(task.id)

    // Set selectedTask BEFORE opening the form
    selectedTask.value = tasksStore.currentTask
    console.log('[TasksView] Set selectedTask:', JSON.stringify(selectedTask.value, null, 2))

    // Use nextTick to ensure the form component receives the updated prop
    await new Promise(resolve => setTimeout(resolve, 0))

    showTaskForm.value = true
    showDetailsDialog.value = false

    console.log('[TasksView] Form opened with selectedTask:', selectedTask.value?.name)
  } catch (error) {
    console.error('[TasksView] Error fetching task for editing:', error)
  }
}

async function saveTask(taskData, taskId) {
  try {
    console.log('[TasksView] Saving task:', taskId ? `update ${taskId}` : 'create new')
    console.log('[TasksView] Task data:', JSON.stringify(taskData, null, 2))

    if (taskId) {
      const updated = await tasksStore.updateTask(taskId, taskData)
      console.log('[TasksView] Task updated, result:', JSON.stringify(updated, null, 2))
      successMessage.value = ui.value.taskUpdatedSuccess
    } else {
      await tasksStore.createTask(taskData)
      successMessage.value = ui.value.taskCreatedSuccess
    }
    showSuccessSnackbar.value = true
  } catch (error) {
    console.error('[TasksView] Error saving task:', error)
  }
}

async function toggleTask(task) {
  try {
    const newStatus = await tasksStore.toggleTask(task.id)
    successMessage.value = newStatus
      ? ui.value.taskActivated
      : ui.value.taskDeactivated
    showSuccessSnackbar.value = true
  } catch (error) {
    console.error('[TasksView] Error toggling task:', error)
  }
}

async function executeTask(task) {
  try {
    await tasksStore.executeTask(task.id)
    successMessage.value = ui.value.taskExecutedSuccess
    showSuccessSnackbar.value = true
  } catch (error) {
    console.error('[TasksView] Error executing task:', error)
  }
}

function confirmDeleteTask(task) {
  taskToDelete.value = task
  showDeleteDialog.value = true
}

async function deleteTask() {
  if (!taskToDelete.value) return

  deleting.value = true
  try {
    await tasksStore.deleteTask(taskToDelete.value.id)
    successMessage.value = ui.value.taskDeletedSuccess
    showSuccessSnackbar.value = true
    showDeleteDialog.value = false
    taskToDelete.value = null
  } catch (error) {
    console.error('[TasksView] Error deleting task:', error)
  } finally {
    deleting.value = false
  }
}

async function viewTaskDetails(task) {
  try {
    await tasksStore.fetchTask(task.id)
    selectedTask.value = tasksStore.currentTask
    showDetailsDialog.value = true
  } catch (error) {
    console.error('[TasksView] Error fetching task details:', error)
  }
}

function viewTaskLogs(task) {
  selectedTask.value = task
  selectedExecutionId.value = null
  showLogViewer.value = true
}

function viewExecutionLogs(execution) {
  selectedExecutionId.value = execution.executionId
  showLogViewer.value = true
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('bg-BG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatStepResult(result) {
  if (!result) return 'Няма резултат'

  // If result is a string, return it as is
  if (typeof result === 'string') {
    return result
  }

  // If result has a specific format (e.g., from analyze_data)
  if (result.analysis) {
    return result.analysis
  }

  // Otherwise, pretty print the JSON
  return JSON.stringify(result, null, 2)
}
</script>

<template>
  <div class="tasks-view">
    <!-- Header Section -->
    <div class="header-section">
      <div class="d-flex align-center">
        <v-icon size="32" class="mr-3">mdi-calendar-clock</v-icon>
        <h1 class="text-h4">{{ ui.automatedTasks }}</h1>
      </div>

      <v-btn
        variant="outlined"
        prepend-icon="mdi-arrow-left"
        @click="goBackToChat"
      >
        {{ ui.backToChat }}
      </v-btn>
    </div>

    <!-- Create Task Section -->
    <div class="create-section">
      <v-card elevation="0" border>
        <v-card-text class="d-flex align-center justify-space-between">
          <div class="d-flex align-center gap-4">
            <v-icon icon="mdi-calendar-clock" size="40" color="primary"></v-icon>
            <div>
              <div class="text-h6">{{ ui.createNewTask }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ ui.automateRepeatingActions }}
              </div>
            </div>
          </div>

          <div class="d-flex align-center gap-3">
            <v-chip prepend-icon="mdi-check-circle" color="success" variant="tonal">
              {{ activeTasks.length }} {{ ui.active }}
            </v-chip>
            <v-chip prepend-icon="mdi-pause-circle" color="grey" variant="tonal">
              {{ inactiveTasks.length }} {{ ui.inactive }}
            </v-chip>
            <v-btn
              icon="mdi-refresh"
              variant="text"
              @click="refreshTasks"
              :loading="tasksStore.loading"
            ></v-btn>
            <v-btn
              color="primary"
              prepend-icon="mdi-plus"
              @click="openCreateDialog"
            >
              {{ ui.createTask }}
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <!-- Tasks List Section -->
    <div class="list-section">
      <!-- Loading State -->
      <v-progress-linear
        v-if="tasksStore.loading && !tasks.length"
        indeterminate
        color="primary"
        class="mb-4"
      ></v-progress-linear>

      <!-- Error Alert -->
      <v-alert
        v-if="tasksStore.error"
        type="error"
        closable
        @click:close="tasksStore.clearError()"
        class="mb-4"
      >
        {{ tasksStore.error }}
      </v-alert>

      <!-- Empty State -->
      <v-card v-if="!tasksStore.loading && tasks.length === 0" class="text-center pa-12" elevation="0" border>
        <v-icon icon="mdi-calendar-clock" size="80" color="grey-lighten-1"></v-icon>
        <h3 class="text-h6 mt-4 mb-2">Нямаш създадени задачи</h3>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Създай първата си автоматична задача за да автоматизираш работата си
        </p>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
          Създай първа задача
        </v-btn>
      </v-card>

      <!-- Tasks Grid -->
      <div v-else class="tasks-grid">
        <TaskCard
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          @view="viewTaskDetails"
          @edit="editTask"
          @toggle="toggleTask"
          @execute="executeTask"
          @delete="confirmDeleteTask"
        />
      </div>
    </div>

    <!-- Create/Edit Dialog -->
    <TaskForm
      v-model="showTaskForm"
      :task="selectedTask"
      @save="saveTask"
    />

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="500">
      <v-card>
        <v-card-title>
          <v-icon icon="mdi-delete" color="error" class="mr-2"></v-icon>
          Изтрий задача
        </v-card-title>
        <v-card-text>
          <p>Сигурен ли си, че искаш да изтриеш задачата <strong>{{ taskToDelete?.name }}</strong>?</p>
          <v-alert type="warning" variant="tonal" class="mt-4">
            Това действие не може да бъде отменено.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showDeleteDialog = false">Отказ</v-btn>
          <v-btn
            color="error"
            variant="elevated"
            :loading="deleting"
            @click="deleteTask"
          >
            Изтрий
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Task Details Dialog -->
    <v-dialog v-model="showDetailsDialog" max-width="800">
      <v-card v-if="selectedTask">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-information" class="mr-2"></v-icon>
          Детайли за задачата
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" @click="showDetailsDialog = false"></v-btn>
        </v-card-title>

        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>Име</v-list-item-title>
              <v-list-item-subtitle>{{ selectedTask.name }}</v-list-item-subtitle>
            </v-list-item>

            <v-list-item v-if="selectedTask.description">
              <v-list-item-title>Описание</v-list-item-title>
              <v-list-item-subtitle>{{ selectedTask.description }}</v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <v-list-item-title>Разписание</v-list-item-title>
              <v-list-item-subtitle>{{ selectedTask.schedule }}</v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <v-list-item-title>Статус</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip :color="selectedTask.enabled ? 'success' : 'grey'" size="small">
                  {{ selectedTask.enabled ? 'Активна' : 'Неактивна' }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item v-if="selectedTask.lastRun">
              <v-list-item-title>Последно изпълнение</v-list-item-title>
              <v-list-item-subtitle>
                {{ formatDate(selectedTask.lastRun) }}
                <v-chip
                  v-if="selectedTask.lastStatus"
                  :color="selectedTask.lastStatus === 'success' ? 'success' : 'error'"
                  size="x-small"
                  class="ml-2"
                >
                  {{ selectedTask.lastStatus === 'success' ? 'Успешно' : 'Грешка' }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item v-if="selectedTask.nextRun">
              <v-list-item-title>Следващо изпълнение</v-list-item-title>
              <v-list-item-subtitle>{{ formatDate(selectedTask.nextRun) }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>

          <!-- Execution History -->
          <v-card v-if="tasksStore.taskHistory.length > 0" variant="tonal" class="mt-4">
            <v-card-title class="text-subtitle-2">История на изпълненията</v-card-title>
            <v-card-text>
              <v-expansion-panels variant="accordion">
                <v-expansion-panel
                  v-for="(exec, index) in tasksStore.taskHistory.slice(0, 5)"
                  :key="exec.id"
                >
                  <v-expansion-panel-title>
                    <div class="d-flex align-center w-100">
                      <v-icon
                        :icon="exec.status === 'success' ? 'mdi-check-circle' : 'mdi-alert-circle'"
                        :color="exec.status === 'success' ? 'success' : 'error'"
                        size="small"
                        class="mr-2"
                      ></v-icon>
                      <span>{{ formatDate(exec.executedAt) }}</span>
                      <v-spacer></v-spacer>
                      <v-btn
                        v-if="exec.executionId"
                        icon="mdi-math-log"
                        size="x-small"
                        variant="text"
                        @click.stop="viewExecutionLogs(exec)"
                        class="mr-2"
                      ></v-btn>
                      <span class="text-caption mr-2">{{ exec.duration }}ms</span>
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <!-- Error Message -->
                    <v-alert v-if="exec.error" type="error" variant="tonal" class="mb-3">
                      {{ exec.error }}
                    </v-alert>

                    <!-- Results from each step -->
                    <div v-if="exec.results && exec.results.length > 0">
                      <div
                        v-for="(stepResult, stepIndex) in exec.results"
                        :key="stepIndex"
                        class="mb-3"
                      >
                        <v-card variant="outlined">
                          <v-card-title class="text-subtitle-2 bg-grey-lighten-4">
                            Стъпка {{ stepResult.step }}: {{ stepResult.action }}
                          </v-card-title>
                          <v-card-text>
                            <pre class="result-text">{{ formatStepResult(stepResult.result) }}</pre>
                          </v-card-text>
                        </v-card>
                      </div>
                    </div>

                    <!-- No results message -->
                    <v-alert v-else-if="!exec.error" type="info" variant="tonal">
                      Няма записани резултати за това изпълнение
                    </v-alert>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-card-text>
          </v-card>
        </v-card-text>

        <v-card-actions>
          <v-btn variant="text" prepend-icon="mdi-math-log" @click="viewTaskLogs(selectedTask)">
            Логове
          </v-btn>
          <v-btn variant="text" prepend-icon="mdi-pencil" @click="editTask(selectedTask)">
            Редактирай
          </v-btn>
          <v-btn variant="text" prepend-icon="mdi-play-circle" color="primary" @click="executeTask(selectedTask)">
            Изпълни сега
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showDetailsDialog = false">Затвори</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Log Viewer Dialog -->
    <v-dialog v-model="showLogViewer" max-width="1200">
      <TaskLogViewer
        v-if="selectedTask"
        :task-id="selectedTask.id"
        :execution-id="selectedExecutionId"
        @close="showLogViewer = false"
      />
    </v-dialog>

    <!-- Success Snackbar -->
    <v-snackbar v-model="showSuccessSnackbar" color="success" timeout="3000">
      {{ successMessage }}
    </v-snackbar>
  </div>
</template>

<style scoped>
.tasks-view {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  background: rgb(var(--v-theme-background));
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.create-section {
  padding: 0 24px 24px;
  margin: 0 auto;
  width: 100%;
  max-width: 1200px;
}

.list-section {
  padding: 0 24px 24px;
  margin: 0 auto;
  flex: 1;
  width: 100%;
  max-width: 1200px;
}

.tasks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 16px;
}

@media (max-width: 768px) {
  .tasks-grid {
    grid-template-columns: 1fr;
  }
}

.result-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  background: rgba(0, 0, 0, 0.05);
  padding: 12px;
  border-radius: 4px;
  max-height: 400px;
  overflow-y: auto;
}
</style>
