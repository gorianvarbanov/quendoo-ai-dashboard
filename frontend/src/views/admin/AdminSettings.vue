<template>
  <admin-layout>
    <div class="admin-content">
      <div class="page-header">
        <h1 class="page-title">
          <v-icon size="large" class="mr-2">mdi-cog</v-icon>
          Admin Settings
        </h1>
      </div>

      <div class="settings-container">
        <div class="settings-content">
        <!-- Claude API Configuration -->
        <div class="settings-card">
          <div class="card-header">
            <v-icon class="header-icon">mdi-robot</v-icon>
            <span class="header-title">Claude API Configuration</span>
          </div>
          <div class="card-content">
            <v-alert
              v-if="!apiKeyConfigured"
              type="warning"
              variant="tonal"
              class="mb-4"
            >
              <div class="text-subtitle-2 mb-2">API Key Required (Server-Side)</div>
              <div class="text-body-2">
                The Anthropic API key is now managed on the backend server for security. Configure it below.
              </div>
            </v-alert>

            <v-alert
              v-else
              type="success"
              variant="tonal"
              class="mb-4"
            >
              <div class="text-subtitle-2 mb-2">API Key Configured on Server</div>
              <div class="text-body-2">
                Claude AI is enabled and configured server-side. Current key: {{ maskedKey }}
              </div>
            </v-alert>

            <v-text-field
              v-model="apiKey"
              label="Anthropic API Key"
              type="password"
              hint="API key is stored securely on the backend server"
              persistent-hint
              class="mb-4 api-key-field"
              density="comfortable"
              :placeholder="apiKeyConfigured ? 'Enter new key to update' : 'sk-ant-api03-...'"
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
                color="primary"
                @click="saveApiKey"
                :loading="saving"
                :disabled="!apiKey || !isValidApiKey"
              >
                <v-icon left>mdi-content-save</v-icon>
                {{ apiKeyConfigured ? 'Update API Key' : 'Save API Key' }}
              </v-btn>

              <v-btn
                v-if="apiKeyConfigured"
                color="error"
                variant="outlined"
                @click="clearApiKey"
                :loading="saving"
              >
                <v-icon left>mdi-delete</v-icon>
                Remove API Key
              </v-btn>

              <v-btn
                color="secondary"
                variant="outlined"
                @click="testConnection"
                :loading="testing"
                :disabled="!apiKeyConfigured"
              >
                <v-icon left>mdi-connection</v-icon>
                Test Connection
              </v-btn>
            </div>

            <div class="info-text">
              <v-icon size="small" class="mr-1">mdi-information</v-icon>
              API key is stored securely on the backend server. It never reaches the browser for maximum security.
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

        <!-- Data Management -->
        <div class="settings-card">
          <div class="card-header">
            <v-icon class="header-icon">mdi-database</v-icon>
            <span class="header-title">Data Management</span>
          </div>
          <div class="card-content">
            <p class="text-body-2 mb-4">
              Clear conversation history and cached data. This will NOT affect your API key or settings.
            </p>

            <v-btn
              color="warning"
              variant="outlined"
              @click="showClearConversationsDialog = true"
              class="mb-3"
            >
              <v-icon left>mdi-message-minus</v-icon>
              Clear All Conversations
            </v-btn>

            <div class="info-text">
              <v-icon size="small" class="mr-1">mdi-information</v-icon>
              This will remove all conversation history but keep your API key and settings intact.
            </div>
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
                <v-icon :color="apiKeyConfigured ? 'success' : 'grey'">
                  mdi-{{ apiKeyConfigured ? 'check-circle' : 'circle-outline' }}
                </v-icon>
              </template>
              <v-list-item-title>Claude API (Server)</v-list-item-title>
              <v-list-item-subtitle>
                {{ apiKeyConfigured ? 'Configured' : 'Not configured' }}
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item v-if="apiKeyConfigured">
              <template v-slot:prepend>
                <v-icon>mdi-key</v-icon>
              </template>
              <v-list-item-title>API Key (Backend)</v-list-item-title>
              <v-list-item-subtitle class="font-mono">
                {{ maskedKey }}
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
    </admin-layout>

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
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAuthStore } from '../../stores/authStore'
import { adminApi } from '../../services/api'
import AdminLayout from './AdminLayout.vue'

