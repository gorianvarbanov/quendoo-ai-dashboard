<script setup>
import { onMounted, onUnmounted, computed, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSessionTimeout } from '@/composables/useSessionTimeout'
import { t } from '@/i18n/translations'

const theme = useTheme()
const settingsStore = useSettingsStore()

// Session timeout management
const { showWarning, minutesRemaining, secondsRemaining, refreshSession, logout } = useSessionTimeout()
const refreshError = ref(null)
const refreshing = ref(false)

// Get language from hotel settings
const language = computed(() => {
  const hotelData = localStorage.getItem('hotelData')
  if (hotelData) {
    try {
      const parsed = JSON.parse(hotelData)
      return parsed.language || 'en'
    } catch (e) {
      return 'en'
    }
  }
  return 'en'
})

// Translations for session timeout dialog
const sessionTranslations = computed(() => ({
  sessionExpiring: t('sessionExpiring', language.value),
  sessionExpiringDesc: t('sessionExpiringDesc', language.value),
  minutes: t('minutes', language.value),
  seconds: t('seconds', language.value),
  continueWorking: t('continueWorking', language.value),
  exit: t('exit', language.value),
  continue: t('continue', language.value)
}))

// Handle refresh session with error handling
async function handleRefreshSession() {
  console.log('[App] handleRefreshSession called, showWarning before:', showWarning.value)
  refreshError.value = null
  refreshing.value = true

  try {
    const result = await refreshSession()
    console.log('[App] refreshSession succeeded, result:', result)
    console.log('[App] showWarning after success:', showWarning.value)
    // Success - modal will close automatically in refreshSession()
    // Clear any previous errors
    refreshError.value = null
  } catch (error) {
    console.log('[App] refreshSession failed:', error)
    console.log('[App] showWarning after error:', showWarning.value)
    // Show error message
    const errorMessage = error.response?.data?.error || error.message || 'Failed to refresh session'
    refreshError.value = errorMessage
  } finally {
    refreshing.value = false
    console.log('[App] handleRefreshSession complete, showWarning final:', showWarning.value)
  }
}

// Handle logout
function handleLogout() {
  console.log('[App] handleLogout called')
  logout()
}

// Watch for modal closing to clear errors
watch(showWarning, (isOpen) => {
  if (!isOpen) {
    refreshError.value = null
  }
})

// PostMessage listener for Quendoo integration
const handlePostMessage = (event) => {
  // Security: Only accept messages from trusted origins
  const trustedOrigins = [
    'https://quendoo.com',
    'https://www.quendoo.com',
    'https://admin.quendoo.com',
    'http://localhost',
    'http://localhost:8080',
    'http://localhost:3000'
  ]

  // Check if origin is trusted
  const isTrusted = trustedOrigins.some(origin => event.origin.startsWith(origin))

  if (!isTrusted) {
    console.warn('[PostMessage] Rejected message from untrusted origin:', event.origin)
    return
  }

  // Handle different message types
  if (event.data && typeof event.data === 'object') {
    switch (event.data.type) {
      case 'QUENDOO_API_KEY':
        console.log('[PostMessage] Received Quendoo API key from parent window')
        if (event.data.apiKey) {
          settingsStore.setQuendooApiKey(event.data.apiKey)
          console.log('[PostMessage] Quendoo API key saved successfully')

          // Send confirmation back to parent
          if (event.source) {
            event.source.postMessage({
              type: 'QUENDOO_API_KEY_RECEIVED',
              success: true
            }, event.origin)
          }
        }
        break

      case 'QUENDOO_CONFIG':
        console.log('[PostMessage] Received Quendoo configuration')
        if (event.data.apiKey) {
          settingsStore.setQuendooApiKey(event.data.apiKey)
        }
        if (event.data.hotelId) {
          console.log('[PostMessage] Hotel ID:', event.data.hotelId)
          // Can store hotel context if needed
        }
        if (event.data.userId) {
          console.log('[PostMessage] User ID:', event.data.userId)
          // Can store user context if needed
        }

        // Send confirmation
        if (event.source) {
          event.source.postMessage({
            type: 'QUENDOO_CONFIG_RECEIVED',
            success: true
          }, event.origin)
        }
        break

      default:
        console.log('[PostMessage] Unknown message type:', event.data.type)
    }
  }
}

onMounted(() => {
  console.log('[PostMessage] Listener initialized')
  window.addEventListener('message', handlePostMessage)

  // Notify parent window that chatbot is ready
  if (window.parent !== window) {
    console.log('[PostMessage] Notifying parent that chatbot is ready')
    window.parent.postMessage({
      type: 'CHATBOT_READY'
    }, '*')
  }
})

onUnmounted(() => {
  window.removeEventListener('message', handlePostMessage)
})
</script>

<template>
  <v-app>
    <v-main class="main-container">
      <router-view />
    </v-main>

    <!-- Session Timeout Warning Dialog -->
    <v-dialog
      v-model="showWarning"
      persistent
      max-width="450"
    >
      <v-card>
        <v-card-title class="d-flex align-center pa-4">
          <v-icon color="warning" size="28" class="mr-2">mdi-clock-alert-outline</v-icon>
          <span class="text-h6">{{ sessionTranslations.sessionExpiring }}</span>
        </v-card-title>

        <v-divider />

        <v-card-text class="pa-4">
          <p class="text-body-1 mb-3">
            {{ sessionTranslations.sessionExpiringDesc }}:
          </p>
          <div class="d-flex justify-center align-center my-4">
            <div class="text-center">
              <div class="text-h3 font-weight-bold text-warning">
                {{ minutesRemaining }}:{{ secondsRemaining.toString().padStart(2, '0') }}
              </div>
              <div class="text-caption text-medium-emphasis mt-1">
                {{ sessionTranslations.minutes }}:{{ sessionTranslations.seconds }}
              </div>
            </div>
          </div>
          <p class="text-body-2 text-medium-emphasis">
            {{ sessionTranslations.continueWorking }}
          </p>

          <!-- Error Alert -->
          <v-alert
            v-if="refreshError"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-4"
            closable
            @click:close="refreshError = null"
          >
            {{ refreshError }}
          </v-alert>
        </v-card-text>

        <v-divider />

        <v-card-actions class="pa-4">
          <v-btn
            variant="text"
            @click="handleLogout"
            :disabled="refreshing"
          >
            {{ sessionTranslations.exit }}
          </v-btn>
          <v-spacer />
          <v-btn
            color="primary"
            variant="elevated"
            @click="handleRefreshSession"
            prepend-icon="mdi-refresh"
            :loading="refreshing"
            :disabled="refreshing"
          >
            {{ sessionTranslations.continue }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<style>
#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  letter-spacing: -0.01em;
}

.main-container {
  background: rgb(var(--v-theme-surface));
  min-height: 100vh;
  padding: 0 !important;
  margin: 0 !important;
}

.main-container :deep(.v-main__wrap) {
  padding: 0 !important;
  margin: 0 !important;
}

/* Custom scrollbar for webkit browsers */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface), 0.3);
}
</style>
