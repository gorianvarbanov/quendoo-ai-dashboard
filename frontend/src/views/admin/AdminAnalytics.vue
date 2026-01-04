<template>
  <div class="admin-analytics">
    <AdminLayout>
      <div class="analytics-header">
        <v-icon class="header-icon">mdi-chart-line</v-icon>
        <h1 class="header-title">Analytics Dashboard</h1>
      </div>

      <v-alert v-if="error" type="error" variant="tonal" class="mb-4" dismissible @click:close="error = null">
        {{ error }}
      </v-alert>

      <!-- Statistics Cards -->
      <v-row class="mb-4">
        <!-- Conversation Stats -->
        <v-col cols="12" md="6" lg="3">
          <v-card class="stat-card">
            <v-card-text>
              <div class="stat-icon conversations">
                <v-icon>mdi-message-text</v-icon>
              </div>
              <div class="stat-value">{{ conversationStats.totalConversations || 0 }}</div>
              <div class="stat-label">Total Conversations</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="6" lg="3">
          <v-card class="stat-card">
            <v-card-text>
              <div class="stat-icon messages">
                <v-icon>mdi-chat</v-icon>
              </div>
              <div class="stat-value">{{ conversationStats.totalMessages || 0 }}</div>
              <div class="stat-label">Total Messages</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="6" lg="3">
          <v-card class="stat-card">
            <v-card-text>
              <div class="stat-icon average">
                <v-icon>mdi-calculator</v-icon>
              </div>
              <div class="stat-value">{{ conversationStats.averageMessagesPerConversation || 0 }}</div>
              <div class="stat-label">Avg Messages/Conversation</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="6" lg="3">
          <v-card class="stat-card">
            <v-card-text>
              <div class="stat-icon today">
                <v-icon>mdi-calendar-today</v-icon>
              </div>
              <div class="stat-value">{{ conversationStats.conversationsToday || 0 }}</div>
              <div class="stat-label">Today</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Timeframe Statistics -->
      <v-row class="mb-4">
        <v-col cols="12" md="4">
          <v-card>
            <v-card-title>
              <v-icon class="mr-2">mdi-calendar-week</v-icon>
              This Week
            </v-card-title>
            <v-card-text>
              <div class="timeframe-stat">
                <span class="timeframe-value">{{ conversationStats.conversationsThisWeek || 0 }}</span>
                <span class="timeframe-label">conversations</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <v-card>
            <v-card-title>
              <v-icon class="mr-2">mdi-calendar-month</v-icon>
              This Month
            </v-card-title>
            <v-card-text>
              <div class="timeframe-stat">
                <span class="timeframe-value">{{ conversationStats.conversationsThisMonth || 0 }}</span>
                <span class="timeframe-label">conversations</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <v-card>
            <v-card-title>
              <v-icon class="mr-2">mdi-shield-check</v-icon>
              Security Events (24h)
            </v-card-title>
            <v-card-text>
              <div class="timeframe-stat">
                <span class="timeframe-value">{{ auditStats.securityEvents || 0 }}</span>
                <span class="timeframe-label">events</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Audit Statistics -->
      <v-row class="mb-4">
        <v-col cols="12">
          <v-card>
            <v-card-title>
              <v-icon class="mr-2">mdi-history</v-icon>
              Activity Summary (Last 24 Hours)
            </v-card-title>
            <v-card-text>
              <v-row v-if="auditStats.byAction && Object.keys(auditStats.byAction).length > 0">
                <v-col v-for="(count, action) in auditStats.byAction" :key="action" cols="12" sm="6" md="4">
                  <div class="activity-item">
                    <v-chip :color="getActionColor(action)" variant="tonal" class="activity-chip">
                      {{ formatActionName(action) }}
                    </v-chip>
                    <span class="activity-count">{{ count }}</span>
                  </div>
                </v-col>
              </v-row>
              <v-alert v-else type="info" variant="tonal">
                No activity recorded in the last 24 hours
              </v-alert>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Refresh Button -->
      <v-row>
        <v-col cols="12" class="text-center">
          <v-btn
            color="primary"
            @click="loadAnalytics"
            :loading="loading"
            prepend-icon="mdi-refresh"
          >
            Refresh Statistics
          </v-btn>
        </v-col>
      </v-row>
    </AdminLayout>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AdminLayout from './AdminLayout.vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()

const loading = ref(false)
const error = ref(null)
const conversationStats = ref({})
const auditStats = ref({})

const loadAnalytics = async () => {
  loading.value = true
  error.value = null

  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

    // Load conversation statistics
    const convResponse = await axios.get(`${baseUrl}/admin/analytics/conversation-stats`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    conversationStats.value = convResponse.data.stats

    // Load audit statistics
    const auditResponse = await axios.get(`${baseUrl}/admin/analytics/audit-stats?hours=24`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    auditStats.value = auditResponse.data.stats || {}

  } catch (err) {
    console.error('Analytics load error:', err)
    error.value = err.response?.data?.error || 'Failed to load analytics'
  } finally {
    loading.value = false
  }
}

const formatActionName = (action) => {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const getActionColor = (action) => {
  if (action.includes('login')) return 'primary'
  if (action.includes('failed')) return 'error'
  if (action.includes('message')) return 'success'
  if (action.includes('deleted')) return 'warning'
  return 'default'
}

onMounted(() => {
  loadAnalytics()
})
</script>

<style scoped>
.admin-analytics {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.analytics-header {
  display: flex;
  align-items: center;
  margin-bottom: 32px;
}

.header-icon {
  font-size: 40px;
  margin-right: 16px;
  color: rgb(var(--v-theme-primary));
}

.header-title {
  font-size: 32px;
  font-weight: 600;
  color: #1a1a1a;
}

.stat-card {
  height: 100%;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.stat-icon.conversations {
  background-color: rgba(33, 150, 243, 0.1);
  color: #2196F3;
}

.stat-icon.messages {
  background-color: rgba(76, 175, 80, 0.1);
  color: #4CAF50;
}

.stat-icon.average {
  background-color: rgba(255, 152, 0, 0.1);
  color: #FF9800;
}

.stat-icon.today {
  background-color: rgba(156, 39, 176, 0.1);
  color: #9C27B0;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.timeframe-stat {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.timeframe-value {
  font-size: 32px;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}

.timeframe-label {
  font-size: 14px;
  color: #666;
}

.activity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background-color: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 8px;
}

.activity-chip {
  font-weight: 500;
}

.activity-count {
  font-size: 20px;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}
</style>
