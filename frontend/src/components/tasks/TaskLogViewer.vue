<script setup>
import { ref, computed, watch } from 'vue'
import { useTasksStore } from '../../stores/tasksStore'

const props = defineProps({
  taskId: {
    type: String,
    required: true
  },
  executionId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close'])

const tasksStore = useTasksStore()

const logs = ref([])
const loading = ref(false)
const selectedLevel = ref('all')
const autoRefresh = ref(false)
const refreshInterval = ref(null)

const levels = [
  { value: 'all', label: 'Всички', color: 'grey' },
  { value: 'info', label: 'Info', color: 'primary' },
  { value: 'debug', label: 'Debug', color: 'blue-grey' },
  { value: 'warn', label: 'Warning', color: 'warning' },
  { value: 'error', label: 'Error', color: 'error' }
]

const filteredLogs = computed(() => {
  if (selectedLevel.value === 'all') {
    return logs.value
  }
  return logs.value.filter(log => log.level === selectedLevel.value)
})

const groupedByStep = computed(() => {
  const groups = {}
  filteredLogs.value.forEach(log => {
    const step = log.step || 0
    if (!groups[step]) {
      groups[step] = []
    }
    groups[step].push(log)
  })
  return groups
})

const stepNumbers = computed(() => {
  return Object.keys(groupedByStep.value).map(Number).sort((a, b) => a - b)
})

async function fetchLogs() {
  loading.value = true
  try {
    if (props.executionId) {
      logs.value = await tasksStore.fetchExecutionLogs(props.executionId)
    } else {
      logs.value = await tasksStore.fetchTaskLogs(props.taskId, { limit: 200 })
    }
  } catch (error) {
    console.error('[TaskLogViewer] Error fetching logs:', error)
  } finally {
    loading.value = false
  }
}

function getLevelIcon(level) {
  switch (level) {
    case 'info':
      return 'mdi-information'
    case 'debug':
      return 'mdi-bug'
    case 'warn':
      return 'mdi-alert'
    case 'error':
      return 'mdi-alert-circle'
    default:
      return 'mdi-circle-small'
  }
}

function getLevelColor(level) {
  const levelObj = levels.find(l => l.value === level)
  return levelObj ? levelObj.color : 'grey'
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleString('bg-BG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatData(data) {
  if (!data) return null
  return JSON.stringify(data, null, 2)
}

function startAutoRefresh() {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
  refreshInterval.value = setInterval(fetchLogs, 3000)
}

function stopAutoRefresh() {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
    refreshInterval.value = null
  }
}

watch(autoRefresh, (newValue) => {
  if (newValue) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
})

watch(() => props.executionId, () => {
  fetchLogs()
})

// Initial fetch
fetchLogs()

// Cleanup
onBeforeUnmount(() => {
  stopAutoRefresh()
})
</script>

<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon icon="mdi-math-log" class="mr-2"></v-icon>
      Логове на задачата
      <v-spacer></v-spacer>
      <v-btn icon="mdi-close" variant="text" @click="emit('close')"></v-btn>
    </v-card-title>

    <v-card-subtitle v-if="executionId" class="pb-0">
      Execution ID: {{ executionId }}
    </v-card-subtitle>

    <v-card-text>
      <!-- Toolbar -->
      <div class="d-flex align-center gap-3 mb-4">
        <!-- Level filter -->
        <v-chip-group v-model="selectedLevel" mandatory>
          <v-chip
            v-for="level in levels"
            :key="level.value"
            :value="level.value"
            :color="level.color"
            variant="outlined"
            filter
          >
            {{ level.label }}
          </v-chip>
        </v-chip-group>

        <v-spacer></v-spacer>

        <!-- Auto-refresh toggle -->
        <v-switch
          v-model="autoRefresh"
          label="Auto-refresh"
          color="primary"
          hide-details
          density="compact"
        ></v-switch>

        <!-- Refresh button -->
        <v-btn
          icon="mdi-refresh"
          variant="text"
          @click="fetchLogs"
          :loading="loading"
        ></v-btn>
      </div>

      <!-- Loading -->
      <v-progress-linear
        v-if="loading && logs.length === 0"
        indeterminate
        color="primary"
        class="mb-4"
      ></v-progress-linear>

      <!-- Empty state -->
      <v-alert
        v-if="!loading && logs.length === 0"
        type="info"
        variant="tonal"
        class="mb-4"
      >
        Няма логове за тази задача
      </v-alert>

      <!-- Logs grouped by step -->
      <v-expansion-panels v-if="filteredLogs.length > 0" variant="accordion">
        <v-expansion-panel
          v-for="stepNum in stepNumbers"
          :key="stepNum"
        >
          <v-expansion-panel-title>
            <div class="d-flex align-center w-100">
              <v-icon icon="mdi-numeric" size="small" class="mr-2"></v-icon>
              <span class="font-weight-medium">
                {{ stepNum === 0 ? 'Обща информация' : `Стъпка ${stepNum}` }}
              </span>
              <v-spacer></v-spacer>
              <v-chip size="small" variant="tonal">
                {{ groupedByStep[stepNum].length }} записа
              </v-chip>
            </div>
          </v-expansion-panel-title>

          <v-expansion-panel-text>
            <v-timeline side="end" density="compact">
              <v-timeline-item
                v-for="log in groupedByStep[stepNum]"
                :key="log.id"
                :dot-color="getLevelColor(log.level)"
                size="small"
              >
                <template v-slot:icon>
                  <v-icon :icon="getLevelIcon(log.level)" size="x-small"></v-icon>
                </template>

                <v-card variant="outlined" class="mb-2">
                  <v-card-text class="pa-3">
                    <!-- Log header -->
                    <div class="d-flex align-center mb-2">
                      <v-chip
                        :color="getLevelColor(log.level)"
                        size="x-small"
                        class="mr-2"
                      >
                        {{ log.level.toUpperCase() }}
                      </v-chip>
                      <span class="text-caption text-medium-emphasis">
                        {{ formatTimestamp(log.timestamp) }}
                      </span>
                      <v-spacer></v-spacer>
                      <span class="text-caption font-weight-medium">
                        {{ log.action }}
                      </span>
                    </div>

                    <!-- Log message -->
                    <div class="text-body-2 mb-2">
                      {{ log.message }}
                    </div>

                    <!-- Log data -->
                    <v-expansion-panels v-if="log.data" variant="accordion" flat>
                      <v-expansion-panel>
                        <v-expansion-panel-title class="pa-2 text-caption">
                          <v-icon icon="mdi-code-json" size="small" class="mr-1"></v-icon>
                          Данни
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                          <pre class="log-data">{{ formatData(log.data) }}</pre>
                        </v-expansion-panel-text>
                      </v-expansion-panel>
                    </v-expansion-panels>
                  </v-card-text>
                </v-card>
              </v-timeline-item>
            </v-timeline>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>

    <v-card-actions>
      <v-btn
        variant="text"
        prepend-icon="mdi-download"
        @click="downloadLogs"
      >
        Изтегли логове
      </v-btn>
      <v-spacer></v-spacer>
      <v-btn variant="text" @click="emit('close')">
        Затвори
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script>
import { onBeforeUnmount } from 'vue'

export default {
  methods: {
    downloadLogs() {
      const data = JSON.stringify(this.logs, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `task-${this.taskId}-logs-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }
}
</script>

<style scoped>
.log-data {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  background: rgba(0, 0, 0, 0.05);
  padding: 8px;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.gap-3 {
  gap: 12px;
}
</style>
