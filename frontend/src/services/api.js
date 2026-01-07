/**
 * API Service - HTTP client for backend API
 */
import axios from 'axios'

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  timeout: 120000, // 120 seconds - increased to support complex multi-tool requests
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor for logging/debugging and adding authentication
// NOTE: API key is now managed server-side for security
apiClient.interceptors.request.use(
  (config) => {
    // Add JWT token from localStorage if available
    // Check for hotel token first, then admin token
    try {
      const hotelToken = localStorage.getItem('hotelToken')
      const adminToken = localStorage.getItem('quendoo-admin-token')

      // Hotel token takes precedence for chat endpoints
      if (hotelToken && (config.url.includes('/chat/') || config.url.includes('/conversations'))) {
        config.headers['Authorization'] = `Bearer ${hotelToken}`
      } else if (adminToken) {
        config.headers['Authorization'] = `Bearer ${adminToken}`
      }
    } catch (error) {
      console.warn('[API] Failed to load auth token:', error)
    }

    // Add MCP Server URL from localStorage if available
    try {
      const settings = localStorage.getItem('quendoo-settings')
      if (settings) {
        const { mcpServerUrl } = JSON.parse(settings)
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
    console.error('[API Request]', error)
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
  async sendMessage(content, conversationId = null, serverId = null, model = null, onToolProgress = null) {
    // NOTE: System prompt is now managed server-side for security
    // NOTE: Authentication is handled via JWT token in Authorization header
    // Client no longer sends system prompt or API key in request body

    // Check if SSE streaming is requested (when onToolProgress callback is provided)
    if (onToolProgress) {
      // Use SSE streaming for real-time tool progress
      return {
        status: 'streaming',
        conversationId,
        onToolProgress
      }
    }

    const response = await apiClient.post('/chat/quendoo', {
      message: content,
      conversationId,
      serverId,
      model
      // API key removed - authentication via JWT token in header
      // systemPrompt removed - server controls this for security
    })

    // Transform response to match expected format
    return {
      status: 'success',
      response: response.data.response
    }
  },

  /**
   * Send a message with SSE streaming for real-time tool progress
   * @param {string} content - Message content
   * @param {string} conversationId - Conversation ID
   * @param {string} serverId - Optional server ID
   * @param {string} model - Claude model to use
   * @param {Object} callbacks - { onToolStart, onToolProgress, onComplete, onError }
   */
  async sendMessageStreaming(content, conversationId, serverId, model, callbacks = {}) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
    const url = `${baseUrl}/chat/quendoo`

    // Get hotel token for authentication
    const hotelToken = localStorage.getItem('hotelToken')

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',  // Request SSE streaming
          'Authorization': `Bearer ${hotelToken}`  // Hotel JWT authentication
        },
        body: JSON.stringify({
          message: content,
          conversationId,
          serverId,
          model
          // API key removed - authentication via JWT token in header
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE messages
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'connected') {
                console.log('[SSE] Connected to stream')
              } else if (data.type === 'tool_start') {
                callbacks.onToolStart?.(data.tool.name, data.tool.params)
              } else if (data.type === 'tool_progress') {
                callbacks.onToolProgress?.(data.tool)
              } else if (data.type === 'thinking') {
                // Claude is thinking (optional callback)
              } else if (data.type === 'complete') {
                callbacks.onComplete?.(data.response)
              } else if (data.type === 'error') {
                callbacks.onError?.(new Error(data.error))
              }
            } catch (err) {
              console.error('[SSE] Failed to parse event:', err, line)
            }
          }
        }
      }
    } catch (error) {
      console.error('[SSE] Connection error:', error)
      callbacks.onError?.(error)
    }
  },

  /**
   * Get all conversations
   * @returns {Promise<Object>} Response with conversations array
   */
  async getConversations() {
    const response = await apiClient.get('/conversations')
    return response.data
  },

  /**
   * Get ALL conversations from all hotels (admin only)
   * @returns {Promise<Object>} Response with conversations array
   */
  async getAllConversations() {
    const response = await apiClient.get('/conversations/all')
    return response.data
  },

  /**
   * Get specific conversation with messages
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Conversation data with messages
   */
  async getConversation(conversationId) {
    const response = await apiClient.get(`/conversations/${conversationId}`)
    return response.data
  },

  /**
   * Get messages for a specific conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Messages array
   */
  async getConversationMessages(conversationId) {
    const response = await apiClient.get(`/conversations/${conversationId}/messages`)
    return response.data
  },

  /**
   * Delete a conversation
   * @param {string} conversationId - Conversation ID
   */
  async deleteConversation(conversationId) {
    await apiClient.delete(`/conversations/${conversationId}`)
  },

  /**
   * Search conversations
   * @param {string} query - Search term
   * @param {number} limit - Optional result limit
   * @returns {Promise<Object>} Search results with conversations array
   */
  async searchConversations(query, limit = 20) {
    const response = await apiClient.get(`/conversations/search`, {
      params: { q: query, limit }
    })
    return response.data
  },

  /**
   * Create a new conversation
   * @param {string} conversationId - Optional custom conversation ID
   * @param {string} title - Optional conversation title
   * @returns {Promise<Object>} Created conversation data
   */
  async createConversation(conversationId, title = 'New Conversation') {
    const response = await apiClient.post('/conversations', {
      conversationId,
      title
    })
    return response.data
  },

  /**
   * Update conversation metadata (e.g., title)
   * @param {string} conversationId - Conversation ID
   * @param {object} updates - Fields to update
   * @returns {Promise<Object>} Update response
   */
  async updateConversation(conversationId, updates) {
    const response = await apiClient.patch(`/conversations/${conversationId}`, updates)
    return response.data
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

/**
 * Admin API methods (requires authentication)
 */
export const adminApi = {
  /**
   * Get API key status
   * @param {string} token - Admin JWT token
   * @returns {Promise<Object>} API key status
   */
  async getApiKeyStatus(token) {
    const response = await apiClient.get('/admin/api-key/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    return response.data
  },

  /**
   * Update API key
   * @param {string} token - Admin JWT token
   * @param {string} apiKey - New Anthropic API key
   * @returns {Promise<Object>} Update result
   */
  async updateApiKey(token, apiKey) {
    const response = await apiClient.put('/admin/api-key/update',
      { apiKey },
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    return response.data
  },

  /**
   * Remove API key
   * @param {string} token - Admin JWT token
   * @returns {Promise<Object>} Removal result
   */
  async removeApiKey(token) {
    const response = await apiClient.delete('/admin/api-key/remove', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    return response.data
  },

  /**
   * Change admin password
   * @param {string} token - Admin JWT token
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Change password result
   */
  async changePassword(token, currentPassword, newPassword) {
    const response = await apiClient.put('/admin/password/change',
      { currentPassword, newPassword },
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    return response.data
  }
}

export default apiClient
