<template>
  <v-card class="task-card" :class="{ 'task-disabled': !task.enabled }">
    <v-card-title class="d-flex align-center">
      <v-icon
        :icon="getTaskIcon(task.action.type)"
        :color="task.enabled ? 'primary' : 'grey'"
        class="mr-2"
      ></v-icon>
      <span class="task-name">{{ task.name }}</span>
      <v-spacer></v-spacer>
      <v-chip
        :color="task.enabled ? 'success' : 'grey'"
        size="small"
        variant="flat"
      >
        {{ task.enabled ? ui.active : ui.inactive }}
      </v-chip>
    </v-card-title>

    <v-card-subtitle v-if="task.description">
      {{ task.description }}
    </v-card-subtitle>

    <v-card-text>
      <div class="task-details">
        <!-- Schedule -->
        <div class="detail-row">
          <v-icon icon="mdi-clock-outline" size="small" class="mr-2"></v-icon>
          <span class="detail-label">{{ ui.schedule }}:</span>
          <span class="detail-value">{{ formatSchedule(task.schedule) }}</span>
        </div>

        <!-- Actions -->
        <div class="detail-row">
          <v-icon icon="mdi-lightning-bolt" size="small" class="mr-2"></v-icon>
          <span class="detail-label">{{ ui.actions }}:</span>
          <span class="detail-value">
            {{ task.actions?.length || 1 }} {{ task.actions?.length === 1 ? ui.step : ui.steps }}
          </span>
        </div>

        <!-- Last Run -->
        <div v-if="task.lastRun" class="detail-row">
          <v-icon icon="mdi-history" size="small" class="mr-2"></v-icon>
          <span class="detail-label">{{ ui.lastRun }}:</span>
          <span class="detail-value">
            {{ formatDate(task.lastRun) }}
            <v-chip
              v-if="task.lastStatus"
              :color="task.lastStatus === 'success' ? 'success' : 'error'"
              size="x-small"
              class="ml-2"
            >
              {{ task.lastStatus === 'success' ? '✓' : '✗' }}
            </v-chip>
          </span>
        </div>

        <!-- Next Run -->
        <div v-if="task.nextRun && task.enabled" class="detail-row">
          <v-icon icon="mdi-calendar-clock" size="small" class="mr-2"></v-icon>
          <span class="detail-label">{{ ui.nextRun }}:</span>
          <span class="detail-value">{{ formatDate(task.nextRun) }}</span>
        </div>
      </div>
    </v-card-text>

    <v-card-actions>
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-eye"
        @click="$emit('view', task)"
      >
        {{ ui.viewDetails }}
      </v-btn>

      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-pencil"
        @click="$emit('edit', task)"
      >
        {{ ui.edit }}
      </v-btn>

      <v-spacer></v-spacer>

      <v-btn
        variant="text"
        size="small"
        :prepend-icon="task.enabled ? 'mdi-pause' : 'mdi-play'"
        @click="$emit('toggle', task)"
      >
        {{ task.enabled ? ui.stop : ui.start }}
      </v-btn>

      <v-btn
        v-if="task.enabled"
        variant="text"
        size="small"
        prepend-icon="mdi-play-circle"
        color="primary"
        @click="$emit('execute', task)"
      >
        {{ ui.executeNow }}
      </v-btn>

      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-delete"
        color="error"
        @click="$emit('delete', task)"
      >
        {{ ui.delete }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { defineProps, defineEmits, computed, ref } from 'vue'
import { t } from '@/i18n/translations'

const props = defineProps({
  task: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['view', 'edit', 'toggle', 'execute', 'delete'])

// Get language from localStorage and watch for changes
const language = ref(localStorage.getItem('language') || 'bg')

// Listen for language changes from other components
window.addEventListener('storage', (e) => {
  if (e.key === 'language') {
    language.value = e.newValue || 'bg'
  }
})

// Also listen for custom language change event
window.addEventListener('languageChanged', (e) => {
  language.value = e.detail || localStorage.getItem('language') || 'bg'
})

// UI Translations
const ui = computed(() => {
  const lang = language.value
  return {
    active: lang === 'bg' ? 'Активна' : lang === 'en' ? 'Active' : 'Aktiv',
    inactive: lang === 'bg' ? 'Неактивна' : lang === 'en' ? 'Inactive' : 'Inaktiv',
    schedule: t('schedule', lang),
    actions: lang === 'bg' ? 'Действия' : lang === 'en' ? 'Actions' : 'Aktionen',
    step: lang === 'bg' ? 'стъпка' : lang === 'en' ? 'step' : 'Schritt',
    steps: lang === 'bg' ? 'стъпки' : lang === 'en' ? 'steps' : 'Schritte',
    lastRun: t('lastRun', lang),
    nextRun: t('nextRun', lang),
    viewDetails: lang === 'bg' ? 'Виж детайли' : lang === 'en' ? 'View Details' : 'Details ansehen',
    edit: t('edit', lang),
    stop: lang === 'bg' ? 'Спри' : lang === 'en' ? 'Stop' : 'Stoppen',
    start: lang === 'bg' ? 'Стартирай' : lang === 'en' ? 'Start' : 'Starten',
    executeNow: t('executeNow', lang),
    delete: t('delete', lang),
    after: lang === 'bg' ? 'След' : lang === 'en' ? 'In' : 'In',
    ago: lang === 'bg' ? 'Преди' : lang === 'en' ? 'Ago' : 'Vor',
    hours: lang === 'bg' ? 'ч' : lang === 'en' ? 'h' : 'Std',
    minutes: lang === 'bg' ? 'м' : lang === 'en' ? 'm' : 'Min'
  }
})

function getTaskIcon(actionType) {
  const icons = {
    'mcp_tool': 'mdi-tools',
    'api_call': 'mdi-api',
    'claude_message': 'mdi-message-processing'
  }
  return icons[actionType] || 'mdi-cog'
}

function formatSchedule(schedule) {
  // Parse common cron patterns
  const patterns = {
    '0 9 * * *': 'Всеки ден в 9:00',
    '0 8 * * 1': 'Всеки понеделник в 8:00',
    '*/15 * * * *': 'На всеки 15 минути',
    '0 * * * *': 'На всеки час',
    '0 0 * * *': 'Всеки ден в полунощ',
    '0 12 * * *': 'Всеки ден в обед'
  }

  return patterns[schedule] || schedule
}

function getActionLabel(action) {
  if (action.type === 'mcp_tool') {
    return `MCP Tool: ${action.tool}`
  } else if (action.type === 'api_call') {
    return `API: ${action.method || 'GET'} ${action.url}`
  }
  return action.type
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const now = new Date()
  const diff = date - now

  // If within 24 hours, show relative time
  if (Math.abs(diff) < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(Math.abs(diff) / (60 * 60 * 1000))
    const minutes = Math.floor((Math.abs(diff) % (60 * 60 * 1000)) / (60 * 1000))

    if (diff > 0) {
      if (hours > 0) {
        return `${ui.value.after} ${hours}${ui.value.hours} ${minutes}${ui.value.minutes}`
      }
      return `${ui.value.after} ${minutes}${ui.value.minutes}`
    } else {
      if (hours > 0) {
        return `${ui.value.ago} ${hours}${ui.value.hours} ${minutes}${ui.value.minutes}`
      }
      return `${ui.value.ago} ${minutes}${ui.value.minutes}`
    }
  }

  // Otherwise show formatted date
  const locale = language.value === 'en' ? 'en-US' : language.value === 'de' ? 'de-DE' : 'bg-BG'
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.task-card {
  margin-bottom: 16px;
  transition: all 0.3s ease;
}

.task-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.task-disabled {
  opacity: 0.7;
}

.task-name {
  font-weight: 600;
  font-size: 1.1rem;
}

.task-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}

.detail-label {
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
  min-width: 160px;
}

.detail-value {
  color: rgba(var(--v-theme-on-surface), 0.9);
  display: flex;
  align-items: center;
}
</style>
