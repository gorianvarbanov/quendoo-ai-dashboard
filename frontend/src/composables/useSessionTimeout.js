/**
 * Session Timeout Management Composable
 * Warns users before token expiration and handles auto-logout
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/plugins/axios'

export function useSessionTimeout() {
  const router = useRouter()

  const showWarning = ref(false)
  const minutesRemaining = ref(0)
  const secondsRemaining = ref(0)

  let warningTimer = null
  let countdownTimer = null

  const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
  const WARNING_BEFORE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes before expiry

  /**
   * Calculate time remaining until token expires
   */
  function getTimeRemaining() {
    const loginTimestamp = localStorage.getItem('loginTimestamp')
    if (!loginTimestamp) {
      return 0
    }

    const loginTime = parseInt(loginTimestamp, 10)
    const expiryTime = loginTime + TOKEN_EXPIRY_MS
    const now = Date.now()
    const remaining = expiryTime - now

    return Math.max(0, remaining)
  }

  /**
   * Format minutes remaining
   */
  function updateCountdown() {
    const remaining = getTimeRemaining()

    if (remaining === 0) {
      // Token expired
      handleExpiry()
      return
    }

    minutesRemaining.value = Math.floor(remaining / 60000)
    secondsRemaining.value = Math.floor((remaining % 60000) / 1000)
  }

  /**
   * Show warning modal
   */
  function showWarningModal() {
    const rememberMe = localStorage.getItem('rememberMe') === 'true'

    // Only show warning if remember me is enabled
    if (!rememberMe) {
      return
    }

    showWarning.value = true
    updateCountdown()

    // Update countdown every second
    countdownTimer = setInterval(() => {
      updateCountdown()
    }, 1000)
  }

  /**
   * Refresh the session
   */
  async function refreshSession() {
    try {
      console.log('[Session] Attempting to refresh session...')
      const hotelToken = localStorage.getItem('hotelToken')
      if (!hotelToken) {
        console.error('[Session] No token found in localStorage')
        throw new Error('No token found')
      }

      console.log('[Session] Making refresh request to /api/hotels/refresh')
      const response = await api.post('/api/hotels/refresh', {})
      console.log('[Session] Refresh response:', response)

      if (response.data.success && response.data.hotelToken) {
        // Update token and timestamp
        localStorage.setItem('hotelToken', response.data.hotelToken)
        localStorage.setItem('loginTimestamp', Date.now().toString())

        // Close warning modal
        showWarning.value = false

        // Clear countdown timer
        if (countdownTimer) {
          clearInterval(countdownTimer)
          countdownTimer = null
        }

        // Restart warning timer
        startWarningTimer()

        console.log('[Session] Session refreshed successfully')
      } else {
        console.error('[Session] Refresh response missing success or token')
        throw new Error('Invalid refresh response')
      }
    } catch (error) {
      console.error('[Session] Failed to refresh session:', error)
      console.error('[Session] Error details:', error.response?.data || error.message)

      // Don't force logout on refresh error - just close the modal and let user try again
      showWarning.value = false
      alert('Неуспешно обновяване на сесията. Моля, влезте отново.')
      handleExpiry()
    }
  }

  /**
   * Handle session expiry - logout user
   */
  function handleExpiry() {
    console.log('[Session] Session expired, logging out')

    // Clear all storage
    localStorage.clear()

    // Close warning modal
    showWarning.value = false

    // Clear timers
    if (warningTimer) {
      clearTimeout(warningTimer)
      warningTimer = null
    }
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }

    // Redirect to login
    router.push('/login')
  }

  /**
   * Manual logout
   */
  function logout() {
    handleExpiry()
  }

  /**
   * Start the warning timer
   */
  function startWarningTimer() {
    const remaining = getTimeRemaining()

    if (remaining === 0) {
      handleExpiry()
      return
    }

    // Calculate when to show warning (5 minutes before expiry)
    const warningTime = remaining - WARNING_BEFORE_EXPIRY_MS

    if (warningTime <= 0) {
      // Show warning immediately if less than 5 minutes remaining
      showWarningModal()
    } else {
      // Set timer to show warning
      warningTimer = setTimeout(() => {
        showWarningModal()
      }, warningTime)
    }

    console.log('[Session] Warning timer set', {
      totalRemaining: Math.floor(remaining / 60000) + ' minutes',
      warningIn: Math.floor(warningTime / 60000) + ' minutes'
    })
  }

  /**
   * Initialize session timeout monitoring
   */
  function init() {
    const hotelToken = localStorage.getItem('hotelToken')
    const rememberMe = localStorage.getItem('rememberMe') === 'true'

    // Only monitor if logged in and remember me is enabled
    if (!hotelToken || !rememberMe) {
      return
    }

    // Check if already expired
    const remaining = getTimeRemaining()
    if (remaining === 0) {
      handleExpiry()
      return
    }

    // Start monitoring
    startWarningTimer()
  }

  /**
   * Clean up timers
   */
  function cleanup() {
    if (warningTimer) {
      clearTimeout(warningTimer)
      warningTimer = null
    }
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }

  // Lifecycle hooks
  onMounted(() => {
    init()
  })

  onUnmounted(() => {
    cleanup()
  })

  return {
    showWarning,
    minutesRemaining,
    secondsRemaining,
    refreshSession,
    logout
  }
}
