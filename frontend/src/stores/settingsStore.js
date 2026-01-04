import { defineStore } from 'pinia'
import { ref } from 'vue'

const SETTINGS_VERSION = 6 // Increment to force settings reset

export const useSettingsStore = defineStore('settings', () => {
  // State
  const anthropicApiKey = ref('')
  const quendooApiKey = ref('') // User's Quendoo API key
  const mcpClientUrl = ref('https://quendoo-backend-222402522800.us-central1.run.app')
  const mcpServerUrl = ref('https://mcp-quendoo-chatbot-222402522800.us-central1.run.app/sse')
  const systemPrompt = ref('You are a specialized AI assistant EXCLUSIVELY for Quendoo hotel reservation system.\n\nYOU CAN ONLY HELP WITH:\n- Hotel room reservations and bookings\n- Checking room availability\n- Hotel property settings and configuration\n- Pricing and packages\n- Check-in/Check-out information\n- Guest management\n- Hotel business operations\n\nYOU MUST REFUSE to help with:\n- Medical advice or health questions (flu treatment, medications, etc.)\n- Cooking recipes or food preparation\n- General life advice\n- Technical support outside hotel systems\n- ANY topics unrelated to hotel business\n\nWhen asked about topics outside your scope, you MUST respond: "I cannot answer questions that are not connected to Quendoo functionalities."')
  const theme = ref('light')
  const autoScroll = ref(true)
  const notifications = ref(true)
  const apiKeyConfigured = ref(false)
  const authToken = ref('')

  // Load settings from localStorage on init
  const loadSettings = () => {
    try {
      const stored = localStorage.getItem('quendoo-settings')
      if (stored) {
        const settings = JSON.parse(stored)

        // Check version and reset if old
        if (settings.version !== SETTINGS_VERSION) {
          console.log('[Settings] Old settings version detected, clearing ALL localStorage...')
          localStorage.clear() // Clear everything including chat conversations and old model
          window.location.reload() // Force page reload
          return
        }

        anthropicApiKey.value = settings.anthropicApiKey || ''
        quendooApiKey.value = settings.quendooApiKey || ''
        mcpClientUrl.value = settings.mcpClientUrl || 'https://quendoo-backend-222402522800.us-central1.run.app'
        mcpServerUrl.value = settings.mcpServerUrl || 'https://mcp-quendoo-chatbot-222402522800.us-central1.run.app/sse'
        systemPrompt.value = settings.systemPrompt || 'You are a specialized AI assistant EXCLUSIVELY for Quendoo hotel reservation system.\n\nYOU CAN ONLY HELP WITH:\n- Hotel room reservations and bookings\n- Checking room availability\n- Hotel property settings and configuration\n- Pricing and packages\n- Check-in/Check-out information\n- Guest management\n- Hotel business operations\n\nYOU MUST REFUSE to help with:\n- Medical advice or health questions (flu treatment, medications, etc.)\n- Cooking recipes or food preparation\n- General life advice\n- Technical support outside hotel systems\n- ANY topics unrelated to hotel business\n\nWhen asked about topics outside your scope, you MUST respond: "I cannot answer questions that are not connected to Quendoo functionalities."'
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
        version: SETTINGS_VERSION,
        anthropicApiKey: anthropicApiKey.value,
        quendooApiKey: quendooApiKey.value,
        mcpClientUrl: mcpClientUrl.value,
        mcpServerUrl: mcpServerUrl.value,
        systemPrompt: systemPrompt.value,
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

  // Update Quendoo API key
  const updateQuendooApiKey = (key) => {
    quendooApiKey.value = key
    saveSettings()
  }

  // Set Quendoo API key (alias for PostMessage integration)
  const setQuendooApiKey = (key) => {
    console.log('[Settings] Setting Quendoo API key via PostMessage')
    quendooApiKey.value = key
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

  // Update system prompt
  const updateSystemPrompt = (prompt) => {
    systemPrompt.value = prompt
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
    quendooApiKey.value = ''
    mcpClientUrl.value = 'https://quendoo-backend-222402522800.us-central1.run.app'
    mcpServerUrl.value = 'https://mcp-quendoo-chatbot-222402522800.us-central1.run.app/sse'
    systemPrompt.value = 'You are a specialized AI assistant EXCLUSIVELY for Quendoo hotel reservation system.\n\nYOU CAN ONLY HELP WITH:\n- Hotel room reservations and bookings\n- Checking room availability\n- Hotel property settings and configuration\n- Pricing and packages\n- Check-in/Check-out information\n- Guest management\n- Hotel business operations\n\nYOU MUST REFUSE to help with:\n- Medical advice or health questions (flu treatment, medications, etc.)\n- Cooking recipes or food preparation\n- General life advice\n- Technical support outside hotel systems\n- ANY topics unrelated to hotel business\n\nWhen asked about topics outside your scope, you MUST respond: "I cannot answer questions that are not connected to Quendoo functionalities."'
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

  // Set auth token (for admin authentication)
  const setAuthToken = (token) => {
    authToken.value = token
    // Store in sessionStorage (not localStorage for security)
    if (token) {
      sessionStorage.setItem('quendoo-auth-token', token)
    } else {
      sessionStorage.removeItem('quendoo-auth-token')
    }
  }

  // Load auth token from sessionStorage
  const loadAuthToken = () => {
    const token = sessionStorage.getItem('quendoo-auth-token')
    if (token) {
      authToken.value = token
    }
  }

  // Initialize on creation
  loadSettings()
  loadAuthToken()

  return {
    // State
    anthropicApiKey,
    quendooApiKey,
    mcpClientUrl,
    mcpServerUrl,
    systemPrompt,
    theme,
    autoScroll,
    notifications,
    apiKeyConfigured,
    authToken,

    // Actions
    loadSettings,
    saveSettings,
    updateApiKey,
    updateQuendooApiKey,
    setQuendooApiKey,
    updateMcpClientUrl,
    updateMcpServerUrl,
    updateSystemPrompt,
    updateTheme,
    resetToDefaults,
    clearApiKey,
    validateApiKey,
    getMaskedApiKey,
    setAuthToken,
    loadAuthToken
  }
})
