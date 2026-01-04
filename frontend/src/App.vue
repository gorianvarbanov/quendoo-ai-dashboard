<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'
import { useSettingsStore } from '@/stores/settingsStore'

const theme = useTheme()
const settingsStore = useSettingsStore()

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
