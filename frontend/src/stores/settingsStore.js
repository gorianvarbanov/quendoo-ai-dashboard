import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  // State
  const anthropicApiKey = ref('')
  const mcpClientUrl = ref('https://quendoo-backend-222402522800.us-central1.run.app')
  const mcpServerUrl = ref('https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse')
  const theme = ref('light')
  const autoScroll = ref(true)
  const notifications = ref(true)
  const apiKeyConfigured = ref(false)

  // Load settings from localStorage on init
  const loadSettings = () => {
    try {
      const stored = localStorage.getItem('quendoo-settings')
      if (stored) {
        const settings = JSON.parse(stored)
        anthropicApiKey.value = settings.anthropicApiKey || ''
        mcpClientUrl.value = settings.mcpClientUrl || 'https://quendoo-backend-222402522800.us-central1.run.app'
        mcpServerUrl.value = settings.mcpServerUrl || 'https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse'
        theme.value = settings.theme || 'light'
        autoScroll.value = settings.autoScroll !== false
        notifications.value = settings.notifications !== false
        apiKeyConfigured.value = !!settings.anthropicApiKey
      }
    } catch (error) {
      console.error('[Settings] Failed to load settings:', error)
    }
  }

  // Save settings to localStorage
  const saveSettings = () => {
    try {
      const settings = {
        anthropicApiKey: anthropicApiKey.value,
        mcpClientUrl: mcpClientUrl.value,
        mcpServerUrl: mcpServerUrl.value,
        theme: theme.value,
        autoScroll: autoScroll.value,
        notifications: notifications.value
      }
      localStorage.setItem('quendoo-settings', JSON.stringify(settings))
      apiKeyConfigured.value = !!anthropicApiKey.value

      console.log('[Settings] Settings saved')
    } catch (error) {
      console.error('[Settings] Failed to save settings:', error)
      throw error
    }
  }

  // Update API key
  const updateApiKey = (key) => {
    anthropicApiKey.value = key
    saveSettings()
  }

  // Update MCP client URL
  const updateMcpClientUrl = (url) => {
    mcpClientUrl.value = url
    saveSettings()
  }

  // Update MCP server URL
  const updateMcpServerUrl = (url) => {
    mcpServerUrl.value = url
    saveSettings()
  }

  // Update theme
  const updateTheme = (newTheme) => {
    theme.value = newTheme
    saveSettings()
  }

  // Reset to defaults
  const resetToDefaults = () => {
    anthropicApiKey.value = ''
    mcpClientUrl.value = 'https://quendoo-backend-222402522800.us-central1.run.app'
    mcpServerUrl.value = 'https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse'
    theme.value = 'light'
    autoScroll.value = true
    notifications.value = true
    apiKeyConfigured.value = false
    saveSettings()
  }

  // Clear API key (for security)
  const clearApiKey = () => {
    anthropicApiKey.value = ''
    apiKeyConfigured.value = false
    saveSettings()
  }

  // Validate API key format
  const validateApiKey = (key) => {
    if (!key) return false
    // Anthropic API keys start with sk-ant-
    return key.startsWith('sk-ant-') && key.length > 20
  }

  // Get masked API key for display
  const getMaskedApiKey = () => {
    if (!anthropicApiKey.value) return ''
    const key = anthropicApiKey.value
    if (key.length < 20) return '***'
    return key.substring(0, 12) + '...' + key.substring(key.length - 4)
  }

  // Initialize on creation
  loadSettings()

  return {
    // State
    anthropicApiKey,
    mcpClientUrl,
    mcpServerUrl,
    theme,
    autoScroll,
    notifications,
    apiKeyConfigured,

    // Actions
    loadSettings,
    saveSettings,
    updateApiKey,
    updateMcpClientUrl,
    updateMcpServerUrl,
    updateTheme,
    resetToDefaults,
    clearApiKey,
    validateApiKey,
    getMaskedApiKey
  }
})
