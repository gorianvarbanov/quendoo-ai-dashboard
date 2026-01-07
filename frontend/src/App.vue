<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSessionTimeout } from '@/composables/useSessionTimeout'

const theme = useTheme()
const settingsStore = useSettingsStore()

// Session timeout management
const { showWarning, minutesRemaining, secondsRemaining, refreshSession, logout } = useSessionTimeout()

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
          <span class="text-h6">Сесията Ви скоро изтича</span>
        </v-card-title>

        <v-divider />

        <v-card-text class="pa-4">
          <p class="text-body-1 mb-3">
            Вашата сесия ще изтече след:
          </p>
          <div class="d-flex justify-center align-center my-4">
            <div class="text-center">
              <div class="text-h3 font-weight-bold text-warning">
                {{ minutesRemaining }}:{{ secondsRemaining.toString().padStart(2, '0') }}
              </div>
              <div class="text-caption text-medium-emphasis mt-1">
                минути:секунди
              </div>
            </div>
          </div>
          <p class="text-body-2 text-medium-emphasis">
            Искате ли да продължите да работите? Натиснете "Продължи" за да обновите сесията си.
          </p>
        </v-card-text>

        <v-divider />

        <v-card-actions class="pa-4">
          <v-btn
            variant="text"
            @click="logout"
          >
            Излез
          </v-btn>
          <v-spacer />
          <v-btn
            color="primary"
            variant="elevated"
            @click="refreshSession"
            prepend-icon="mdi-refresh"
          >
            Продължи
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
