<template>
  <v-container fluid>
    <!-- Page Header -->
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 font-weight-bold mb-2">Currency Exchange Rates</h1>
        <p class="text-subtitle-1 text-grey">
          Exchange rates from ECB (European Central Bank)
        </p>
      </v-col>
    </v-row>

    <!-- Status & Refresh Card -->
    <v-row>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title class="d-flex align-center justify-space-between">
            <span>Rate Status</span>
            <v-chip
              :color="statusColor"
              size="small"
              variant="flat"
            >
              {{ statusText }}
            </v-chip>
          </v-card-title>
          <v-card-text>
            <div v-if="lastUpdated" class="mb-4">
              <div class="text-body-2 text-grey mb-1">Last Updated</div>
              <div class="text-h6">{{ formatDate(lastUpdated) }}</div>
              <div class="text-caption text-grey">{{ formatTime(lastUpdated) }}</div>
            </div>
            <div v-else class="text-body-2 text-grey mb-4">
              No rates fetched yet. Click "Refresh Rates" to fetch from ECB.
            </div>

            <v-btn
              color="primary"
              prepend-icon="mdi-refresh"
              :loading="refreshing"
              :disabled="refreshing"
              @click="refreshRates"
              block
            >
              Refresh Rates from ECB
            </v-btn>

            <v-alert
              v-if="error"
              type="error"
              variant="tonal"
              density="compact"
              class="mt-3"
            >
              {{ error }}
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Rate Source Info -->
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>About ECB Rates</v-card-title>
          <v-card-text>
            <v-list density="compact" class="bg-transparent">
              <v-list-item prepend-icon="mdi-bank">
                <v-list-item-title>Source</v-list-item-title>
                <v-list-item-subtitle>European Central Bank (ECB)</v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-clock-outline">
                <v-list-item-title>Update Frequency</v-list-item-title>
                <v-list-item-subtitle>Manual (click "Refresh Rates")</v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-calendar">
                <v-list-item-title>ECB Publishes</v-list-item-title>
                <v-list-item-subtitle>Daily at ~16:00 CET on working days</v-list-item-subtitle>
              </v-list-item>
              <v-list-item prepend-icon="mdi-currency-eur">
                <v-list-item-title>Base Currency</v-list-item-title>
                <v-list-item-subtitle>EUR (Euro)</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Current Exchange Rates Table -->
    <v-row v-if="rates">
      <v-col cols="12">
        <v-card>
          <v-card-title>Current Exchange Rates (Cross-Rates)</v-card-title>
          <v-card-text>
            <p class="text-body-2 text-grey mb-4">
              Cross-rates between all supported currencies.
              Example: 1 USD = {{ rates.USD?.EUR?.toFixed(4) }} EUR
            </p>

            <v-table>
              <thead>
                <tr>
                  <th class="text-left font-weight-bold">From → To</th>
                  <th class="text-center font-weight-bold">USD ($)</th>
                  <th class="text-center font-weight-bold">EUR (€)</th>
                  <th class="text-center font-weight-bold">BGN (лв)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="fromCurrency in ['USD', 'EUR', 'BGN']" :key="fromCurrency">
                  <td class="font-weight-bold">{{ fromCurrency }}</td>
                  <td
                    v-for="toCurrency in ['USD', 'EUR', 'BGN']"
                    :key="toCurrency"
                    class="text-center"
                    :class="{ 'bg-grey-lighten-4': fromCurrency === toCurrency }"
                  >
                    <span v-if="fromCurrency === toCurrency" class="text-grey">1.0000</span>
                    <span v-else class="font-weight-medium">
                      {{ rates[fromCurrency]?.[toCurrency]?.toFixed(4) || 'N/A' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- ECB Raw Rates (EUR-based) -->
    <v-row v-if="ecbRates">
      <v-col cols="12">
        <v-card>
          <v-card-title>ECB Raw Rates (EUR-based)</v-card-title>
          <v-card-text>
            <p class="text-body-2 text-grey mb-4">
              Official rates from ECB. Format: 1 EUR = X [Currency]
            </p>

            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-left">Currency</th>
                  <th class="text-right">Rate (1 EUR = ?)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(rate, currency) in ecbRates" :key="currency">
                  <td class="font-weight-bold">{{ currency }}</td>
                  <td class="text-right">{{ rate.toFixed(4) }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Success Snackbar -->
    <v-snackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="top"
    >
      {{ snackbarMessage }}
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import axios from 'axios'

const authStore = useAuthStore()
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

// State
const rates = ref(null)          // Cross-rates: { USD: { USD: 1, EUR: 0.92, ... }, ... }
const ecbRates = ref(null)       // Raw ECB rates: { USD: 1.0892, BGN: 1.9558, ... }
const lastUpdated = ref(null)    // Date object
const status = ref('idle')       // 'idle' | 'success' | 'error'
const error = ref(null)          // Error message
const refreshing = ref(false)    // Loading state for refresh button
const loading = ref(true)        // Initial load

// Snackbar
const snackbar = ref(false)
const snackbarMessage = ref('')
const snackbarColor = ref('success')

// Computed
const statusColor = computed(() => {
  switch (status.value) {
    case 'success': return 'success'
    case 'error': return 'error'
    default: return 'grey'
  }
})

const statusText = computed(() => {
  switch (status.value) {
    case 'success': return 'Up to date'
    case 'error': return 'Error'
    default: return 'Not fetched'
  }
})

// Methods
async function fetchCurrentRates() {
  try {
    const token = authStore.token
    const response = await axios.get(`${baseURL}/admin/currency/rates`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (response.data.success) {
      rates.value = response.data.rates
      ecbRates.value = response.data.ecbRates
      status.value = response.data.status || 'success'
      error.value = response.data.error

      if (response.data.timestamp) {
        lastUpdated.value = new Date(response.data.timestamp * 1000)
      }
    }
  } catch (err) {
    console.error('[AdminCurrency] Failed to fetch rates:', err)
    error.value = err.response?.data?.error || err.message
    status.value = 'error'
  } finally {
    loading.value = false
  }
}

async function refreshRates() {
  refreshing.value = true
  error.value = null

  try {
    const token = authStore.token
    const response = await axios.post(`${baseURL}/admin/currency/refresh`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (response.data.success) {
      // Update local state
      rates.value = response.data.rates
      ecbRates.value = response.data.ecbRates
      lastUpdated.value = new Date(response.data.timestamp * 1000)
      status.value = 'success'
      error.value = null

      // Show success message
      snackbarMessage.value = 'Currency rates updated successfully!'
      snackbarColor.value = 'success'
      snackbar.value = true

      console.log('[AdminCurrency] Rates refreshed:', response.data)
    } else {
      throw new Error(response.data.error || 'Failed to refresh rates')
    }
  } catch (err) {
    console.error('[AdminCurrency] Refresh failed:', err)
    error.value = err.response?.data?.error || err.message
    status.value = 'error'

    // Show error message
    snackbarMessage.value = `Failed to refresh rates: ${error.value}`
    snackbarColor.value = 'error'
    snackbar.value = true
  } finally {
    refreshing.value = false
  }
}

function formatDate(date) {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

function formatTime(date) {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Lifecycle
onMounted(() => {
  fetchCurrentRates()
})
</script>

<style scoped>
.v-table thead th {
  font-size: 0.875rem !important;
}

.v-table tbody td {
  font-size: 0.875rem !important;
}
</style>
