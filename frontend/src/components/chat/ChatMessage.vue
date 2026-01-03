<template>
  <div :class="['message-container', isUser ? 'message-user' : 'message-assistant']">
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

    <div class="message-bubble">
      <div class="message-header">
        <span class="message-role">{{ isUser ? 'You' : 'Quendoo AI' }}</span>
        <span class="message-timestamp">{{ formattedTime }}</span>
      </div>

      <div class="message-content">
        <span v-html="formattedContent"></span>
        <span v-if="isTyping" class="typing-cursor">|</span>
      </div>

      <!-- Table Viewer Button (shown when tables detected and typing is complete) -->
      <div v-if="hasTable && !isUser && !isStreaming && !isTyping" class="table-viewer-button">
        <v-btn
          variant="outlined"
          size="small"
          prepend-icon="mdi-table-eye"
          color="primary"
          @click="openTableViewer"
        >
          View as Table
        </v-btn>
      </div>

      <div v-if="!isUser && !isStreaming && !isTyping" class="message-actions">
        <v-btn icon variant="text" size="x-small" title="Copy">
          <v-icon size="14">mdi-content-copy</v-icon>
        </v-btn>
        <v-btn icon variant="text" size="x-small" title="Good response">
          <v-icon size="14">mdi-thumb-up-outline</v-icon>
        </v-btn>
        <v-btn icon variant="text" size="x-small" title="Bad response">
          <v-icon size="14">mdi-thumb-down-outline</v-icon>
        </v-btn>
        <v-btn icon variant="text" size="x-small" title="Retry">
          <v-icon size="14">mdi-refresh</v-icon>
        </v-btn>
      </div>

      <div v-if="isStreaming" class="message-streaming">
        <v-icon icon="mdi-dots-horizontal" size="14" class="streaming-icon" />
      </div>
    </div>

    <!-- Table Viewer Component -->
    <TableViewer
      v-model="tableViewerOpen"
      :table-data="parsedTableData"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { format } from 'date-fns'
import TableViewer from '@/components/common/TableViewer.vue'

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

const emit = defineEmits(['typing'])

const isUser = computed(() => props.message.role === 'user')

// Typewriter effect for AI messages
const displayedContent = ref('')
const isTyping = ref(false)

// Check if message should have typewriter effect (new AI messages only)
const shouldAnimate = ref(false)

onMounted(() => {
  if (!isUser.value && props.message.content && !props.isStreaming) {
    // Only animate if this is a new message (created within last 500ms)
    const messageAge = Date.now() - new Date(props.message.timestamp).getTime()
    if (messageAge < 500) {
      shouldAnimate.value = true
      startTypewriterEffect()
    } else {
      // Old message, show immediately
      displayedContent.value = props.message.content
    }
  } else {
    displayedContent.value = props.message.content
  }
})

// Watch for content changes (streaming)
watch(() => props.message.content, (newContent) => {
  if (props.isStreaming || !shouldAnimate.value) {
    displayedContent.value = newContent
  }
})

function startTypewriterEffect() {
  isTyping.value = true
  displayedContent.value = ''
  const fullContent = props.message.content
  let currentIndex = 0

  const typeSpeed = 20 // milliseconds per character

  const typeInterval = setInterval(() => {
    if (currentIndex < fullContent.length) {
      displayedContent.value = fullContent.substring(0, currentIndex + 1)
      currentIndex++

      // Emit typing event every 10 characters to trigger scroll
      if (currentIndex % 10 === 0) {
        emit('typing')
      }
    } else {
      clearInterval(typeInterval)
      isTyping.value = false
      emit('typing') // Final scroll
    }
  }, typeSpeed)
}

const formattedTime = computed(() => {
  if (!props.message.timestamp) return ''
  try {
    return format(new Date(props.message.timestamp), 'HH:mm')
  } catch (e) {
    return ''
  }
})

// Table viewer state
const tableViewerOpen = ref(false)

// Detect if message contains markdown table (check full content, not displayed)
const hasTable = computed(() => {
  if (!props.message.content) return false
  // Regex to detect markdown tables (| header | header | on one line, followed by separator line)
  const tablePattern = /\|.+\|[\r\n]+\|[-:\s|]+\|/
  return tablePattern.test(props.message.content)
})

// Parse markdown table into structured data (use full content, not displayed)
const parsedTableData = computed(() => {
  if (!hasTable.value) return { headers: [], rows: [] }

  const content = props.message.content
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.startsWith('|'))

  if (lines.length < 2) return { headers: [], rows: [] }

  // Extract headers (first line)
  const headerLine = lines[0]
  const headers = headerLine
    .split('|')
    .slice(1, -1) // Remove first and last empty elements
    .map(cell => cell.trim())

  // Skip separator line (second line with dashes)
  // Extract data rows (remaining lines)
  const rows = lines.slice(2).map(line => {
    return line
      .split('|')
      .slice(1, -1)
      .map(cell => cell.trim())
  })

  return { headers, rows }
})

function openTableViewer() {
  tableViewerOpen.value = true
  console.log('[ChatMessage] Opening table viewer with data:', parsedTableData.value)
}

// Function to detect and linkify URLs in text
const formattedContent = computed(() => {
  // Use displayedContent for typewriter effect
  const contentToFormat = displayedContent.value || props.message.content || ''

  if (!contentToFormat) return ''

  // Escape HTML to prevent XSS
  const escapeHtml = (text) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  // URL regex pattern that matches http(s), ftp URLs
  const urlPattern = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g

  // Escape HTML first
  let content = escapeHtml(contentToFormat)

  // Replace URLs with clickable links
  content = content.replace(urlPattern, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="message-link">${url}</a>`
  })

  // Preserve line breaks
  content = content.replace(/\n/g, '<br>')

  return content
})
</script>

<style scoped>
.message-container {
  display: flex;
  gap: 12px;
  width: 100%;
  padding: 8px 0;
}

.message-container:hover .message-actions {
  opacity: 1;
}

.message-avatar {
  flex-shrink: 0;
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

.message-content {
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.7;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.9375rem;
  text-align: left;
}

.message-content :deep(.message-link) {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: opacity 0.2s;
  font-weight: 500;
}

.message-content :deep(.message-link:hover) {
  opacity: 0.8;
  text-decoration: underline;
}

.typing-cursor {
  display: inline-block;
  margin-left: 2px;
  animation: blink 1s step-end infinite;
  color: rgb(var(--v-theme-primary));
  font-weight: 400;
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

.table-viewer-button {
  margin-top: 12px;
  margin-bottom: 4px;
}

.message-actions {
  display: flex;
  gap: 2px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-actions :deep(.v-btn) {
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.message-actions :deep(.v-btn:hover) {
  color: rgb(var(--v-theme-on-surface));
  background: rgba(var(--v-theme-on-surface), 0.05);
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
