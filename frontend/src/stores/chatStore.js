import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { chatApi } from '../services/api'
import { useSettingsStore } from './settingsStore'

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
  const selectedModel = ref('claude-sonnet-4-20250514') // Default model - Claude 4 Sonnet

  // Load conversations from database API
  function loadFromLocalStorage() {
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

      console.log('[Chat Store] Loaded from localStorage:', {
        conversationsCount: conversations.value.size,
        currentConv: currentConversationId.value
      })
    } catch (err) {
      console.error('[Chat Store] Failed to load from localStorage:', err)
    }
  }

  async function loadFromDatabase() {
    try {
      console.log('[Chat Store] Loading conversations from database...')

      // First, load from localStorage as fallback
      loadFromLocalStorage()
      const localCount = conversations.value.size
      console.log(`[Chat Store] Loaded ${localCount} conversations from localStorage`)

      // Then fetch from API
      const response = await chatApi.getConversations()

      if (response.conversations && Array.isArray(response.conversations)) {
        console.log(`[Chat Store] API returned ${response.conversations.length} conversations`)

        // Merge API conversations with local ones (keep newer version)
        if (response.conversations.length > 0) {
          // Merge conversations from API (don't clear local ones)
          response.conversations.forEach(conv => {
            const apiConv = {
              id: conv.id,
              title: conv.title || 'Conversation',
              createdAt: conv.createdAt?._seconds
                ? new Date(conv.createdAt._seconds * 1000).toISOString()
                : conv.createdAt,
              updatedAt: conv.updatedAt?._seconds
                ? new Date(conv.updatedAt._seconds * 1000).toISOString()
                : conv.updatedAt,
              messageCount: conv.messageCount || 0
            }
            
            // Only overwrite if API version is newer or doesn't exist locally
            const localConv = conversations.value.get(conv.id)
            if (!localConv || (apiConv.updatedAt && apiConv.updatedAt > localConv.updatedAt)) {
              conversations.value.set(conv.id, apiConv)
            }
          })

          console.log(`[Chat Store] Merged API conversations, total: ${conversations.value.size} conversations`)
        } else {
          console.log('[Chat Store] API returned empty list, keeping localStorage conversations')
        }
      }

      // Load current conversation ID from localStorage
      const storedCurrentConv = localStorage.getItem(STORAGE_KEY_CURRENT_CONV)
      if (storedCurrentConv && conversations.value.has(storedCurrentConv)) {
        currentConversationId.value = storedCurrentConv
        // Load messages for current conversation
        await loadConversationMessages(storedCurrentConv)
      }
    } catch (err) {
      console.error('[Chat Store] Failed to load from database:', err)
      // localStorage already loaded above, so we're good
    }
  }


  // Fallback: Load from localStorage

  // Load messages for a specific conversation
  async function loadConversationMessages(conversationId) {
    try {
      const response = await chatApi.getConversation(conversationId)

      if (response.conversation && response.conversation.messages) {
        const formattedMessages = response.conversation.messages.map(msg => {
          console.log('[Chat Store] Loading message:', msg.id, 'metadata:', msg.metadata)
          console.log('[Chat Store] msg.toolsUsed:', msg.toolsUsed)
          console.log('[Chat Store] msg.metadata?.toolsUsed:', msg.metadata?.toolsUsed)

          return {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.createdAt?._seconds
              ? new Date(msg.createdAt._seconds * 1000).toISOString()
              : msg.createdAt,
            metadata: msg.metadata,
            // Preserve toolsUsed data from database
            toolsUsed: msg.toolsUsed || msg.metadata?.toolsUsed || []
          }
        })

        messages.value.set(conversationId, formattedMessages)
        console.log(`[Chat Store] Loaded ${formattedMessages.length} messages for conversation ${conversationId}`)
      }
    } catch (err) {
      console.error(`[Chat Store] Failed to load messages for ${conversationId}:`, err)
    }
  }

  // Save to localStorage
  function saveToStorage() {
    try {
      // Convert Map to plain object for JSON serialization
      const conversationsObj = Object.fromEntries(conversations.value)
      console.log(`[Chat Store] Saving ${conversations.value.size} conversations to localStorage`)
      localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(conversationsObj))

      const messagesObj = Object.fromEntries(messages.value)
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messagesObj))

      if (currentConversationId.value) {
        localStorage.setItem(STORAGE_KEY_CURRENT_CONV, currentConversationId.value)
      }
      console.log('[Chat Store] Successfully saved to localStorage')
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
  async function createConversation(serverId = null) {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const conversation = {
      id,
      serverId,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Add to local state immediately
    conversations.value.set(id, conversation)
    messages.value.set(id, [])
    currentConversationId.value = id

    // Persist to database immediately
    try {
      await chatApi.createConversation(id, conversation.title)
      console.log(`[Chat Store] Created conversation ${id} in database`)
    } catch (err) {
      console.error('[Chat Store] Failed to create conversation in database:', err)
      // Continue anyway - conversation exists locally
    }

    saveToStorage()
    return id
  }

  async function setCurrentConversation(conversationId) {
    if (conversations.value.has(conversationId)) {
      currentConversationId.value = conversationId
      saveToStorage()

      // Load messages if not already loaded
      if (!messages.value.has(conversationId) || messages.value.get(conversationId).length === 0) {
        await loadConversationMessages(conversationId)
      }
    }
  }

  function addMessage(conversationId, message) {
    console.log('[Chat Store] addMessage called for conversation:', conversationId)
    console.log('[Chat Store] addMessage message object:', message)
    console.log('[Chat Store] addMessage message.toolsUsed:', message.toolsUsed)

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

    console.log('[Chat Store] addMessage newMessage created:', newMessage)
    console.log('[Chat Store] addMessage newMessage.toolsUsed:', newMessage.toolsUsed)

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

    console.log('[Chat Store] Calling saveToStorage from addMessage')
    saveToStorage()
  }

  async function sendMessage(content, serverId = null, documentIds = []) {
    if (!content.trim() && (!documentIds || documentIds.length === 0)) return

    try {
      // Create conversation if none exists
      if (!currentConversationId.value) {
        await createConversation(serverId)
      }

      const conversationId = currentConversationId.value
      const conversation = conversations.value.get(conversationId)

      // Add user message with document attachments
      const userMessage = {
        role: 'user',
        content: content.trim()
      }

      // Add document IDs if any
      if (documentIds && documentIds.length > 0) {
        userMessage.documentIds = documentIds
        console.log(`[Chat Store] Adding message with ${documentIds.length} document(s)`)
      }

      addMessage(conversationId, userMessage)

      // Update conversation title from first message
      if (conversation && conversation.title === 'New Conversation') {
        const newTitle = content.trim().substring(0, 50) + (content.trim().length > 50 ? '...' : '')
        conversation.title = newTitle

        // Update title in database immediately
        try {
          await chatApi.updateConversation(conversationId, { title: newTitle })
          console.log(`[Chat Store] Updated conversation title to: ${newTitle}`)
        } catch (err) {
          console.error('[Chat Store] Failed to update conversation title:', err)
        }
      }

      // Set loading state
      isLoading.value = true
      isStreaming.value = true
      error.value = null

      // NOTE: Authentication now handled via JWT token in Authorization header
      // No need to pass Quendoo API key anymore

      // Track tools being executed in real-time
      const toolsInProgress = ref([])

      // Create a temporary assistant message that will be updated in real-time
      const tempMessageId = `msg_${Date.now()}_temp`
      addMessage(conversationId, {
        id: tempMessageId,
        role: 'assistant',
        content: '',  // Will be filled when complete
        timestamp: new Date().toISOString(),
        toolsUsed: toolsInProgress.value,
        isStreaming: true  // Mark as streaming
      })

      // Send message using SSE streaming
      await chatApi.sendMessageStreaming(
        content.trim(),
        conversationId,
        serverId,
        selectedModel.value,
        {
          // Real-time callback when a tool starts
          onToolStart: (toolName, toolParams) => {
            console.log(`[Chat Store] Tool started: ${toolName}`)
            toolsInProgress.value.push({
              name: toolName,
              params: toolParams,
              status: 'running'
            })

            // Update the temporary message with current tools
            const msgs = messages.value.get(conversationId)
            const tempMsg = msgs.find(m => m.id === tempMessageId)
            if (tempMsg) {
              tempMsg.toolsUsed = [...toolsInProgress.value]
            }
            saveToStorage()
          },

          // Real-time callback when a tool completes
          onToolProgress: (tool) => {
            console.log(`[Chat Store] Tool completed: ${tool.name} (${tool.duration}ms)`)

            // Find and update the tool in progress
            const toolInProgress = toolsInProgress.value.find(t => t.name === tool.name && t.status === 'running')
            if (toolInProgress) {
              toolInProgress.status = 'completed'
              toolInProgress.duration = tool.duration
            }

            // Update the temporary message
            const msgs = messages.value.get(conversationId)
            const tempMsg = msgs.find(m => m.id === tempMessageId)
            if (tempMsg) {
              tempMsg.toolsUsed = [...toolsInProgress.value]
            }
            saveToStorage()
          },

          // Final callback when complete
          onComplete: (response) => {
            console.log('[Chat Store] Streaming complete')
            console.log('[Chat Store] Response object:', response)
            console.log('[Chat Store] response.toolsUsed:', response.toolsUsed)
            console.log('[Chat Store] toolsUsed type:', typeof response.toolsUsed)
            console.log('[Chat Store] toolsUsed isArray:', Array.isArray(response.toolsUsed))
            if (response.toolsUsed && Array.isArray(response.toolsUsed)) {
              console.log('[Chat Store] toolsUsed length:', response.toolsUsed.length)
              response.toolsUsed.forEach((tool, idx) => {
                console.log(`[Chat Store] Tool ${idx}:`, tool.name, 'has result:', !!tool.result)
              })
            }

            // Remove temporary message
            const msgs = messages.value.get(conversationId)
            const tempMsgIndex = msgs.findIndex(m => m.id === tempMessageId)
            if (tempMsgIndex !== -1) {
              msgs.splice(tempMsgIndex, 1)
            }

            // Add final AI response with all tools used
            addMessage(conversationId, {
              role: 'assistant',
              content: response.content,
              timestamp: response.timestamp,
              toolsUsed: response.toolsUsed || []
            })

            isLoading.value = false
            isStreaming.value = false
          },

          // Error callback
          onError: (error) => {
            console.error('[Chat Store] Streaming error:', error)

            // Remove temporary message
            const msgs = messages.value.get(conversationId)
            const tempMsgIndex = msgs.findIndex(m => m.id === tempMessageId)
            if (tempMsgIndex !== -1) {
              msgs.splice(tempMsgIndex, 1)
            }

            isLoading.value = false
            isStreaming.value = false
            setError(error.message || 'Failed to send message')
          }
        },
        documentIds // Pass document IDs to API
      )

    } catch (err) {
      console.error('[Chat Store] Send message error:', err)
      isLoading.value = false
      isStreaming.value = false
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
    // Cleanup function - reserved for future use
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
    loadFromDatabase,
    loadFromLocalStorage,
    loadFromStorage: loadFromLocalStorage, // Backwards compatibility alias
    loadConversationMessages,
    saveToStorage
  }
})
