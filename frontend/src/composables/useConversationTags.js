import { ref, computed } from 'vue'

/**
 * Conversation tags and favorites management composable
 * Uses localStorage for persistence until backend integration
 */
export function useConversationTags() {
  const TAGS_STORAGE_KEY = 'quendoo_conversation_tags'
  const FAVORITES_STORAGE_KEY = 'quendoo_conversation_favorites'

  // Load from localStorage
  const conversationTags = ref(loadTags())
  const favoriteConversations = ref(loadFavorites())

  // Available predefined tags
  const predefinedTags = [
    { name: 'Important', color: 'error', icon: 'mdi-star' },
    { name: 'Work', color: 'primary', icon: 'mdi-briefcase' },
    { name: 'Personal', color: 'success', icon: 'mdi-account' },
    { name: 'Follow-up', color: 'warning', icon: 'mdi-clock-alert' },
    { name: 'Archive', color: 'grey', icon: 'mdi-archive' }
  ]

  // Load tags from localStorage
  function loadTags() {
    try {
      const stored = localStorage.getItem(TAGS_STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.error('[Tags] Failed to load tags:', error)
      return {}
    }
  }

  // Save tags to localStorage
  function saveTags() {
    try {
      localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(conversationTags.value))
    } catch (error) {
      console.error('[Tags] Failed to save tags:', error)
    }
  }

  // Load favorites from localStorage
  function loadFavorites() {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('[Tags] Failed to load favorites:', error)
      return []
    }
  }

  // Save favorites to localStorage
  function saveFavorites() {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteConversations.value))
    } catch (error) {
      console.error('[Tags] Failed to save favorites:', error)
    }
  }

  // Add tag to conversation
  const addTag = (conversationId, tag) => {
    if (!conversationTags.value[conversationId]) {
      conversationTags.value[conversationId] = []
    }

    if (!conversationTags.value[conversationId].includes(tag)) {
      conversationTags.value[conversationId].push(tag)
      saveTags()
    }
  }

  // Remove tag from conversation
  const removeTag = (conversationId, tag) => {
    if (conversationTags.value[conversationId]) {
      conversationTags.value[conversationId] = conversationTags.value[conversationId].filter(t => t !== tag)
      saveTags()
    }
  }

  // Get tags for conversation
  const getTags = (conversationId) => {
    return conversationTags.value[conversationId] || []
  }

  // Toggle favorite
  const toggleFavorite = (conversationId) => {
    const index = favoriteConversations.value.indexOf(conversationId)

    if (index === -1) {
      favoriteConversations.value.push(conversationId)
    } else {
      favoriteConversations.value.splice(index, 1)
    }

    saveFavorites()
  }

  // Check if conversation is favorite
  const isFavorite = (conversationId) => {
    return favoriteConversations.value.includes(conversationId)
  }

  // Get all conversations with specific tag
  const getConversationsWithTag = (tag) => {
    return Object.keys(conversationTags.value).filter(conversationId => {
      return conversationTags.value[conversationId].includes(tag)
    })
  }

  // Get all used tags
  const allUsedTags = computed(() => {
    const tags = new Set()
    Object.values(conversationTags.value).forEach(tagArray => {
      tagArray.forEach(tag => tags.add(tag))
    })
    return Array.from(tags)
  })

  return {
    conversationTags,
    favoriteConversations,
    predefinedTags,
    allUsedTags,
    addTag,
    removeTag,
    getTags,
    toggleFavorite,
    isFavorite,
    getConversationsWithTag
  }
}
