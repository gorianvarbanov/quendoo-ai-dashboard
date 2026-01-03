/**
 * SSE Client Service - Handles Server-Sent Events streaming
 */

class SSEClient {
  constructor() {
    this.connections = new Map() // conversationId -> EventSource
    this.reconnectAttempts = new Map() // conversationId -> attempt count
    this.maxReconnectAttempts = 5
    this.baseReconnectDelay = 1000 // ms
  }

  /**
   * Connect to SSE stream for a conversation
   * @param {string} conversationId - Conversation ID
   * @param {Object} callbacks - Event callbacks
   * @param {Function} callbacks.onMessage - Called when message chunk received
   * @param {Function} callbacks.onError - Called on error
   * @param {Function} callbacks.onComplete - Called when stream ends
   * @param {Function} callbacks.onOpen - Called when connection opens
   */
  connect(conversationId, callbacks = {}) {
    // Close existing connection if any
    this.disconnect(conversationId)

    const url = this._buildStreamUrl(conversationId)

    if (import.meta.env.DEV) {
      console.log('[SSE] Connecting to:', url)
    }

    const eventSource = new EventSource(url)

    // Connection opened
    eventSource.addEventListener('open', () => {
      if (import.meta.env.DEV) {
        console.log('[SSE] Connected:', conversationId)
      }
      this.reconnectAttempts.set(conversationId, 0)
      callbacks.onOpen?.()
    })

    // Message received
    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data)

        if (import.meta.env.DEV) {
          console.log('[SSE] Message:', data)
        }

        // Handle different message types
        if (data.type === 'chunk') {
          callbacks.onMessage?.(data.content, data)
        } else if (data.type === 'complete') {
          callbacks.onComplete?.(data)
          this.disconnect(conversationId)
        } else if (data.type === 'error') {
          callbacks.onError?.(new Error(data.error || 'Stream error'))
          this.disconnect(conversationId)
        } else {
          // Generic message
          callbacks.onMessage?.(data.content || data, data)
        }
      } catch (error) {
        console.error('[SSE] Failed to parse message:', error, event.data)
        callbacks.onError?.(error)
      }
    })

    // Custom event types (MCP might send different event types)
    eventSource.addEventListener('chunk', (event) => {
      try {
        const data = JSON.parse(event.data)
        callbacks.onMessage?.(data.content || data, data)
      } catch (error) {
        console.error('[SSE] Failed to parse chunk:', error)
      }
    })

    eventSource.addEventListener('complete', (event) => {
      try {
        const data = JSON.parse(event.data)
        callbacks.onComplete?.(data)
      } catch (error) {
        console.error('[SSE] Failed to parse complete event:', error)
      }
      this.disconnect(conversationId)
    })

    // Error handling
    eventSource.addEventListener('error', (error) => {
      console.error('[SSE] Connection error:', error)

      const attemptCount = (this.reconnectAttempts.get(conversationId) || 0) + 1
      this.reconnectAttempts.set(conversationId, attemptCount)

      if (attemptCount < this.maxReconnectAttempts) {
        // Exponential backoff
        const delay = this.baseReconnectDelay * Math.pow(2, attemptCount - 1)

        if (import.meta.env.DEV) {
          console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${attemptCount}/${this.maxReconnectAttempts})`)
        }

        setTimeout(() => {
          if (this.connections.has(conversationId)) {
            this.connect(conversationId, callbacks)
          }
        }, delay)
      } else {
        console.error('[SSE] Max reconnection attempts reached')
        callbacks.onError?.(new Error('Connection failed after multiple attempts'))
        this.disconnect(conversationId)
      }
    })

    // Store connection
    this.connections.set(conversationId, eventSource)

    return eventSource
  }

  /**
   * Disconnect from SSE stream
   * @param {string} conversationId - Conversation ID
   */
  disconnect(conversationId) {
    const connection = this.connections.get(conversationId)

    if (connection) {
      if (import.meta.env.DEV) {
        console.log('[SSE] Disconnecting:', conversationId)
      }

      connection.close()
      this.connections.delete(conversationId)
      this.reconnectAttempts.delete(conversationId)
    }
  }

  /**
   * Disconnect all active streams
   */
  disconnectAll() {
    if (import.meta.env.DEV) {
      console.log('[SSE] Disconnecting all connections')
    }

    for (const conversationId of this.connections.keys()) {
      this.disconnect(conversationId)
    }
  }

  /**
   * Check if connected
   * @param {string} conversationId - Conversation ID
   * @returns {boolean}
   */
  isConnected(conversationId) {
    const connection = this.connections.get(conversationId)
    return connection && connection.readyState === EventSource.OPEN
  }

  /**
   * Get connection state
   * @param {string} conversationId - Conversation ID
   * @returns {number|null} EventSource readyState or null
   */
  getConnectionState(conversationId) {
    const connection = this.connections.get(conversationId)
    return connection ? connection.readyState : null
  }

  /**
   * Build SSE stream URL
   * @private
   */
  _buildStreamUrl(conversationId) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
    return `${baseUrl}/chat/stream?conversationId=${encodeURIComponent(conversationId)}`
  }
}

// Export singleton instance
export const sseClient = new SSEClient()

// Export class for testing
export { SSEClient }

export default sseClient
