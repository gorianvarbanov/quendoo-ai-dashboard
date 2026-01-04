<template>
  <admin-layout>
    <div class="admin-content">
      <div class="d-flex align-center justify-space-between mb-6">
        <h1 class="text-h4">
          <v-icon size="large" class="mr-2">mdi-shield-check</v-icon>
          Security Monitoring
        </h1>
        <v-btn
          color="primary"
          variant="outlined"
          @click="refreshStats"
          :loading="loading"
        >
          <v-icon left class="mr-2">mdi-refresh</v-icon>
          Refresh
        </v-btn>
      </div>

      <!-- Error Alert -->
      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        class="mb-6"
        closable
        @click:close="error = null"
      >
        {{ error }}
      </v-alert>

      <!-- Statistics Cards -->
      <div class="stats-grid mb-6">
        <v-card elevation="2" class="stat-card">
          <v-card-text>
            <div class="stat-header">
              <v-icon color="warning" size="large">mdi-shield-alert</v-icon>
              <span class="stat-label">Total Blocked</span>
            </div>
            <div class="stat-value">{{ stats.monitor?.totalBlocked || 0 }}</div>
            <div class="stat-detail">Block Rate: {{ stats.monitor?.blockRate || '0%' }}</div>
          </v-card-text>
        </v-card>

        <v-card elevation="2" class="stat-card">
          <v-card-text>
            <div class="stat-header">
              <v-icon color="error" size="large">mdi-alert-octagon</v-icon>
              <span class="stat-label">Input Blocked</span>
            </div>
            <div class="stat-value">{{ stats.inputValidator?.blocked || 0 }}</div>
            <div class="stat-detail">{{ stats.inputValidator?.totalValidations || 0 }} total validations</div>
          </v-card-text>
        </v-card>

        <v-card elevation="2" class="stat-card">
          <v-card-text>
            <div class="stat-header">
              <v-icon color="orange" size="large">mdi-filter</v-icon>
              <span class="stat-label">Output Filtered</span>
            </div>
            <div class="stat-value">{{ stats.outputFilter?.offTopicBlocked || 0 }}</div>
            <div class="stat-detail">{{ stats.outputFilter?.dataRedacted || 0 }} data redactions</div>
          </v-card-text>
        </v-card>

        <v-card elevation="2" class="stat-card">
          <v-card-text>
            <div class="stat-header">
              <v-icon color="success" size="large">mdi-check-circle</v-icon>
              <span class="stat-label">Total Requests</span>
            </div>
            <div class="stat-value">{{ stats.monitor?.totalRequests || 0 }}</div>
            <div class="stat-detail">Successfully processed</div>
          </v-card-text>
        </v-card>
      </div>

      <!-- Recent Security Events -->
      <v-card elevation="2" class="mb-6">
        <v-card-title class="pa-6 d-flex align-center justify-space-between">
          <div>
            <v-icon class="mr-2">mdi-history</v-icon>
            Recent Security Events
          </div>
          <v-chip v-if="events.length > 0" color="primary" variant="tonal">
            {{ events.length }} events
          </v-chip>
        </v-card-title>

        <v-divider></v-divider>

        <v-card-text class="pa-0">
          <v-list v-if="events.length > 0" class="py-0">
            <template v-for="(event, index) in events" :key="event.id">
              <v-list-item class="event-item">
                <template v-slot:prepend>
                  <v-icon
                    :color="getEventColor(event.type)"
                    size="large"
                  >
                    {{ getEventIcon(event.type) }}
                  </v-icon>
                </template>

                <v-list-item-title class="font-weight-medium mb-1">
                  {{ formatEventType(event.type) }}
                </v-list-item-title>

                <v-list-item-subtitle>
                  <div class="d-flex flex-column gap-1">
                    <div v-if="event.reason">
                      <v-icon size="small" class="mr-1">mdi-information</v-icon>
                      {{ event.reason }}
                    </div>
                    <div v-if="event.message" class="text-truncate">
                      <v-icon size="small" class="mr-1">mdi-message-text</v-icon>
                      {{ event.message }}
                    </div>
                    <div class="text-caption text-grey">
                      <v-icon size="small" class="mr-1">mdi-clock-outline</v-icon>
                      {{ formatTimestamp(event.timestamp) }}
                    </div>
                  </div>
                </v-list-item-subtitle>

                <template v-slot:append>
                  <v-chip
                    :color="getSeverityColor(event.severity)"
                    variant="tonal"
                    size="small"
                  >
                    {{ event.severity }}
                  </v-chip>
                </template>
              </v-list-item>
              <v-divider v-if="index < events.length - 1"></v-divider>
            </template>
          </v-list>

          <div v-else class="pa-12 text-center text-grey">
            <v-icon size="64" color="grey-lighten-2">mdi-shield-check</v-icon>
            <p class="text-h6 mt-4 mb-2">No Security Events</p>
            <p class="text-body-2">All requests are being processed normally</p>
          </div>
        </v-card-text>
      </v-card>

      <!-- Detailed Statistics -->
      <div class="details-grid">
        <v-card elevation="2">
          <v-card-title class="pa-6">
            <v-icon class="mr-2">mdi-shield-search</v-icon>
            Input Validation Stats
          </v-card-title>
          <v-divider></v-divider>
          <v-card-text class="pa-6">
            <div class="stat-row">
              <span class="stat-row-label">Total Validations:</span>
              <span class="stat-row-value">{{ stats.inputValidator?.totalValidations || 0 }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row-label">Blocked:</span>
              <span class="stat-row-value text-error">{{ stats.inputValidator?.blocked || 0 }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row-label">Allowed:</span>
              <span class="stat-row-value text-success">{{ stats.inputValidator?.allowed || 0 }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row-label">Block Rate:</span>
              <span class="stat-row-value">{{ stats.inputValidator?.blockRate || '0%' }}</span>
            </div>
          </v-card-text>
        </v-card>

        <v-card elevation="2">
          <v-card-title class="pa-6">
            <v-icon class="mr-2">mdi-filter-variant</v-icon>
            Output Filter Stats
          </v-card-title>
          <v-divider></v-divider>
          <v-card-text class="pa-6">
            <div class="stat-row">
              <span class="stat-row-label">Total Filters:</span>
              <span class="stat-row-value">{{ stats.outputFilter?.totalFilters || 0 }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row-label">Off-Topic Blocked:</span>
              <span class="stat-row-value text-warning">{{ stats.outputFilter?.offTopicBlocked || 0 }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row-label">Data Redacted:</span>
              <span class="stat-row-value text-info">{{ stats.outputFilter?.dataRedacted || 0 }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row-label">Redaction Rate:</span>
              <span class="stat-row-value">{{ stats.outputFilter?.redactionRate || '0%' }}</span>
            </div>
          </v-card-text>
        </v-card>

        <v-card elevation="2">
          <v-card-title class="pa-6">
            <v-icon class="mr-2">mdi-tools</v-icon>
            Tool Validator Stats
          </v-card-title>
          <v-divider></v-divider>
          <v-card-text class="pa-6">
            <div class="stat-row">
              <span class="stat-row-label">Total Validations:</span>
              <span class="stat-row-value">{{ stats.toolValidator?.totalValidations || 0 }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row-label">Allowed:</span>
              <span class="stat-row-value text-success">{{ stats.toolValidator?.allowed || 0 }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row-label">Blocked (Unknown):</span>
              <span class="stat-row-value text-error">{{ stats.toolValidator?.blockedUnknown || 0 }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row-label">Rate Limited:</span>
              <span class="stat-row-value text-warning">{{ stats.toolValidator?.blockedRateLimit || 0 }}</span>
            </div>
          </v-card-text>
        </v-card>
      </div>
    </div>
  </admin-layout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import AdminLayout from './AdminLayout.vue'
import axios from 'axios'

const authStore = useAuthStore()

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://quendoo-backend-222402522800.us-central1.run.app'

const stats = ref({})
const events = ref([])
const loading = ref(false)
const error = ref(null)

const fetchSecurityData = async () => {
  loading.value = true
  error.value = null

  try {
    // Fetch stats
    const statsResponse = await axios.get(`${API_BASE_URL}/admin/security/stats`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    stats.value = statsResponse.data

    // Fetch events
    const eventsResponse = await axios.get(`${API_BASE_URL}/admin/security/events?limit=20`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    events.value = eventsResponse.data.events || []

  } catch (err) {
    console.error('Failed to fetch security data:', err)
    error.value = 'Failed to load security data. Please check your authentication.'
  } finally {
    loading.value = false
  }
}

const refreshStats = () => {
  fetchSecurityData()
}

const getEventColor = (type) => {
  const colors = {
    'input_blocked': 'error',
    'output_filtered': 'warning',
    'tool_blocked': 'error',
    'rate_limit_exceeded': 'warning',
    'data_redacted': 'info',
    'request_success': 'success'
  }
  return colors[type] || 'grey'
}

const getEventIcon = (type) => {
  const icons = {
    'input_blocked': 'mdi-alert-octagon',
    'output_filtered': 'mdi-filter',
    'tool_blocked': 'mdi-tools',
    'rate_limit_exceeded': 'mdi-speedometer',
    'data_redacted': 'mdi-eye-off',
    'request_success': 'mdi-check-circle'
  }
  return icons[type] || 'mdi-information'
}

const getSeverityColor = (severity) => {
  const colors = {
    'warning': 'warning',
    'error': 'error',
    'info': 'info'
  }
  return colors[severity] || 'grey'
}

const formatEventType = (type) => {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

  return date.toLocaleString()
}

onMounted(() => {
  fetchSecurityData()

  // Auto-refresh every 30 seconds
  const interval = setInterval(() => {
    fetchSecurityData()
  }, 30000)

  // Cleanup on unmount
  return () => clearInterval(interval)
})
</script>

<style scoped>
.admin-content {
  padding: 24px;
  padding-left: 24px;
  padding-right: 24px;
  width: 100%;
  max-width: none;
  flex: 1;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-left: -24px;
  margin-right: -24px;
  padding-left: 24px;
  padding-right: 24px;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  border-radius: 12px;
}

.stat-card .v-card-text {
  padding: 28px !important;
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.7);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 8px;
}

.stat-detail {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.event-item {
  padding: 20px 24px;
}

.event-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.02);
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.05);
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-row-label {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.stat-row-value {
  font-size: 1rem;
  font-weight: 600;
}

.v-card {
  border-radius: 12px;
}
</style>
