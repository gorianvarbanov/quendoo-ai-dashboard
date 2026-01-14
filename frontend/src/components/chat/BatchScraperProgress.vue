<template>
  <div v-if="batchId" class="batch-scraper-progress-minimal">
    <!-- Simple Batch Progress Bar -->
    <div class="progress-container mb-3">
      <div class="d-flex align-center justify-space-between mb-2">
        <span class="text-body-2 text-grey-darken-1">
          Scraping {{ batch.completedHotels }}/{{ batch.totalHotels }} hotels...
        </span>
        <span class="text-body-2 font-weight-bold text-primary">{{ batch.progress }}%</span>
      </div>
      <v-progress-linear
        :model-value="batch.progress"
        height="8"
        rounded
        color="primary"
        bg-opacity="0.2"
      />
    </div>

    <!-- Results Display - Comparison Table -->
    <v-expand-transition>
      <div v-if="batch.status === 'completed' && batch.hotels && batch.hotels.length" class="results-minimal">
        <!-- Success Message & Currency Selector -->
        <div class="d-flex align-center justify-space-between mb-3">
          <div class="d-flex align-center">
            <v-icon color="success" size="20" class="mr-2">mdi-check-circle</v-icon>
            <span class="text-body-2 text-success font-weight-medium">
              {{ batch.completedHotels }} hotels scraped successfully
              <span v-if="batch.failedHotels > 0" class="text-error ml-2">
                ({{ batch.failedHotels }} failed)
              </span>
            </span>
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

        <!-- Comparison Table -->
        <v-table density="compact" class="comparison-table">
          <thead>
            <tr>
              <th class="text-left">Hotel</th>
              <th class="text-center">Rating</th>
              <th class="text-right">Min Price</th>
              <th class="text-right">Max Price</th>
              <th class="text-center">Rooms</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="hotel in sortedHotels"
              :key="hotel.cacheKey"
              :class="{'cheapest-hotel': hotel.isCheapest && hotel.status === 'completed'}"
            >
              <td class="text-body-2">
                <strong>{{ hotel.hotelName || 'Loading...' }}</strong>
              </td>
              <td class="text-center">
                <div v-if="hotel.rating" class="d-flex align-center justify-center">
                  <v-icon size="small" color="warning" class="mr-1">mdi-star</v-icon>
                  <span>{{ hotel.rating }}</span>
                </div>
                <span v-else class="text-grey">-</span>
              </td>
              <td class="text-right">
                <strong v-if="hotel.minPrice" class="text-primary">
                  {{ getCurrencySymbol() }}{{ convertPrice(hotel.minPrice, hotel.currency) }}
                </strong>
                <span v-else class="text-grey">-</span>
              </td>
              <td class="text-right">
                <strong v-if="hotel.maxPrice" class="text-primary">
                  {{ getCurrencySymbol() }}{{ convertPrice(hotel.maxPrice, hotel.currency) }}
                </strong>
                <span v-else class="text-grey">-</span>
              </td>
              <td class="text-center">
                {{ hotel.roomCount || 0 }}
              </td>
              <td class="text-center">
                <v-chip
                  v-if="hotel.status === 'completed'"
                  size="x-small"
                  color="success"
                  variant="flat"
                >
                  Done
                </v-chip>
                <v-chip
                  v-else-if="hotel.status === 'error'"
                  size="x-small"
                  color="error"
                  variant="flat"
                >
                  Error
                </v-chip>
                <v-progress-circular
                  v-else
                  indeterminate
                  size="16"
                  width="2"
                  color="primary"
                />
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-expand-transition>

    <!-- Error Display -->
    <v-expand-transition>
      <div v-if="batch.status === 'error' && batch.failedHotels === batch.totalHotels" class="error-minimal">
        <v-alert
          type="error"
          variant="tonal"
          density="compact"
        >
          All hotels failed to scrape. Please try again.
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
  batchId: {
    type: String,
    default: null
  }
})

// State
const batch = ref({
  status: 'idle',
  progress: 0,
  totalHotels: 0,
  completedHotels: 0,
  failedHotels: 0,
  hotels: []
})

// Currency state
const selectedCurrency = ref('USD')

// Exchange rates (approximate)
const exchangeRates = {
  USD: { USD: 1, EUR: 0.92 },
  EUR: { USD: 1.09, EUR: 1 }
}

