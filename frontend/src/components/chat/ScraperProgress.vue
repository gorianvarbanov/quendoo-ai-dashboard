<template>
  <div v-if="cacheKey" class="scraper-progress-minimal">
    <!-- Simple Progress Bar -->
    <div class="progress-container mb-3">
      <div class="d-flex align-center justify-space-between mb-2">
        <span class="text-body-2 text-grey-darken-1">{{ progress.message || 'Scraping...' }}</span>
        <span class="text-body-2 font-weight-bold text-primary">{{ progress.progress }}%</span>
      </div>
      <v-progress-linear
        :model-value="progress.progress"
        height="8"
        rounded
        color="primary"
        bg-opacity="0.2"
      />
    </div>

    <!-- Results Display (когато завърши успешно) -->
    <v-expand-transition>
      <div v-if="progress.status === 'completed' && progress.result" class="results-minimal">
        <!-- Success Message & Currency Selector -->
        <div class="d-flex align-center justify-space-between mb-3">
          <div class="d-flex align-center">
            <v-icon color="success" size="20" class="mr-2">mdi-check-circle</v-icon>
            <span class="text-body-2 text-success font-weight-medium">Scraping завършен успешно</span>
          </div>
          <v-btn-toggle
            v-model="selectedCurrency"
            mandatory
            color="primary"
            density="compact"
            variant="outlined"
          >
            <v-btn value="USD" size="small">
              $ USD
            </v-btn>
            <v-btn value="EUR" size="small">
              € EUR
            </v-btn>
          </v-btn-toggle>
        </div>

        <!-- Hotel Name -->
        <div class="mb-3">
          <strong class="text-subtitle-1">{{ progress.result.hotelName }}</strong>
        </div>

        <!-- Search Parameters -->
        <div class="search-params mb-3">
          <v-chip v-if="progress.checkIn && progress.checkOut" size="small" variant="tonal" color="primary" class="mr-2">
            <v-icon size="small" class="mr-1">mdi-calendar</v-icon>
            {{ formatDate(progress.checkIn) }} - {{ formatDate(progress.checkOut) }}
          </v-chip>
          <v-chip v-if="progress.adults" size="small" variant="tonal" color="primary" class="mr-2">
            <v-icon size="small" class="mr-1">mdi-account-multiple</v-icon>
            {{ progress.adults || 2 }} adults
            <span v-if="progress.children">, {{ progress.children }} children</span>
          </v-chip>
          <v-chip v-if="progress.rooms" size="small" variant="tonal" color="primary">
            <v-icon size="small" class="mr-1">mdi-bed</v-icon>
            {{ progress.rooms || 1 }} room{{ (progress.rooms || 1) > 1 ? 's' : '' }}
          </v-chip>
        </div>

        <!-- Summary Chips -->
        <div class="d-flex flex-wrap gap-2 mb-3" v-if="progress.result.prices && progress.result.prices.length">
          <v-chip size="small" variant="outlined">
            {{ getCurrencySymbol() }}{{ convertPrice(Math.min(...progress.result.prices)) }} - {{ getCurrencySymbol() }}{{ convertPrice(Math.max(...progress.result.prices)) }}
          </v-chip>
          <v-chip size="small" variant="outlined">
            {{ progress.result.rooms?.length || 0 }} стаи
          </v-chip>
          <v-chip
            v-if="progress.result.rooms?.some(r => r.available)"
            size="small"
            color="success"
            variant="outlined"
          >
            Налични
          </v-chip>
        </div>

        <!-- Simple Rooms Table -->
        <v-table v-if="progress.result.rooms && progress.result.rooms.length" density="compact" class="minimal-table">
          <thead>
            <tr>
              <th class="text-left">Стая</th>
              <th class="text-right">Цена</th>
              <th class="text-center">Капацитет</th>
              <th class="text-center">Наличност</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(room, index) in progress.result.rooms.slice(0, 5)" :key="index">
              <td class="text-body-2">{{ room.name }}</td>
              <td class="text-right">
                <strong class="text-primary">{{ getCurrencySymbol() }}{{ convertPrice(room.price, room.currency) }}</strong>
              </td>
              <td class="text-center">{{ room.maxOccupancy }}</td>
              <td class="text-center">
                <v-chip
                  :color="room.available ? 'success' : 'error'"
                  size="x-small"
                  variant="flat"
                >
                  {{ room.available ? 'Да' : 'Не' }}
                </v-chip>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-expand-transition>

    <!-- Error Display -->
    <v-expand-transition>
      <div v-if="progress.status === 'error'" class="error-minimal">
        <v-alert
          type="error"
          variant="tonal"
          density="compact"
        >
          {{ progress.error }}
        </v-alert>
      </div>
    </v-expand-transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase'

const props = defineProps({
  cacheKey: {
    type: String,
    default: null
  }
})

// State
const progress = ref({
  status: 'idle',
  progress: 0,
  message: '',
  result: null,
  error: null,
  checkIn: null,
  checkOut: null,
  adults: null,
  children: null,
  rooms: null
})

const elapsedTime = ref(0)
const startTime = ref(Date.now())
let timerInterval = null

// Currency state
const selectedCurrency = ref('USD')

// Exchange rates (updated regularly)
const exchangeRates = {
  USD: { USD: 1, EUR: 0.92, BGN: 1.80 },
  EUR: { USD: 1.09, EUR: 1, BGN: 1.96 },
  BGN: { USD: 0.56, EUR: 0.51, BGN: 1 }
}

// Computed
const timeRemaining = computed(() => {
  const estimated = 35 // seconds
  return Math.max(0, estimated - elapsedTime.value)
})

