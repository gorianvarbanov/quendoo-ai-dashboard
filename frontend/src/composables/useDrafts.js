import { ref, watch, onMounted } from 'vue'

/**
 * Draft management composable for auto-saving unsent messages
 */
export function useDrafts(conversationId) {
  const STORAGE_KEY_PREFIX = 'quendoo_draft_'
  const draft = ref('')
  const hasDraft = ref(false)
  const draftSavedAt = ref(null)

  // Get storage key for current conversation
  const getStorageKey = () => {
    return `${STORAGE_KEY_PREFIX}${conversationId.value || 'default'}`
  }

  // Save draft to localStorage
  const saveDraft = (content) => {
    if (!content || content.trim().length === 0) {
      clearDraft()
      return
    }

    try {
      const draftData = {
        content,
        savedAt: new Date().toISOString(),
        conversationId: conversationId.value
      }

      localStorage.setItem(getStorageKey(), JSON.stringify(draftData))
      hasDraft.value = true
      draftSavedAt.value = draftData.savedAt

      console.log('[Drafts] Draft saved for conversation:', conversationId.value)
    } catch (error) {
      console.error('[Drafts] Failed to save draft:', error)
    }
  }

  // Load draft from localStorage
  const loadDraft = () => {
    try {
      const storedDraft = localStorage.getItem(getStorageKey())

      if (storedDraft) {
        const draftData = JSON.parse(storedDraft)
        draft.value = draftData.content
        hasDraft.value = true
        draftSavedAt.value = draftData.savedAt

        console.log('[Drafts] Draft loaded for conversation:', conversationId.value)
        return draft.value
      }
    } catch (error) {
      console.error('[Drafts] Failed to load draft:', error)
    }

    return ''
  }

  // Clear draft from localStorage
  const clearDraft = () => {
    try {
      localStorage.removeItem(getStorageKey())
      draft.value = ''
      hasDraft.value = false
      draftSavedAt.value = null

      console.log('[Drafts] Draft cleared for conversation:', conversationId.value)
    } catch (error) {
      console.error('[Drafts] Failed to clear draft:', error)
    }
  }

  // Auto-save draft when content changes (debounced)
  let saveTimeout = null
  const autosaveDraft = (content) => {
    clearTimeout(saveTimeout)

    saveTimeout = setTimeout(() => {
      saveDraft(content)
    }, 500) // 500ms debounce
  }

  // Watch conversationId changes and load draft for new conversation
  watch(conversationId, (newConversationId) => {
    if (newConversationId) {
      loadDraft()
    }
  })

  // Load draft on mount
  onMounted(() => {
    if (conversationId.value) {
      loadDraft()
    }
  })

  // Clean up old drafts (older than 7 days)
  const cleanupOldDrafts = () => {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(STORAGE_KEY_PREFIX)) {
          try {
            const draftData = JSON.parse(localStorage.getItem(key))
            const savedAt = new Date(draftData.savedAt)

            if (savedAt < sevenDaysAgo) {
              localStorage.removeItem(key)
              console.log('[Drafts] Cleaned up old draft:', key)
            }
          } catch (error) {
            // Invalid draft data, remove it
            localStorage.removeItem(key)
          }
        }
      })
    } catch (error) {
      console.error('[Drafts] Failed to cleanup old drafts:', error)
    }
  }

  // Run cleanup on mount
  onMounted(() => {
    cleanupOldDrafts()
  })

  return {
    draft,
    hasDraft,
    draftSavedAt,
    saveDraft,
    loadDraft,
    clearDraft,
    autosaveDraft
  }
}
