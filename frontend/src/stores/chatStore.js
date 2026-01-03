import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { chatApi } from '../services/api'
import sseClient from '../services/sseClient'

const STORAGE_KEY_CONVERSATIONS = 'quendoo-conversations'
const STORAGE_KEY_MESSAGES = 'quendoo-messages'
const STORAGE_KEY_CURRENT_CONV = 'quendoo-current-conversation'

export const useChatStore = defineStore('chat', () => {
  // State
  const conversations = ref(new Map())
  const currentConversationId = ref(null)
  const messages = ref(new Map())
  const isLoading = ref(false)
  const streamingMessage = ref('')
  const isStreaming = ref(false)
  const error = ref(null)
  const selectedModel = ref('claude-3-5-sonnet-20241022') // Default model

  // Load from localStorage on init
  function loadFromStorage() {
    try {
      // Load conversations
      const storedConversations = localStorage.getItem(STORAGE_KEY_CONVERSATIONS)
      if (storedConversations) {
        const parsed = JSON.parse(storedConversations)
        conversations.value = new Map(Object.entries(parsed))
      }

      // Load messages
      const storedMessages = localStorage.getItem(STORAGE_KEY_MESSAGES)
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages)
        messages.value = new Map(Object.entries(parsed))
      }

      // Load current conversation ID
      const storedCurrentConv = localStorage.getItem(STORAGE_KEY_CURRENT_CONV)
      if (storedCurrentConv && conversations.value.has(storedCurrentConv)) {
        currentConversationId.value = storedCurrentConv
      }

      console.log('[Chat Store] Loaded from storage:', {
        conversationsCount: conversations.value.size,
        currentConv: currentConversationId.value
      })
    } catch (err) {
      console.error('[Chat Store] Failed to load from storage:', err)
    }
  }

  // Save to localStorage
  function saveToStorage() {
    try {
      // Convert Map to plain object for JSON serialization
      const conversationsObj = Object.fromEntries(conversations.value)
      localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(conversationsObj))

      const messagesObj = Object.fromEntries(messages.value)
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messagesObj))

      if (currentConversationId.value) {
        localStorage.setItem(STORAGE_KEY_CURRENT_CONV, currentConversationId.value)
      }
    } catch (err) {
      console.error('[Chat Store] Failed to save to storage:', err)
    }
  }

  // Getters
  const currentMessages = computed(() => {
    if (!currentConversationId.value) return []
    return messages.value.get(currentConversationId.value) || []
  })

  const currentConversation = computed(() => {
    if (!currentConversationId.value) return null
    return conversations.value.get(currentConversationId.value)
  })

  // Actions
  function createConversation(serverId = null) {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const conversation = {
      id,
      serverId,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    conversations.value.set(id, conversation)
    messages.value.set(id, [])
    currentConversationId.value = id

    saveToStorage()
    return id
  }

  function setCurrentConversation(conversationId) {
    if (conversations.value.has(conversationId)) {
      currentConversationId.value = conversationId
      saveToStorage()
    }
  }

  function addMessage(conversationId, message) {
    if (!messages.value.has(conversationId)) {
      messages.value.set(conversationId, [])
    }

    const conversationMessages = messages.value.get(conversationId)
    const newMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: message.role, // 'user' or 'assistant'
      content: message.content,
      timestamp: new Date().toISOString(),
      ...message
    }

    conversationMessages.push(newMessage)

    // Update conversation's updatedAt and title
    const conversation = conversations.value.get(conversationId)
    if (conversation) {
      conversation.updatedAt = new Date().toISOString()

      // Auto-generate title from first user message
      if (conversation.title === 'New Conversation' && message.role === 'user') {
        conversation.title = message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '')
      }
    }

    saveToStorage()
  }

  async function sendMessage(content, serverId = null) {
    if (!content.trim()) return

    try {
      // Create conversation if none exists
      if (!currentConversationId.value) {
        createConversation(serverId)
      }

      const conversationId = currentConversationId.value

      // Add user message
      addMessage(conversationId, {
        role: 'user',
        content: content.trim()
      })

      // Set loading state
      isLoading.value = true
      error.value = null

      // Send message to backend
      const response = await chatApi.sendMessage(
        content.trim(),
        conversationId,
        serverId,
        selectedModel.value
      )

      // Handle response based on type
      if (response.status === 'success') {
        // Direct JSON response - add AI message immediately
        addMessage(conversationId, {
          role: 'assistant',
          content: response.response.content,
          timestamp: response.response.timestamp
        })
        isLoading.value = false
      } else if (response.status === 'streaming') {
        // SSE streaming response - connect to stream
        startStreaming()

        sseClient.connect(conversationId, {
          onOpen: () => {
            console.log('[Chat Store] Stream connected')
          },
          onMessage: (chunk) => {
            appendStreamChunk(chunk)
          },
          onComplete: () => {
            completeStream(conversationId)
          },
          onError: (err) => {
            console.error('[Chat Store] Stream error:', err)
            setError(err.message || 'Stream connection failed')
            sseClient.disconnect(conversationId)
          }
        })
      } else {
        throw new Error('Unexpected response format from server')
      }
    } catch (err) {
      console.error('[Chat Store] Send message error:', err)
      setError(err.response?.data?.error || err.message || 'Failed to send message')
    }
  }

  function startStreaming() {
    isStreaming.value = true
    streamingMessage.value = ''
  }

  function appendStreamChunk(chunk) {
    streamingMessage.value += chunk
  }

  function completeStream(conversationId) {
    if (streamingMessage.value) {
      addMessage(conversationId, {
        role: 'assistant',
        content: streamingMessage.value
      })
    }

    isStreaming.value = false
    streamingMessage.value = ''
    isLoading.value = false
  }

  function clearConversation(conversationId) {
    messages.value.set(conversationId, [])
  }

  function deleteConversation(conversationId) {
    conversations.value.delete(conversationId)
    messages.value.delete(conversationId)

    if (currentConversationId.value === conversationId) {
      currentConversationId.value = null
    }

    saveToStorage()
  }

  function setError(errorMessage) {
    error.value = errorMessage
    isLoading.value = false
    isStreaming.value = false
  }

  function clearError() {
    error.value = null
  }

  async function loadConversations() {
    try {
      const data = await chatApi.getConversations()

      // Convert array to Map
      data.forEach(conv => {
        conversations.value.set(conv.id, conv)
      })
    } catch (err) {
      console.error('[Chat Store] Failed to load conversations:', err)
      setError('Failed to load conversations')
    }
  }

  async function loadConversation(conversationId) {
    try {
      const data = await chatApi.getConversation(conversationId)

      // Update conversation
      conversations.value.set(conversationId, {
        id: data.conversationId,
        title: data.conversationId,
        updatedAt: new Date().toISOString()
      })

      // Update messages
      messages.value.set(conversationId, data.messages || [])

      return data
    } catch (err) {
      console.error('[Chat Store] Failed to load conversation:', err)
      setError('Failed to load conversation')
    }
  }

  async function removeConversation(conversationId) {
    try {
      // Disconnect SSE if connected
      sseClient.disconnect(conversationId)

      // Delete from backend
      await chatApi.deleteConversation(conversationId)

      // Delete locally
      deleteConversation(conversationId)
    } catch (err) {
      console.error('[Chat Store] Failed to delete conversation:', err)
      setError('Failed to delete conversation')
    }
  }

  function cleanup() {
    // Disconnect all SSE connections
    sseClient.disconnectAll()
  }

  return {
    // State
    conversations,
    currentConversationId,
    messages,
    isLoading,
    streamingMessage,
    isStreaming,
    error,
    selectedModel,

    // Getters
    currentMessages,
    currentConversation,

    // Actions
    createConversation,
    setCurrentConversation,
    addMessage,
    sendMessage,
    startStreaming,
    appendStreamChunk,
    completeStream,
    clearConversation,
    deleteConversation,
    setError,
    clearError,
    loadConversations,
    loadConversation,
    removeConversation,
    cleanup,
    loadFromStorage,
    saveToStorage
  }
})
