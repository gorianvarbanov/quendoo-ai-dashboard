import { ref, computed, onMounted, onUnmounted } from 'vue'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase'

// Shared state across all components (singleton pattern)
const exchangeRates = ref({
  USD: { USD: 1, EUR: 0.92, BGN: 1.80 },  // Fallback defaults
  EUR: { USD: 1.09, EUR: 1, BGN: 1.96 },
  BGN: { USD: 0.56, EUR: 0.51, BGN: 1 }
})

const lastUpdated = ref(null)
const isLoading = ref(true)
const error = ref(null)

let unsubscribe = null
let subscriptionCount = 0

/**
 * Composable for accessing ECB currency exchange rates
 *
 * Features:
 * - Real-time Firestore listener
 * - Automatic fallback to hardcoded rates
 * - Shared state (singleton) across components
 * - Automatic cleanup
 *
 * Usage:
 * const { exchangeRates, lastUpdated, convertPrice } = useCurrencyRates()
 */
export function useCurrencyRates() {
  // Subscribe to Firestore updates
  const subscribe = () => {
    subscriptionCount++

    // Only create listener once (singleton)
    if (subscriptionCount === 1) {
      console.log('[useCurrencyRates] Starting Firestore listener')

      const docRef = doc(db, 'currency_rates', 'latest')

      unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data()

            if (data.status === 'success' && data.crossRates) {
              exchangeRates.value = data.crossRates
              lastUpdated.value = data.updatedAt?.toDate() || new Date(data.timestamp * 1000)
              error.value = null
              console.log('[useCurrencyRates] Rates updated:', data.date)
            } else if (data.status === 'error') {
              error.value = data.error
              console.warn('[useCurrencyRates] ECB fetch error:', data.error)
              // Keep using fallback rates
            }
          } else {
            console.warn('[useCurrencyRates] No rates document found, using fallback')
          }
          isLoading.value = false
        },
        (err) => {
          console.error('[useCurrencyRates] Firestore error:', err)
          error.value = err.message
          isLoading.value = false
          // Keep using fallback rates
        }
      )
    }
  }

  // Unsubscribe from Firestore
  const unsubscribeListener = () => {
    subscriptionCount--

    // Only cleanup when no components are using it
    if (subscriptionCount === 0 && unsubscribe) {
      console.log('[useCurrencyRates] Stopping Firestore listener')
      unsubscribe()
      unsubscribe = null
    }
  }

  // Auto-subscribe on mount
  onMounted(() => {
    subscribe()
  })

  // Auto-unsubscribe on unmount
  onUnmounted(() => {
    unsubscribeListener()
  })

  // Computed: Get currency symbol
  const getCurrencySymbol = (currency) => {
    const symbols = {
      USD: '$',
      EUR: '€',
      BGN: 'лв',
      GBP: '£',
      CHF: 'CHF'
    }
    return symbols[currency] || currency
  }

  // Method: Convert price between currencies
  const convertPrice = (price, fromCurrency = 'USD', toCurrency = 'USD') => {
    if (!price) return 0

    // Normalize currency symbols to codes
    const currencyMap = {
      '$': 'USD',
      '€': 'EUR',
      'лв': 'BGN',
      'BGN': 'BGN',
      'USD': 'USD',
      'EUR': 'EUR'
    }

    const from = currencyMap[fromCurrency] || fromCurrency.toUpperCase()
    const to = currencyMap[toCurrency] || toCurrency.toUpperCase()

    // If same currency, no conversion needed
    if (from === to) return Math.round(price)

    // Get exchange rate
    const rate = exchangeRates.value[from]?.[to]

    if (!rate) {
      console.warn(`No exchange rate for ${from} -> ${to}, using original price`)
      return Math.round(price)
    }

    return Math.round(price * rate)
  }

  return {
    exchangeRates: computed(() => exchangeRates.value),
    lastUpdated: computed(() => lastUpdated.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    getCurrencySymbol,
    convertPrice
  }
}
