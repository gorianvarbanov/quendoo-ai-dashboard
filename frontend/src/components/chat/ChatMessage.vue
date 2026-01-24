<template>
  <div :class="['message-container', isUser ? 'message-user' : 'message-assistant']">
    <!-- Avatar -->
    <div class="message-avatar">
      <v-avatar
        v-if="isUser"
        color="primary"
        size="28"
      >
        <v-icon icon="mdi-account" size="16" color="white" />
      </v-avatar>
      <img
        v-else
        src="@/assets/quendoo-logo.svg"
        alt="Quendoo AI"
        class="ai-avatar"
      />
    </div>

    <!-- Message bubble -->
    <div class="message-bubble">
      <!-- Header -->
      <div class="message-header">
        <span class="message-role">{{ isUser ? 'You' : 'Quendoo AI' }}</span>
        <span class="message-timestamp">{{ formattedTime }}</span>
      </div>

      <!-- Message Content -->
      <MessageContent
        :content="message.content"
        :is-user="isUser"
        :is-streaming="isStreaming"
        :should-animate="shouldAnimate"
        @typing="$emit('typing')"
      />

      <!-- Tools Timeline -->
      <ToolExecutionTimeline
        v-if="!isUser"
        :tools-used="toolsUsed"
        :is-streaming="isStreaming"
        :hide-for-scraper="!!scraperCacheKey || !!batchScraperBatchId"
      />

      <!-- Visualizations -->
      <MessageVisualization
        v-if="!isUser"
        :message="message"
        :tools-used="toolsUsed"
        :is-streaming="isStreaming"
        :is-typing="isTyping"
        @open-availability="$emit('open-availability', $event)"
      />

      <!-- Message Actions -->
      <MessageActions
        v-if="!isUser && !isStreaming && !isTyping"
        :message="message"
        @copy="copyMessage"
        @like="handleLike"
        @dislike="handleDislike"
        @retry="handleRetry"
      />

      <!-- Streaming indicator -->
      <div v-if="isStreaming" class="message-streaming">
        <v-icon icon="mdi-dots-horizontal" size="14" class="streaming-icon" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { format } from 'date-fns'
import MessageContent from './message/MessageContent.vue'
import ToolExecutionTimeline from './message/ToolExecutionTimeline.vue'
import MessageVisualization from './message/MessageVisualization.vue'
import MessageActions from './message/MessageActions.vue'

const props = defineProps({
  message: {
    type: Object,
    required: true
  },
  isStreaming: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['typing', 'open-availability'])

// Basic computed properties
const isUser = computed(() => props.message.role === 'user')

const toolsUsed = computed(() => {
  if (!props.message.toolsUsed) return []

  if (Array.isArray(props.message.toolsUsed)) {
    return props.message.toolsUsed
  }

  return []
})

const formattedTime = computed(() => {
  if (!props.message.timestamp) return ''
  try {
    return format(new Date(props.message.timestamp), 'HH:mm')
  } catch (e) {
    return ''
  }
})

// Typewriter effect state
const isTyping = ref(false)
const shouldAnimate = ref(false)

onMounted(() => {
  if (!isUser.value && props.message.content && !props.isStreaming) {
    // Only animate if this is a new message (created within last 500ms)
    const messageAge = Date.now() - new Date(props.message.timestamp).getTime()
    if (messageAge < 500) {
      shouldAnimate.value = true
    }
  }
})

// Detect scraper cache key (to hide tools timeline when scraper is active)
const scraperCacheKey = computed(() => {
  if (!toolsUsed.value || toolsUsed.value.length === 0) return null

  const scraperTool = toolsUsed.value.find(tool => tool.name === 'scrape_competitor_prices')
  if (!scraperTool) {
    const checkStatusTool = toolsUsed.value.find(tool => tool.name === 'check_scrape_status')
    if (checkStatusTool) {
      try {
        const plainResult = JSON.parse(JSON.stringify(checkStatusTool.result))
        if (plainResult?.cacheKey) {
          return plainResult.cacheKey
        }
      } catch (e) {
        // Ignore
      }
    }
    return null
  }

  let cacheKey = null

  if (scraperTool.result?.cacheKey) {
    cacheKey = scraperTool.result.cacheKey
  }

  if (!cacheKey && scraperTool.result?.result?.cacheKey) {
    cacheKey = scraperTool.result.result.cacheKey
  }

  if (!cacheKey && scraperTool.cacheKey) {
    cacheKey = scraperTool.cacheKey
  }

  return cacheKey
})

// Detect batch scraper batch ID
const batchScraperBatchId = computed(() => {
  if (!toolsUsed.value || toolsUsed.value.length === 0) return null

  const batchScraperTool = toolsUsed.value.find(tool => tool.name === 'scrape_and_compare_hotels')
  if (!batchScraperTool) return null

  let batchId = null

  if (batchScraperTool.result?.batchId) {
    batchId = batchScraperTool.result.batchId
  }

  if (!batchId && batchScraperTool.result?.result?.batchId) {
    batchId = batchScraperTool.result.result.batchId
  }

  if (!batchId && batchScraperTool.batchId) {
    batchId = batchScraperTool.batchId
  }

  return batchId
})

// Action handlers
async function copyMessage() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    console.log('[ChatMessage] Message copied to clipboard')
  } catch (error) {
    console.error('[ChatMessage] Failed to copy message:', error)
    // Fallback method
    try {
      const textarea = document.createElement('textarea')
      textarea.value = props.message.content
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      console.log('[ChatMessage] Message copied using fallback method')
    } catch (fallbackError) {
      console.error('[ChatMessage] Fallback copy also failed:', fallbackError)
    }
  }
}

function handleLike() {
  console.log('[ChatMessage] User liked message:', props.message.id)
  // TODO: Implement feedback system
}

function handleDislike() {
  console.log('[ChatMessage] User disliked message:', props.message.id)
  // TODO: Implement feedback system
}

function handleRetry() {
  console.log('[ChatMessage] User requested retry for message:', props.message.id)
  // TODO: Implement retry functionality
}
</script>

<style scoped>
.message-container {
  display: flex;
  gap: 12px;
  width: 100%;
  padding: 8px 0;
}

/* User messages - right aligned with background */
.message-user {
  justify-content: flex-end;
}

.message-user .message-bubble {
  background: rgba(var(--v-theme-primary), 0.08);
  border-radius: 16px;
  padding: 12px 16px;
  max-width: 80%;
}

/* AI messages - left aligned, no background */
.message-assistant {
  justify-content: flex-start;
}

.message-container:hover .message-actions {
  opacity: 1;
}

.message-avatar {
  flex-shrink: 0;
}

.message-user .message-avatar {
  order: 2;
}

.ai-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.message-bubble {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.message-role {
  font-weight: 600;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-on-surface));
}

.message-timestamp {
  font-size: 0.6875rem;
  color: rgba(var(--v-theme-on-surface), 0.4);
  font-weight: 400;
}

.message-streaming {
  margin-top: 8px;
  display: flex;
  align-items: center;
}

.streaming-icon {
  animation: pulse 1.5s ease-in-out infinite;
  color: rgba(var(--v-theme-on-surface), 0.5);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