const settingsStore = useSettingsStore()
const authStore = useAuthStore()

// Local state
const apiKey = ref('')
const apiKeyConfigured = ref(false)
const maskedKey = ref(null)
const mcpClientUrl = ref(settingsStore.mcpClientUrl)
const mcpServerUrl = ref(settingsStore.mcpServerUrl)
const systemPromptText = ref(settingsStore.systemPrompt)
const theme = ref(settingsStore.theme)
const autoScroll = ref(settingsStore.autoScroll)
const notifications = ref(settingsStore.notifications)

const showApiKey = ref(false)
const saving = ref(false)
const testing = ref(false)
const loading = ref(false)
const apiKeyError = ref('')
const showResetDialog = ref(false)
const showClearConversationsDialog = ref(false)
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
const isValidApiKey = computed(() => {
  if (!apiKey.value) return false
  return apiKey.value.startsWith('sk-ant-') && apiKey.value.length > 20
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

// Load API key status on mount
onMounted(async () => {
  await loadApiKeyStatus()
})

// Load API key status from backend
const loadApiKeyStatus = async () => {
  loading.value = true
  try {
    const result = await adminApi.getApiKeyStatus(authStore.token)
    apiKeyConfigured.value = result.configured
    maskedKey.value = result.maskedKey
  } catch (error) {
    console.error('Failed to load API key status:', error)
  } finally {
    loading.value = false
  }
}

// Methods
const saveApiKey = async () => {
  if (!isValidApiKey.value) {
    apiKeyError.value = 'Invalid API key format. Key should start with "sk-ant-"'
    return
  }

  saving.value = true
  try {
    const result = await adminApi.updateApiKey(authStore.token, apiKey.value)
    apiKeyConfigured.value = result.configured
    maskedKey.value = result.maskedKey
    apiKey.value = '' // Clear input field
    successMessage.value = 'API key saved successfully on server!'
    showSuccess.value = true
  } catch (error) {
    errorMessage.value = error.response?.data?.error || 'Failed to save API key'
    showError.value = true
  } finally {
    saving.value = false
  }
}

const clearApiKey = async () => {
  saving.value = true
  try {
    await adminApi.removeApiKey(authStore.token)
    apiKeyConfigured.value = false
    maskedKey.value = null
    apiKey.value = ''
    successMessage.value = 'API key removed from server'
    showSuccess.value = true
  } catch (error) {
    errorMessage.value = error.response?.data?.error || 'Failed to remove API key'
    showError.value = true
  } finally {
    saving.value = false
  }
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
    // Call the API
    const result = await adminApi.changePassword(authStore.token, currentPassword.value, newPassword.value)

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
</script>

<style scoped>
.admin-content {
  padding: 24px;
  padding-left: 24px;
  padding-right: 24px;
  width: 100%;
  max-width: none;
  flex: 1;
}

/* Page Header */
.page-header {
  padding: 0 0 24px 0;
  margin-bottom: 0;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  display: flex;
  align-items: center;
}

/* Main content grid */
.settings-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  padding: 0;
  margin: 0;
}

.settings-content {
  display: contents;
}

.settings-card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.card-header {
  padding: 40px 48px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-icon {
  opacity: 0.7;
  font-size: 32px;
}

.header-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.card-content {
  padding: 48px;
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
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.sidebar-title {
  padding: 40px 48px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  font-size: 1.375rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  margin: 0;
}

.sidebar-list {
  background: transparent;
  padding: 24px;
}

.font-mono {
  font-family: 'Courier New', monospace;
  font-size: 0.85em;
}

@media (max-width: 1024px) {
  .settings-container {
    grid-template-columns: 1fr;
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
