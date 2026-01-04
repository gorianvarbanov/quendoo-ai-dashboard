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

      <!-- Tools Used Panel (shown for AI messages that used tools) -->
      <div v-if="!isUser && toolsUsed && toolsUsed.length > 0 && !isStreaming" class="tools-panel">
        <div class="tools-list">
          <v-chip
            v-for="(tool, index) in toolsUsed"
            :key="index"
            size="small"
            variant="tonal"
            color="primary"
            class="tool-chip"
          >
            <v-icon start size="14">mdi-{{ getToolIcon(tool.name) }}</v-icon>
            {{ tool.name }}
            <v-tooltip activator="parent" location="top">
              <div class="tool-tooltip">
                <div class="tool-tooltip-name">{{ tool.name }}</div>
                <div v-if="tool.duration" class="tool-tooltip-duration">
                  Duration: {{ tool.duration }}ms
                </div>
                <div v-if="tool.params" class="tool-tooltip-params">
                  <strong>Parameters:</strong>
                  <pre>{{ JSON.stringify(tool.params, null, 2) }}</pre>
                </div>
              </div>
            </v-tooltip>
          </v-chip>
        </div>
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
        <v-btn icon variant="text" size="x-small" title="Copy message" @click="copyMessage">
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
import { marked } from 'marked'
import TableViewer from '@/components/common/TableViewer.vue'

// Configure marked for better rendering
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true, // GitHub Flavored Markdown
  headerIds: false,
  mangle: false
})

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

// Extract tools used from message metadata
const toolsUsed = computed(() => {
  if (!props.message.toolsUsed) return []

  // If toolsUsed is already an array of tool objects
  if (Array.isArray(props.message.toolsUsed)) {
    return props.message.toolsUsed
  }

  // If toolsUsed is true/false, try to extract from content or other metadata
  return []
})

// Get appropriate icon for each tool
function getToolIcon(toolName) {
  const iconMap = {
    'get_availability': 'calendar-check',
    'update_availability': 'calendar-edit',
    'get_property_settings': 'cog',
    'get_rooms_details': 'bed',
    'get_bookings': 'book-open-variant',
    'get_booking_offers': 'tag-multiple',
    'make_call': 'phone',
    'send_quendoo_email': 'email',
    'default': 'wrench'
  }

  return iconMap[toolName] || iconMap.default
}

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

  const typeSpeed = 8 // milliseconds per character - faster typing

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

// Copy message content to clipboard
async function copyMessage() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    console.log('[ChatMessage] Message copied to clipboard')
    // Could add a toast notification here
  } catch (error) {
    console.error('[ChatMessage] Failed to copy message:', error)
    // Fallback: try using older method
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

// Format content with Markdown support
const formattedContent = computed(() => {
  // Use displayedContent for typewriter effect
  const contentToFormat = displayedContent.value || props.message.content || ''

  if (!contentToFormat) return ''

  try {
    // Parse markdown to HTML
    const html = marked.parse(contentToFormat)

    // Add target="_blank" to all links for safety
    return html.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')
  } catch (error) {
    console.error('[ChatMessage] Markdown parsing error:', error)
    // Fallback to escaped text with line breaks
    const div = document.createElement('div')
    div.textContent = contentToFormat
    return div.innerHTML.replace(/\n/g, '<br>')
  }
})
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

.message-content {
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.7;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.9375rem;
  text-align: left;
}

/* Markdown styles */
.message-content :deep(strong) {
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.message-content :deep(em) {
  font-style: italic;
}

.message-content :deep(h1),
.message-content :deep(h2),
.message-content :deep(h3) {
  font-weight: 600;
  margin-top: 16px;
  margin-bottom: 8px;
  line-height: 1.3;
}

.message-content :deep(h1) {
  font-size: 1.5rem;
}

.message-content :deep(h2) {
  font-size: 1.25rem;
}

.message-content :deep(h3) {
  font-size: 1.125rem;
}

.message-content :deep(ul),
.message-content :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.message-content :deep(li) {
  margin: 4px 0;
  line-height: 1.6;
}

.message-content :deep(p) {
  margin: 8px 0;
}

.message-content :deep(p:first-child) {
  margin-top: 0;
}

.message-content :deep(p:last-child) {
  margin-bottom: 0;
}

.message-content :deep(code) {
  background: rgba(var(--v-theme-on-surface), 0.08);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
}

.message-content :deep(pre) {
  background: rgba(var(--v-theme-on-surface), 0.05);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 12px 0;
}

.message-content :deep(pre code) {
  background: none;
  padding: 0;
}

.message-content :deep(a) {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: opacity 0.2s;
  font-weight: 500;
}

.message-content :deep(a:hover) {
  opacity: 0.8;
  text-decoration: underline;
}

.message-content :deep(blockquote) {
  border-left: 3px solid rgba(var(--v-theme-on-surface), 0.2);
  padding-left: 12px;
  margin: 12px 0;
  color: rgba(var(--v-theme-on-surface), 0.7);
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

/* Tools Panel */
.tools-panel {
  margin-top: 12px;
  padding: 10px 12px;
  background: rgba(var(--v-theme-primary), 0.04);
  border-left: 3px solid rgb(var(--v-theme-primary));
  border-radius: 6px;
}

.tools-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.tools-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tools-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tool-chip {
  font-size: 0.75rem;
  font-weight: 500;
}

/* Tool Tooltip */
.tool-tooltip {
  padding: 8px;
  max-width: 300px;
}

.tool-tooltip-name {
  font-weight: 600;
  margin-bottom: 4px;
  color: rgb(var(--v-theme-primary));
}

.tool-tooltip-duration {
  font-size: 0.75rem;
  margin-bottom: 6px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.tool-tooltip-params {
  font-size: 0.7rem;
  margin-top: 6px;
}

.tool-tooltip-params pre {
  background: rgba(var(--v-theme-on-surface), 0.05);
  padding: 6px;
  border-radius: 4px;
  margin-top: 4px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.65rem;
  max-height: 200px;
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
