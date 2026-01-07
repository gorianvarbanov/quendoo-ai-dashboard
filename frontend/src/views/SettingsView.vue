<template>
  <div>
    <div class="settings-layout">
      <div class="settings-container">
        <div class="settings-header">
          <h1 class="settings-title">Settings</h1>
          <v-btn
            variant="outlined"
            prepend-icon="mdi-arrow-left"
            @click="goBackToChat"
            class="back-button"
          >
            Back to Chat
          </v-btn>
        </div>

        <div class="settings-content">
        <!-- Hotel Registration Status -->
        <div class="settings-card">
          <div class="card-header">
            <v-icon class="header-icon">mdi-hotel</v-icon>
            <span class="header-title">Hotel Registration</span>
          </div>
          <div class="card-content">
            <v-alert
              v-if="!isHotelRegistered"
              type="info"
              variant="tonal"
              class="mb-4"
            >
              <div class="text-subtitle-2 mb-2">Registration Required</div>
              <div class="text-body-2">
                To use the Quendoo AI chatbot, you need to register your hotel with your Quendoo API key.
                This will enable secure access to your hotel data and reservation system.
              </div>
            </v-alert>

            <v-alert
              v-else
              type="success"
              variant="tonal"
              class="mb-4"
            >
              <div class="text-subtitle-2 mb-2">Hotel Registered</div>
              <div class="text-body-2">
                Your hotel is successfully registered and ready to use the AI assistant.
              </div>
            </v-alert>

            <div v-if="isHotelRegistered" class="hotel-info mb-4">
              <div class="info-row">
                <span class="info-label">Hotel ID:</span>
                <span class="info-value font-mono">{{ hotelId }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Hotel Name:</span>
                <span class="info-value">{{ hotelName }}</span>
              </div>
            </div>

            <v-btn
              v-if="!isHotelRegistered"
              color="primary"
              @click="goToRegistration"
              prepend-icon="mdi-plus-circle"
            >
              Register Hotel
            </v-btn>

            <v-btn
              v-else
              color="error"
              variant="outlined"
              @click="handleLogout"
              prepend-icon="mdi-logout"
            >
              Logout
            </v-btn>

            <div v-if="!isHotelRegistered" class="info-text">
              <v-icon size="small" class="mr-1">mdi-information</v-icon>
              Your Quendoo API key is encrypted and stored securely in Google Cloud Secret Manager.
              It is never exposed in your browser or sent to the frontend.
            </div>
          </div>
        </div>

        <!-- Claude API Configuration -->
        <div class="settings-card">
          <div class="card-header">
            <v-icon class="header-icon">mdi-robot</v-icon>
            <span class="header-title">Claude API Configuration</span>
          </div>
          <div class="card-content">
            <v-alert
              v-if="!settingsStore.apiKeyConfigured"
              type="warning"
              variant="tonal"
              class="mb-4"
            >
              <div class="text-subtitle-2 mb-2">API Key Required</div>
              <div class="text-body-2">
                To enable intelligent responses and automatic tool calling, you need to configure your Anthropic API key.
              </div>
            </v-alert>

            <v-alert
              v-else
              type="success"
              variant="tonal"
              class="mb-4"
            >
              <div class="text-subtitle-2 mb-2">API Key Configured</div>
              <div class="text-body-2">
                Claude AI is enabled. Your chatbot can now use intelligent tool calling!
              </div>
            </v-alert>

            <v-text-field
              v-model="apiKey"
              label="Anthropic API Key"
              type="password"
              hint="Get your API key from https://console.anthropic.com/"
              persistent-hint
              class="mb-4 api-key-field"
              density="comfortable"
              :readonly="settingsStore.apiKeyConfigured"
              :placeholder="settingsStore.apiKeyConfigured ? '••••••••••••••••••••••••••••••••' : 'sk-ant-api03-...'"
              autocomplete="off"
            >
              <template v-slot:prepend>
                <v-icon>mdi-key</v-icon>
              </template>
            </v-text-field>

            <v-alert
              v-if="apiKeyError"
              type="error"
              variant="tonal"
              class="mb-4"
            >
              {{ apiKeyError }}
            </v-alert>

            <div class="d-flex gap-2">
              <v-btn
                v-if="!settingsStore.apiKeyConfigured"
                color="primary"
                @click="saveApiKey"
                :loading="saving"
                :disabled="!apiKey || !isValidApiKey"
              >
                <v-icon left>mdi-content-save</v-icon>
                Save API Key
              </v-btn>

              <v-btn
                v-if="settingsStore.apiKeyConfigured"
                color="error"
                variant="outlined"
                @click="clearApiKey"
              >
                <v-icon left>mdi-delete</v-icon>
                Clear API Key
              </v-btn>

              <v-btn
                color="secondary"
                variant="outlined"
                @click="testConnection"
                :loading="testing"
                :disabled="!settingsStore.apiKeyConfigured"
              >
                <v-icon left>mdi-connection</v-icon>
                Test Connection
              </v-btn>
            </div>

            <div class="info-text">
              <v-icon size="small" class="mr-1">mdi-information</v-icon>
              Your API key is stored locally in your browser and never sent to our servers.
              It's only used to communicate directly with Anthropic's API.
            </div>
          </div>
        </div>

        <!-- MCP Client Configuration -->
        <div class="settings-card">
          <div class="card-header">
            <v-icon class="header-icon">mdi-server</v-icon>
            <span class="header-title">MCP Client Configuration</span>
          </div>
          <div class="card-content">
            <v-text-field
              v-model="mcpClientUrl"
              label="MCP Client URL"
              hint="URL of the Node.js MCP Client server"
              persistent-hint
              class="mb-4"
              density="comfortable"
            >
              <template v-slot:prepend>
                <v-icon>mdi-lan</v-icon>
              </template>
            </v-text-field>

            <v-btn
              color="primary"
              @click="saveMcpUrl"
              :loading="saving"
            >
              <v-icon left>mdi-content-save</v-icon>
              Save URL
            </v-btn>
          </div>
        </div>

        <!-- MCP Server Configuration -->
        <div class="settings-card">
          <div class="card-header">
            <v-icon class="header-icon">mdi-cloud-outline</v-icon>
            <span class="header-title">MCP Server Configuration</span>
          </div>
          <div class="card-content">
            <v-text-field
              v-model="mcpServerUrl"
              label="MCP Server URL"
              hint="URL of the remote MCP server (e.g., https://quendoo-mcp-server.com/sse)"
              persistent-hint
              class="mb-4"
              density="comfortable"
              placeholder="https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse"
            >
              <template v-slot:prepend>
                <v-icon>mdi-cloud-outline</v-icon>
              </template>
            </v-text-field>

            <v-btn
              color="primary"
              @click="saveMcpServerUrl"
              :loading="saving"
            >
              <v-icon left>mdi-content-save</v-icon>
              Save MCP Server URL
            </v-btn>

            <div class="info-text">
              <v-icon size="small" class="mr-1">mdi-information</v-icon>
              This is the URL of your remote MCP server that provides tools for Claude AI.
            </div>
          </div>
        </div>

        <!-- System Prompt Configuration -->
        <div class="settings-card">
          <div class="card-header">
            <v-icon class="header-icon">mdi-message-text</v-icon>
            <span class="header-title">System Prompt</span>
          </div>
          <div class="card-content">
            <v-textarea
              v-model="systemPromptText"
              label="System Prompt"
              hint="Customize the AI assistant's behavior and restrictions"
              persistent-hint
              rows="6"
              class="mb-4"
              density="comfortable"
            >
              <template v-slot:prepend>
                <v-icon>mdi-robot</v-icon>
              </template>
            </v-textarea>

            <v-btn
              color="primary"
              @click="saveSystemPrompt"
              :loading="saving"
            >
              <v-icon left>mdi-content-save</v-icon>
              Save System Prompt
            </v-btn>

            <div class="info-text">
              <v-icon size="small" class="mr-1">mdi-information</v-icon>
              The system prompt controls what Claude can and cannot help with. Use it to restrict responses to specific business domains.
            </div>
          </div>
        </div>

        <!-- Appearance Settings -->
        <div class="settings-card">
          <div class="card-header">
            <v-icon class="header-icon">mdi-palette</v-icon>
            <span class="header-title">Appearance</span>
          </div>
          <div class="card-content">
            <v-radio-group
              v-model="theme"
              inline
              @update:model-value="updateTheme"
            >
              <v-radio label="Light Mode" value="light"></v-radio>
              <v-radio label="Dark Mode" value="dark"></v-radio>
            </v-radio-group>

            <v-switch
              v-model="autoScroll"
              label="Auto-scroll to new messages"
              color="primary"
              @update:model-value="saveGeneralSettings"
            ></v-switch>

            <v-switch
              v-model="notifications"
              label="Enable notifications"
              color="primary"
              @update:model-value="saveGeneralSettings"
            ></v-switch>
          </div>
        </div>

        <!-- Password Management -->
        <div class="settings-card">
          <div class="card-header">
            <v-icon class="header-icon">mdi-lock</v-icon>
            <span class="header-title">Password Management</span>
          </div>
          <div class="card-content">
            <v-alert
              v-if="passwordChangeSuccess"
              type="success"
              variant="tonal"
              class="mb-4"
            >
              Password changed successfully!
            </v-alert>

            <v-alert
              v-if="passwordChangeError"
              type="error"
              variant="tonal"
              class="mb-4"
            >
              {{ passwordChangeError }}
            </v-alert>

            <v-text-field
              v-model="currentPassword"
              label="Current Password"
              type="password"
              density="comfortable"
              class="mb-3"
              autocomplete="current-password"
            >
              <template v-slot:prepend>
                <v-icon>mdi-lock-outline</v-icon>
              </template>
            </v-text-field>

            <v-text-field
              v-model="newPassword"
              label="New Password"
              type="password"
              density="comfortable"
              class="mb-3"
              hint="Minimum 8 characters"
              persistent-hint
              autocomplete="new-password"
            >
              <template v-slot:prepend>
                <v-icon>mdi-lock</v-icon>
              </template>
            </v-text-field>

            <v-text-field
              v-model="confirmPassword"
              label="Confirm New Password"
              type="password"
              density="comfortable"
              class="mb-4"
              autocomplete="new-password"
            >
              <template v-slot:prepend>
                <v-icon>mdi-lock-check</v-icon>
              </template>
            </v-text-field>

            <v-btn
              color="primary"
              @click="changePassword"
              :loading="changingPassword"
              :disabled="!isPasswordFormValid"
            >
              <v-icon left>mdi-key-change</v-icon>
              Change Password
            </v-btn>

            <div class="info-text">
              <v-icon size="small" class="mr-1">mdi-information</v-icon>
              Your password is securely stored in Google Cloud Secret Manager.
            </div>
          </div>
        </div>

        <!-- Danger Zone -->
        <div class="settings-card danger-card">
          <div class="card-header">
            <v-icon class="header-icon" color="error">mdi-alert</v-icon>
            <span class="header-title text-error">Danger Zone</span>
          </div>
          <div class="card-content">
            <p class="text-body-2 mb-4">
              Reset all settings to their default values. This will clear your API key and all preferences.
            </p>

            <v-btn
              color="error"
              variant="outlined"
              @click="showResetDialog = true"
            >
              <v-icon left>mdi-restore</v-icon>
              Reset All Settings
            </v-btn>
          </div>
        </div>
      </div>

      <!-- Info Sidebar -->
      <div class="settings-sidebar">
        <div class="sidebar-card">
          <h3 class="sidebar-title">Quick Links</h3>
          <v-list density="compact" class="sidebar-list">
            <v-list-item
              href="https://console.anthropic.com/"
              target="_blank"
              prepend-icon="mdi-open-in-new"
            >
              Get Anthropic API Key
            </v-list-item>
            <v-list-item
              href="https://docs.anthropic.com/"
              target="_blank"
              prepend-icon="mdi-book-open"
            >
              Claude API Documentation
            </v-list-item>
            <v-list-item
              href="https://modelcontextprotocol.io/"
              target="_blank"
              prepend-icon="mdi-book-open"
            >
              MCP Documentation
            </v-list-item>
          </v-list>
        </div>

        <div class="sidebar-card">
          <h3 class="sidebar-title">Status</h3>
          <v-list density="compact" class="sidebar-list">
            <v-list-item>
              <template v-slot:prepend>
                <v-icon :color="settingsStore.apiKeyConfigured ? 'success' : 'grey'">
                  mdi-{{ settingsStore.apiKeyConfigured ? 'check-circle' : 'circle-outline' }}
                </v-icon>
              </template>
              <v-list-item-title>Claude API</v-list-item-title>
              <v-list-item-subtitle>
                {{ settingsStore.apiKeyConfigured ? 'Configured' : 'Not configured' }}
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item v-if="settingsStore.apiKeyConfigured">
              <template v-slot:prepend>
                <v-icon>mdi-key</v-icon>
              </template>
              <v-list-item-title>API Key</v-list-item-title>
              <v-list-item-subtitle class="font-mono">
                {{ settingsStore.getMaskedApiKey() }}
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <template v-slot:prepend>
                <v-icon>mdi-server</v-icon>
              </template>
              <v-list-item-title>MCP Client</v-list-item-title>
              <v-list-item-subtitle>
                {{ mcpClientUrl }}
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <template v-slot:prepend>
                <v-icon>mdi-cloud-outline</v-icon>
              </template>
              <v-list-item-title>MCP Server</v-list-item-title>
              <v-list-item-subtitle class="text-truncate">
                {{ mcpServerUrl || 'Not configured' }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </div>
      </div>
    </div>
    </div>

    <!-- Reset Confirmation Dialog -->
    <v-dialog v-model="showResetDialog" max-width="500">
      <v-card>
        <v-card-title class="text-error">
          <v-icon class="mr-2" color="error">mdi-alert</v-icon>
          Reset All Settings?
        </v-card-title>
        <v-card-text>
          <p>This will:</p>
          <ul>
            <li>Clear your Anthropic API key</li>
            <li>Reset MCP client URL</li>
            <li>Reset MCP server URL</li>
            <li>Reset system prompt</li>
            <li>Reset appearance preferences</li>
            <li>Clear all stored settings</li>
          </ul>
          <p class="mt-4">This action cannot be undone.</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showResetDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="resetAllSettings">Reset Everything</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Success Snackbar -->
    <v-snackbar v-model="showSuccess" color="success" :timeout="3000">
      {{ successMessage }}
    </v-snackbar>

    <!-- Error Snackbar -->
    <v-snackbar v-model="showError" color="error" :timeout="5000">
      {{ errorMessage }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settingsStore'

const router = useRouter()
const settingsStore = useSettingsStore()

// Local state
const apiKey = ref(settingsStore.anthropicApiKey)
const mcpClientUrl = ref(settingsStore.mcpClientUrl)
const mcpServerUrl = ref(settingsStore.mcpServerUrl)
const systemPromptText = ref(settingsStore.systemPrompt)
const theme = ref(settingsStore.theme)
const autoScroll = ref(settingsStore.autoScroll)
const notifications = ref(settingsStore.notifications)

// Hotel registration state
const hotelToken = ref(localStorage.getItem('hotelToken'))
const hotelId = ref(localStorage.getItem('hotelId'))
const hotelName = ref(localStorage.getItem('hotelName'))

const showApiKey = ref(false)
const saving = ref(false)
const testing = ref(false)
const apiKeyError = ref('')
const showResetDialog = ref(false)
const showSuccess = ref(false)
const showError = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// Password change state
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changingPassword = ref(false)
const passwordChangeSuccess = ref(false)
const passwordChangeError = ref('')

// Computed
const isHotelRegistered = computed(() => {
  return !!hotelToken.value && !!hotelId.value
})

const isValidApiKey = computed(() => {
  return settingsStore.validateApiKey(apiKey.value)
})

const isPasswordFormValid = computed(() => {
  return currentPassword.value.length > 0 &&
         newPassword.value.length >= 8 &&
         confirmPassword.value.length >= 8 &&
         newPassword.value === confirmPassword.value
})

// Watch for API key changes to clear error
watch(apiKey, () => {
  apiKeyError.value = ''
})

// Methods
const saveApiKey = async () => {
  if (!isValidApiKey.value) {
    apiKeyError.value = 'Invalid API key format. Key should start with "sk-ant-"'
    return
  }

  saving.value = true
  try {
    settingsStore.updateApiKey(apiKey.value)
    successMessage.value = 'API key saved successfully!'
    showSuccess.value = true
  } catch (error) {
    errorMessage.value = 'Failed to save API key: ' + error.message
    showError.value = true
  } finally {
    saving.value = false
  }
}

const clearApiKey = () => {
  settingsStore.clearApiKey()
  apiKey.value = ''
  successMessage.value = 'API key cleared'
  showSuccess.value = true
}

const saveMcpUrl = () => {
  saving.value = true
  try {
    settingsStore.updateMcpClientUrl(mcpClientUrl.value)
    successMessage.value = 'MCP Client URL saved successfully!'
    showSuccess.value = true
  } catch (error) {
    errorMessage.value = 'Failed to save URL: ' + error.message
    showError.value = true
  } finally {
    saving.value = false
  }
}

const saveMcpServerUrl = () => {
  saving.value = true
  try {
    settingsStore.updateMcpServerUrl(mcpServerUrl.value)
    successMessage.value = 'MCP Server URL saved successfully!'
    showSuccess.value = true
  } catch (error) {
    errorMessage.value = 'Failed to save MCP Server URL: ' + error.message
    showError.value = true
  } finally {
    saving.value = false
  }
}

const saveSystemPrompt = () => {
  saving.value = true
  try {
    settingsStore.updateSystemPrompt(systemPromptText.value)
    successMessage.value = 'System Prompt saved successfully!'
    showSuccess.value = true
  } catch (error) {
    errorMessage.value = 'Failed to save System Prompt: ' + error.message
    showError.value = true
  } finally {
    saving.value = false
  }
}

const updateTheme = (newTheme) => {
  settingsStore.updateTheme(newTheme)
  successMessage.value = `Theme changed to ${newTheme} mode`
  showSuccess.value = true
}

const saveGeneralSettings = () => {
  settingsStore.autoScroll = autoScroll.value
  settingsStore.notifications = notifications.value
  settingsStore.saveSettings()
}

const testConnection = async () => {
  testing.value = true
  try {
    // Simple test - try to reach the MCP client
    const response = await fetch(`${mcpClientUrl.value}/health`)
    if (response.ok) {
      successMessage.value = 'Connection successful! MCP Client is running.'
      showSuccess.value = true
    } else {
      errorMessage.value = 'MCP Client returned an error. Check if it\'s running.'
      showError.value = true
    }
  } catch (error) {
    errorMessage.value = 'Cannot connect to MCP Client. Make sure it\'s running on ' + mcpClientUrl.value
    showError.value = true
  } finally {
    testing.value = false
  }
}

const resetAllSettings = () => {
  settingsStore.resetToDefaults()
  apiKey.value = ''
  mcpClientUrl.value = 'https://quendoo-backend-222402522800.us-central1.run.app'
  mcpServerUrl.value = 'https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse'
  theme.value = 'light'
  autoScroll.value = true
  notifications.value = true
  showResetDialog.value = false
  successMessage.value = 'All settings have been reset'
  showSuccess.value = true
}

const changePassword = async () => {
  // Clear previous messages
  passwordChangeSuccess.value = false
  passwordChangeError.value = ''

  // Validate passwords match
  if (newPassword.value !== confirmPassword.value) {
    passwordChangeError.value = 'New passwords do not match'
    return
  }

  // Validate password length
  if (newPassword.value.length < 8) {
    passwordChangeError.value = 'New password must be at least 8 characters long'
    return
  }

  changingPassword.value = true

  try {
    // Get auth token from settingsStore (assuming it's stored there after login)
    const token = settingsStore.authToken

    if (!token) {
      passwordChangeError.value = 'Authentication required. Please log in again.'
      return
    }

    // Import adminApi
    const { adminApi } = await import('../services/api')

    // Call the API
    const result = await adminApi.changePassword(token, currentPassword.value, newPassword.value)

    if (result.success) {
      passwordChangeSuccess.value = true
      // Clear form
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        passwordChangeSuccess.value = false
      }, 5000)
    } else {
      passwordChangeError.value = result.error || 'Failed to change password'
    }
  } catch (error) {
    console.error('Password change error:', error)
    passwordChangeError.value = error.response?.data?.error || 'Failed to change password. Please try again.'
  } finally {
    changingPassword.value = false
  }
}

const goBackToChat = () => {
  router.push('/')
}

const goToRegistration = () => {
  router.push('/register')
}

const handleLogout = () => {
  // Clear hotel authentication data
  localStorage.removeItem('hotelToken')
  localStorage.removeItem('hotelId')
  localStorage.removeItem('hotelName')
  localStorage.removeItem('hotelEmail')

  console.log('[Settings] Hotel logged out, redirecting to login')

  // Redirect to login page
  router.push('/login')
}
</script>

<style scoped>
.settings-layout {
  min-height: 100vh;
  background: rgb(var(--v-theme-surface));
  padding: 32px 24px;
}

.settings-container {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 32px;
}

.settings-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.settings-title {
  font-size: 2rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  margin: 0;
}

.back-button {
  text-transform: none;
  font-weight: 500;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.card-header {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  opacity: 0.7;
}

.header-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.card-content {
  padding: 24px;
}

.info-text {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(var(--v-theme-on-surface), 0.03);
  border-radius: 8px;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  display: flex;
  align-items: center;
  gap: 8px;
}

.danger-card {
  border-color: rgba(var(--v-theme-error), 0.3);
}

.danger-card .card-header {
  border-bottom-color: rgba(var(--v-theme-error), 0.15);
}

.settings-sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.sidebar-card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.sidebar-title {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  margin: 0;
}

.sidebar-list {
  background: transparent;
  padding: 8px;
}

.font-mono {
  font-family: 'Courier New', monospace;
  font-size: 0.85em;
}

.hotel-info {
  background: rgba(var(--v-theme-on-surface), 0.03);
  border-radius: 8px;
  padding: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.05);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 0.875rem;
}

.info-value {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-on-surface));
}

@media (max-width: 1024px) {
  .settings-container {
    grid-template-columns: 1fr;
  }

  .settings-sidebar {
    order: -1;
  }
}

@media (max-width: 768px) {
  .settings-layout {
    padding: 16px;
  }

  .card-header,
  .card-content,
  .sidebar-title {
    padding: 16px;
  }
}
</style>