// Convert price based on selected currency
const convertPrice = (price, fromCurrency = 'USD') => {
  if (!price) return 0
  const rate = exchangeRates[fromCurrency]?.[selectedCurrency.value] || 1
  return Math.round(price * rate)
}

// Get currency symbol
const getCurrencySymbol = () => {
  const symbols = { USD: '$', EUR: '€' }
  return symbols[selectedCurrency.value] || '$'
}

// Sorted hotels by price (cheapest first)
const sortedHotels = computed(() => {
  const hotels = [...batch.value.hotels]

  // Sort completed hotels by minPrice, then append failed/pending ones
  hotels.sort((a, b) => {
    if (a.status === 'completed' && b.status === 'completed') {
      if (a.minPrice === null) return 1
      if (b.minPrice === null) return -1
      return a.minPrice - b.minPrice
    }
    if (a.status === 'completed') return -1
    if (b.status === 'completed') return 1
    return 0
  })

  // Mark cheapest hotel
  const cheapestHotel = hotels.find(h => h.status === 'completed' && h.minPrice !== null)
  hotels.forEach(h => {
    h.isCheapest = (h === cheapestHotel)
  })

  return hotels
})

// Firestore listener
let unsubscribe = null

watch(() => props.batchId, (newBatchId) => {
  if (!newBatchId) return

  console.log('[BatchScraperProgress] Starting listener for batchId:', newBatchId)

  // Cleanup previous
  if (unsubscribe) {
    console.log('[BatchScraperProgress] Cleaning up previous listener')
    unsubscribe()
  }

  // Reset state
  batch.value = {
    status: 'idle',
    progress: 0,
    totalHotels: 0,
    completedHotels: 0,
    failedHotels: 0,
    hotels: []
  }

  // Try Firestore listener first, fallback to polling if blocked
  const docRef = doc(db, 'scraper_batches', newBatchId)
  let pollingInterval = null

  unsubscribe = onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        console.log('[BatchScraperProgress] Batch document does not exist yet')
        return
      }

      const data = snapshot.data()
      console.log('[BatchScraperProgress] Update received:', {
        status: data.status,
        progress: data.progress,
        completed: data.completedHotels,
        failed: data.failedHotels
      })

      batch.value = {
        status: data.status || 'unknown',
        progress: data.progress || 0,
        totalHotels: data.totalHotels || 0,
        completedHotels: data.completedHotels || 0,
        failedHotels: data.failedHotels || 0,
        hotels: data.hotels || []
      }
    },
    (error) => {
      console.error('[BatchScraperProgress] Firestore listener error:', error)

      // If Firestore is blocked, fallback to HTTP polling
      if (error.code === 'permission-denied' || error.message.includes('permission') || error.message.includes('blocked')) {
        console.warn('[BatchScraperProgress] Firestore blocked, falling back to HTTP polling')

        // Start HTTP polling as fallback
        pollingInterval = setInterval(async () => {
          try {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
            const response = await fetch(`${baseUrl}/scraper/batch/${newBatchId}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('hotelToken')}`
              }
            })

            if (response.ok) {
              const data = await response.json()
              console.log('[BatchScraperProgress] Polling update:', data)

              batch.value = {
                status: data.status || 'unknown',
                progress: data.progress || 0,
                totalHotels: data.totalHotels || 0,
                completedHotels: data.completedHotels || 0,
                failedHotels: data.failedHotels || 0,
                hotels: data.hotels || []
              }

              // Stop polling on completion
              if (data.status === 'completed' || data.status === 'error') {
                clearInterval(pollingInterval)
              }
            }
          } catch (err) {
            console.error('[BatchScraperProgress] Polling error:', err)
          }
        }, 2000) // Poll every 2 seconds
      } else {
        batch.value.status = 'error'
      }
    }
  )
}, { immediate: true })

// Cleanup on unmount
onUnmounted(() => {
  console.log('[BatchScraperProgress] Component unmounting, cleaning up')
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>

<style scoped>
.batch-scraper-progress-minimal {
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

.comparison-table {
  background: white;
  border-radius: 4px;
  overflow: hidden;
}

.comparison-table thead th {
  background: #fafafa;
  font-weight: 600;
  font-size: 0.875rem;
  padding: 8px 12px;
}

.comparison-table tbody td {
  padding: 10px 12px;
  font-size: 0.875rem;
}

.cheapest-hotel {
  background-color: #E8F5E9 !important;
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
