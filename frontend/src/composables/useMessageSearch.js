import { ref, computed, watch } from 'vue'

/**
 * Message search composable for searching within a conversation
 */
export function useMessageSearch(messages) {
  const searchQuery = ref('')
  const searchResults = ref([])
  const currentResultIndex = ref(-1)
  const isSearching = ref(false)

  // Search through messages
  const performSearch = () => {
    if (!searchQuery.value || searchQuery.value.length < 2) {
      searchResults.value = []
      currentResultIndex.value = -1
      return
    }

    isSearching.value = true

    try {
      const query = searchQuery.value.toLowerCase()
      const results = []

      messages.value.forEach((message, messageIndex) => {
        if (!message.content) return

        const content = message.content.toLowerCase()
        let searchIndex = 0

        // Find all occurrences in this message
        while ((searchIndex = content.indexOf(query, searchIndex)) !== -1) {
          results.push({
            messageIndex,
            messageId: message.id,
            position: searchIndex,
            message: message,
            preview: getPreview(message.content, searchIndex, query.length)
          })
          searchIndex += query.length
        }
      })

      searchResults.value = results
      currentResultIndex.value = results.length > 0 ? 0 : -1
    } finally {
      isSearching.value = false
    }
  }

  // Get preview text around the match
  const getPreview = (text, position, queryLength, contextLength = 50) => {
    const start = Math.max(0, position - contextLength)
    const end = Math.min(text.length, position + queryLength + contextLength)

    let preview = text.substring(start, end)

    if (start > 0) preview = '...' + preview
    if (end < text.length) preview = preview + '...'

    return preview
  }

  // Navigate to next result
  const nextResult = () => {
    if (searchResults.value.length === 0) return
    currentResultIndex.value = (currentResultIndex.value + 1) % searchResults.value.length
  }

  // Navigate to previous result
  const previousResult = () => {
    if (searchResults.value.length === 0) return
    currentResultIndex.value = currentResultIndex.value <= 0
      ? searchResults.value.length - 1
      : currentResultIndex.value - 1
  }

  // Get current result
  const currentResult = computed(() => {
    if (currentResultIndex.value < 0 || currentResultIndex.value >= searchResults.value.length) {
      return null
    }
    return searchResults.value[currentResultIndex.value]
  })

  // Clear search
  const clearSearch = () => {
    searchQuery.value = ''
    searchResults.value = []
    currentResultIndex.value = -1
  }

  // Watch for query changes and perform search
  watch(searchQuery, () => {
    performSearch()
  })

  return {
    searchQuery,
    searchResults,
    currentResultIndex,
    currentResult,
    isSearching,
    nextResult,
    previousResult,
    clearSearch,
    performSearch
  }
}
