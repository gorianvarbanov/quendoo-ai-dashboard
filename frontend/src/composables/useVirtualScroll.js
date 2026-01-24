import { ref, computed, watch, nextTick } from 'vue'
import { useVirtualList } from '@vueuse/core'

/**
 * Virtual scrolling composable for message lists
 * Note: For chat interfaces with highly dynamic content (images, tables, etc.),
 * consider if virtual scrolling is the best approach or if pagination might be better.
 */
export function useVirtualScroll(messages, options = {}) {
  const containerRef = ref(null)
  const {
    itemHeight = 200, // Average message height estimate
    overscan = 5 // Number of extra items to render for smooth scrolling
  } = options

  // Estimate height based on message content for better virtual scrolling
  const estimateHeight = (message) => {
    let height = 100 // Base height

    // Add height for content length
    if (message.content?.length > 500) height += 100
    if (message.content?.length > 1000) height += 150

    // Add height for tools used
    if (message.toolsUsed?.length > 0) height += 80

    // Add height for visualizations metadata
    if (message.metadata?.hasVisualizations) height += 120
    if (message.metadata?.hasTable) height += 150
    if (message.metadata?.hasRoomImages) height += 200

    return height
  }

  // Use @vueuse/core's useVirtualList
  const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(
    messages,
    {
      itemHeight: (item) => estimateHeight(item),
      overscan
    }
  )

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = async () => {
    await nextTick()
    if (messages.value && messages.value.length > 0) {
      scrollTo(messages.value.length - 1)
    }
  }

  // Watch for new messages and auto-scroll
  let previousLength = 0
  watch(
    () => messages.value?.length || 0,
    (newLength) => {
      if (newLength > previousLength) {
        // New message added, scroll to bottom
        scrollToBottom()
      }
      previousLength = newLength
    },
    { immediate: true }
  )

  return {
    list,
    containerProps,
    wrapperProps,
    scrollTo,
    scrollToBottom,
    containerRef,
    estimateHeight
  }
}
