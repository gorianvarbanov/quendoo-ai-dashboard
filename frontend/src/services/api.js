/**
 * API Service - HTTP client for backend API
 */
import axios from 'axios'

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor for logging/debugging and adding API key and MCP Server URL
apiClient.interceptors.request.use(
  (config) => {
    // Add Anthropic API key and MCP Server URL from localStorage if available
    try {
      const settings = localStorage.getItem('quendoo-settings')
      if (settings) {
        const { anthropicApiKey, mcpServerUrl } = JSON.parse(settings)
        if (anthropicApiKey) {
          config.headers['X-Anthropic-API-Key'] = anthropicApiKey
        }
        if (mcpServerUrl) {
          config.headers['X-MCP-Server-URL'] = mcpServerUrl
        }
      }
    } catch (error) {
      console.warn('[API] Failed to load settings:', error)
    }

    if (import.meta.env.DEV) {
      console.log('[API Request]', config.method.toUpperCase(), config.url, config.data)
    }
    return config
  },
  (error) => {
    console.error('[API Request Error]', error)
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log('[API Response]', response.status, response.data)
    }
    return response
  },
  (error) => {
    console.error('[API Error]', error.response?.data || error.message)

    // Handle specific error cases
    if (error.response?.status === 401) {
      // TODO: Handle authentication errors when auth is implemented
      console.warn('Unauthorized - implement auth handling')
    }

    return Promise.reject(error)
  }
)

/**
 * Chat API methods
 */
export const chatApi = {
  /**
   * Send a message to the MCP server
   * @param {string} content - Message content
   * @param {string} conversationId - Optional conversation ID
   * @param {string} serverId - Optional server ID
   * @param {string} model - Optional Claude model to use
   * @returns {Promise<Object>} Response with conversation ID and AI response
   */
  async sendMessage(content, conversationId = null, serverId = null, model = null) {
    // NOTE: System prompt is now managed server-side for security
    // Client no longer sends system prompt in request body

    const response = await apiClient.post('/chat/quendoo', {
      message: content,
      conversationId,
      serverId,
      model
      // systemPrompt removed - server controls this for security
    })

    // Transform response to match expected format
    return {
      status: 'success',
      response: response.data.response
    }
  },

  /**
   * Get all conversations
   * @returns {Promise<Array>} List of conversations
   */
  async getConversations() {
    const response = await apiClient.get('/chat/conversations')
    return response.data
  },

  /**
   * Get specific conversation with messages
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Conversation data with messages
   */
  async getConversation(conversationId) {
    const response = await apiClient.get(`/chat/conversation/${conversationId}`)
    return response.data
  },

  /**
   * Delete a conversation
   * @param {string} conversationId - Conversation ID
   */
  async deleteConversation(conversationId) {
    await apiClient.delete(`/chat/conversation/${conversationId}`)
  }
}

/**
 * Server API methods
 */
export const serverApi = {
  /**
   * Get all configured MCP servers
   * @returns {Promise<Array>} List of servers
   */
  async getServers() {
    const response = await apiClient.get('/servers')
    return response.data
  },

  /**
   * Add a new MCP server
   * @param {Object} serverConfig - Server configuration
   * @param {string} serverConfig.name - Server name
   * @param {string} serverConfig.url - Server URL
   * @param {string} serverConfig.description - Server description
   * @returns {Promise<Object>} Created server data
   */
  async addServer(serverConfig) {
    const response = await apiClient.post('/servers', serverConfig)
    return response.data
  },

  /**
   * Remove an MCP server
   * @param {string} serverId - Server ID
   */
  async removeServer(serverId) {
    await apiClient.delete(`/servers/${serverId}`)
  },

  /**
   * Test connection to an MCP server
   * @param {string} serverId - Server ID
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection(serverId) {
    const response = await apiClient.post(`/servers/${serverId}/test`)
    return response.data
  }
}

/**
 * Health check
 */
export const healthApi = {
  /**
   * Check backend health
   * @returns {Promise<Object>} Health status
   */
  async check() {
    const response = await apiClient.get('/health')
    return response.data
  }
}

export default apiClient