// Convert price based on selected currency
const convertPrice = (price, fromCurrency = 'USD') => {
  if (!price) return 0

  // Normalize currency symbols to codes (for backward compatibility)
  const currencyMap = {
    '$': 'USD',
    '€': 'EUR',
    'лв': 'BGN',
    'BGN': 'BGN',
    'USD': 'USD',
    'EUR': 'EUR'
  }

  const from = currencyMap[(fromCurrency || 'USD')] || (fromCurrency || 'USD').toUpperCase()
  const to = selectedCurrency.value.toUpperCase()

  // If same currency, no conversion needed
  if (from === to) return Math.round(price)

  // Get exchange rate
  const rate = exchangeRates[from]?.[to]

  if (!rate) {
    console.warn(`No exchange rate for ${from} -> ${to}, using original price`)
    return Math.round(price)
  }

  return Math.round(price * rate)
}

// Get currency symbol
const getCurrencySymbol = () => {
  const symbols = { USD: '$', EUR: '€' }
  return symbols[selectedCurrency.value] || '$'
}

// Format date for display
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  } catch {
    return dateStr
  }
}

// Methods
function getStatusIcon() {
  switch (progress.value.status) {
    case 'in_progress': return 'mdi-loading'
    case 'completed': return 'mdi-check-circle'
    case 'error': return 'mdi-alert-circle'
    default: return 'mdi-information'
  }
}

// Firestore listener
let unsubscribe = null

watch(() => props.cacheKey, (newKey) => {
  if (!newKey) return

  console.log('[ScraperProgress] Starting listener for cacheKey:', newKey)

  // Cleanup previous
  if (unsubscribe) {
    console.log('[ScraperProgress] Cleaning up previous listener')
    unsubscribe()
  }

  // Reset state
  progress.value = {
    status: 'idle',
    progress: 0,
    message: 'Стартиране на scraper...',
    result: null,
    error: null,
    checkIn: null,
    checkOut: null,
    adults: null,
    children: null,
    rooms: null
  }

  // Start timer
  startTime.value = Date.now()
  if (timerInterval) clearInterval(timerInterval)

  timerInterval = setInterval(() => {
    if (progress.value.status === 'in_progress' || progress.value.status === 'idle') {
      elapsedTime.value = Math.floor((Date.now() - startTime.value) / 1000)
    }
  }, 1000)

  // Try Firestore listener first, fallback to polling if blocked
  const docRef = doc(db, 'competitor_price_cache', newKey)
  let pollingInterval = null
  let firestoreBlocked = false

  unsubscribe = onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        console.log('[ScraperProgress] Document does not exist yet')
        return
      }

      const data = snapshot.data()
      console.log('[ScraperProgress] Update received:', {
        status: data.status,
        progress: data.progress,
        message: data.message
      })

      progress.value = {
        status: data.status || 'unknown',
        progress: data.progress || 0,
        message: data.message || '',
        result: data.result || null,
        error: data.error || null,
        checkIn: data.checkIn || null,
        checkOut: data.checkOut || null,
        adults: data.adults || null,
        children: data.children || null,
        rooms: data.rooms || null
      }

      // Stop timer on completion
      if (data.status === 'completed' || data.status === 'error') {
        console.log('[ScraperProgress] Scraping finished:', data.status)
        if (timerInterval) {
          clearInterval(timerInterval)
          timerInterval = null
        }
      }
    },
    (error) => {
      console.error('[ScraperProgress] Firestore listener error:', error)

      // If Firestore is blocked, fallback to HTTP polling
      if (error.code === 'permission-denied' || error.message.includes('permission') || error.message.includes('blocked')) {
        console.warn('[ScraperProgress] Firestore blocked, falling back to HTTP polling')
        firestoreBlocked = true

        // Start HTTP polling as fallback
        pollingInterval = setInterval(async () => {
          try {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
            const response = await fetch(`${baseUrl}/scraper/status/${newKey}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('hotelToken')}`
              }
            })

            if (response.ok) {
              const data = await response.json()
              console.log('[ScraperProgress] Polling update:', data)

              progress.value = {
                status: data.status || 'unknown',
                progress: data.progress || 0,
                message: data.message || '',
                result: data.result || null,
                error: data.error || null,
                checkIn: data.checkIn || null,
                checkOut: data.checkOut || null,
                adults: data.adults || null,
                children: data.children || null,
                rooms: data.rooms || null
              }

              // Stop polling on completion
              if (data.status === 'completed' || data.status === 'error') {
                clearInterval(pollingInterval)
                if (timerInterval) {
                  clearInterval(timerInterval)
                  timerInterval = null
                }
              }
            }
          } catch (err) {
            console.error('[ScraperProgress] Polling error:', err)
          }
        }, 2000) // Poll every 2 seconds
      } else {
        progress.value.status = 'error'
        progress.value.error = error.message
      }
    }
  )
}, { immediate: true })

// Cleanup on unmount
onUnmounted(() => {
  console.log('[ScraperProgress] Component unmounting, cleaning up')
  if (unsubscribe) {
    unsubscribe()
  }
  if (timerInterval) {
    clearInterval(timerInterval)
  }
})
</script>

<style scoped>
.scraper-progress-minimal {
  padding: 12px 0;
  animation: fadeIn 0.3s ease-in;
}

.progress-container {
  background: transparent;
}

.results-minimal {
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
  border-left: 3px solid #4CAF50;
}

.minimal-table {
  background: white;
  border-radius: 4px;
  overflow: hidden;
}

.minimal-table thead th {
  background: #fafafa;
  font-weight: 600;
  font-size: 0.875rem;
  padding: 8px 12px;
}

.minimal-table tbody td {
  padding: 10px 12px;
  font-size: 0.875rem;
}

.error-minimal {
  margin-top: 8px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
