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

      <!-- Room Cards (Airbnb-style) -->
      <div v-if="hasRoomImages && !isUser && !isStreaming" class="room-cards-container">
        <div v-for="(room, roomIndex) in roomCards" :key="roomIndex" class="room-card">
          <!-- Room Gallery Grid -->
          <div
            class="room-gallery-grid"
            :class="{
              'single-image': room.images.length === 1,
              'two-images': room.images.length === 2,
              'multi-images': room.images.length >= 3
            }"
            @click="openRoomGallery"
          >
            <!-- Single image layout -->
            <div v-if="room.images.length === 1" class="room-gallery-item room-gallery-single">
              <img :src="room.images[0]" :alt="room.name" />
            </div>

            <!-- Two images layout -->
            <template v-else-if="room.images.length === 2">
              <div class="room-gallery-item room-gallery-half">
                <img :src="room.images[0]" :alt="room.name" />
              </div>
              <div class="room-gallery-item room-gallery-half">
                <img :src="room.images[1]" :alt="room.name" />
              </div>
            </template>

            <!-- Three or more images layout -->
            <template v-else>
              <!-- First image (larger) -->
              <div v-if="room.images[0]" class="room-gallery-item room-gallery-main">
                <img :src="room.images[0]" :alt="room.name" />
              </div>

              <!-- Additional images (smaller, stacked on right) -->
              <div class="room-gallery-side">
                <div v-if="room.images[1]" class="room-gallery-item room-gallery-small">
                  <img :src="room.images[1]" :alt="room.name" />
                </div>
                <div v-if="room.images[2]" class="room-gallery-item room-gallery-small room-gallery-more">
                  <img :src="room.images[2]" :alt="room.name" />
                  <div v-if="room.images.length > 3" class="room-gallery-overlay">
                    <v-icon size="24" color="white">mdi-image-multiple</v-icon>
                    <span class="room-overlay-text">+{{ room.images.length - 3 }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Room Info -->
          <div class="room-info">
            <h3 class="room-name">{{ room.name }}</h3>
            <p v-if="room.description" class="room-description">{{ room.description }}</p>
            <ul v-if="room.details.length > 0" class="room-details">
              <li v-for="(detail, detailIndex) in room.details.slice(0, 3)" :key="detailIndex">
                {{ detail }}
              </li>
              <li v-if="room.details.length > 3" class="room-more-details">
                +{{ room.details.length - 3 }} more details
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Message content (hidden when room cards are shown) -->
      <div v-if="!hasRoomImages || isUser" class="message-content">
        <span v-html="formattedContent"></span>
        <span v-if="isTyping" class="typing-cursor">|</span>
      </div>

      <!-- Tool Execution Loading (shown while streaming) -->
      <div v-if="!isUser && isStreaming" class="tools-loading">
        <div class="loading-header">
          <v-progress-circular
            indeterminate
            size="20"
            width="3"
            color="primary"
            class="loading-spinner"
          ></v-progress-circular>
          <span class="loading-title">Executing tools...</span>
        </div>
        <div v-if="toolsUsed && toolsUsed.length > 0" class="loading-tools-list">
          <div
            v-for="(tool, index) in toolsUsed"
            :key="index"
            class="loading-tool-item"
          >
            <v-icon size="14" :color="getToolColor(tool.name)">
              mdi-{{ getToolIcon(tool.name) }}
            </v-icon>
            <span class="loading-tool-name">{{ tool.name }}</span>
            <v-icon size="12" color="success" class="loading-tool-check">
              mdi-check-circle
            </v-icon>
          </div>
        </div>
      </div>

      <!-- Tools Used Timeline (shown for AI messages that used tools) -->
      <div v-if="!isUser && toolsUsed && toolsUsed.length > 0 && !isStreaming" class="tools-timeline-compact">
        <!-- Accordion Header -->
        <div class="timeline-accordion-header" @click="toggleToolsAccordion">
          <v-icon
            size="16"
            color="primary"
            class="accordion-chevron"
            :class="{ 'accordion-open': toolsExpanded }"
          >
            mdi-chevron-right
          </v-icon>
          <span class="accordion-title">Tools Used ({{ toolsUsed.length }})</span>
          <v-icon size="14" color="primary" class="accordion-icon">mdi-wrench</v-icon>
        </div>

        <!-- Accordion Content -->
        <div v-show="toolsExpanded" class="timeline-compact-content">
          <div
            v-for="(tool, index) in toolsUsed"
            :key="index"
            class="timeline-tool-block"
          >
            <!-- Tool Header with Badge and Duration -->
            <div class="tool-block-header">
              <div class="tool-block-badge">
                <span class="tool-block-number">{{ index + 1 }}</span>
                <v-icon size="16" :color="getToolColor(tool.name)">
                  mdi-{{ getToolIcon(tool.name) }}
                </v-icon>
                <span class="tool-block-name">{{ tool.name }}</span>
              </div>
              <span v-if="tool.duration" class="tool-block-duration">{{ tool.duration }}ms</span>
            </div>

            <!-- Tool Request Code -->
            <div v-if="tool.params" class="tool-block-body">
              <div class="tool-request-label">REQUEST</div>
              <pre class="tool-request-code">{{ JSON.stringify(tool.params, null, 2) }}</pre>
              <v-btn
                size="x-small"
                variant="text"
                icon
                class="tool-copy-btn"
                @click="copyToolCode(tool)"
                title="Copy request"
              >
                <v-icon size="14">mdi-content-copy</v-icon>
              </v-btn>
            </div>
          </div>
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

    <!-- Room Gallery Component -->
    <RoomGallery
      v-model="roomGalleryOpen"
      :title="'Room Photos'"
      :images="roomImages"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { format } from 'date-fns'
import { marked } from 'marked'
import TableViewer from '@/components/common/TableViewer.vue'
import RoomGallery from '@/components/chat/RoomGallery.vue'

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
  console.log('[ChatMessage] toolsUsed data:', props.message.toolsUsed)

  if (!props.message.toolsUsed) return []

  // If toolsUsed is already an array of tool objects
  if (Array.isArray(props.message.toolsUsed)) {
    console.log('[ChatMessage] Returning tools array:', props.message.toolsUsed)
    return props.message.toolsUsed
  }

  // If toolsUsed is true/false, try to extract from content or other metadata
  console.log('[ChatMessage] toolsUsed is not an array, returning empty')
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
    'ack_booking': 'check-circle',
    'post_room_assignment': 'door-open',
    'default': 'wrench'
  }

  return iconMap[toolName] || iconMap.default
}

// Get color for each tool type
function getToolColor(toolName) {
  const colorMap = {
    'get_availability': 'blue',
    'update_availability': 'indigo',
    'get_property_settings': 'grey',
    'get_rooms_details': 'purple',
    'get_bookings': 'teal',
    'get_booking_offers': 'orange',
    'make_call': 'green',
    'send_quendoo_email': 'red',
    'ack_booking': 'success',
    'post_room_assignment': 'cyan',
    'default': 'primary'
  }

  return colorMap[toolName] || colorMap.default
}

// Typewriter effect for AI messages
const displayedContent = ref('')
const isTyping = ref(false)

// Check if message should have typewriter effect (new AI messages only)
const shouldAnimate = ref(false)

// Tools accordion state
const toolsExpanded = ref(false)

function toggleToolsAccordion() {
  toolsExpanded.value = !toolsExpanded.value
}

// Copy tool code to clipboard
async function copyToolCode(tool) {
  try {
    const code = JSON.stringify(tool.params, null, 2)
    await navigator.clipboard.writeText(code)
    console.log('[ChatMessage] Tool code copied to clipboard')
  } catch (error) {
    console.error('[ChatMessage] Failed to copy tool code:', error)
  }
}

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

// Room gallery state
const roomGalleryOpen = ref(false)

// Detect and extract room data (grouped by room)
const roomCards = computed(() => {
  if (!props.message.content) return []

  const content = props.message.content
  const lines = content.split('\n')
  const rooms = []

  // Pattern to match booking.quendoo.com image URLs
  const imageUrlPattern = /https:\/\/booking\.quendoo\.com\/files\/[^\s)]+\.(jpg|jpeg|png|gif|webp)/gi

  let currentRoom = null
  let inRoomSection = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Detect numbered room headers (e.g., "1. Единична стая", "2. Двойна стая")
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/)

    // Detect bold text headers (e.g., "**Room Name**")
    const boldMatch = line.match(/^\*\*([^*]+)\*\*/)

    // Detect markdown headers (e.g., "## Room Name")
    const headerMatch = line.match(/^#{1,3}\s+(.+)$/)

    // Check if this is a room header
    if (numberedMatch || boldMatch || headerMatch) {
      let name = ''

      if (numberedMatch) {
        name = numberedMatch[2].trim()
      } else if (boldMatch) {
        name = boldMatch[1].trim()
      } else if (headerMatch) {
        name = headerMatch[1].trim()
      }

      // Skip generic section headers
      if (!name.match(/^(Room Types?|Available Rooms?|Налични|типове стаи|стаи)$/i)) {
        // Save previous room if exists and has images
        if (currentRoom && currentRoom.images.length > 0) {
          rooms.push(currentRoom)
        }

        // Start new room
        inRoomSection = true
        currentRoom = {
          name: name,
          images: [],
          description: '',
          details: []
        }
      }
    }

    // Extract image URLs from current line
    const urlsInLine = line.match(imageUrlPattern) || []
    if (urlsInLine.length > 0 && currentRoom) {
      urlsInLine.forEach(url => {
        currentRoom.images.push(url)
      })
    }

    // Extract details (lines starting with ○, -, •, or *)
    if (currentRoom && line.match(/^[○\-•*]\s+(.+)$/)) {
      const detail = line.replace(/^[○\-•*]\s+/, '').trim()
      // Remove ":" and everything after it for cleaner details
      let cleanDetail = detail.split(':')[0].trim()
      // Remove markdown bold syntax (**text**)
      cleanDetail = cleanDetail.replace(/\*\*(.+?)\*\*/g, '$1')
      if (!cleanDetail.includes('http') && cleanDetail.length > 0) {
        currentRoom.details.push(cleanDetail)
      }
    }

    // Extract description (plain text after room name, before bullets)
    if (currentRoom && !line.match(/^[\d\-•*#○]/) && line.length > 0 && !line.includes('http') && !boldMatch && !headerMatch && !numberedMatch) {
      if (currentRoom.description.length === 0) {
        currentRoom.description = line
      }
    }
  }

  // Save last room
  if (currentRoom && currentRoom.images.length > 0) {
    rooms.push(currentRoom)
  }

  return rooms
})

const hasRoomImages = computed(() => roomCards.value.length > 0)

// Flatten all images for carousel
const roomImages = computed(() => {
  const allImages = []
  roomCards.value.forEach(room => {
    room.images.forEach(url => {
      allImages.push({
        url,
        roomName: room.name,
        description: room.description
      })
    })
  })
  return allImages
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

function openRoomGallery() {
  roomGalleryOpen.value = true
  console.log('[ChatMessage] Opening room gallery with images:', roomImages.value)
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
  let contentToFormat = displayedContent.value || props.message.content || ''

  if (!contentToFormat) return ''

  // Remove booking.quendoo.com image URLs from text (they're shown in room cards)
  const imageUrlPattern = /https:\/\/booking\.quendoo\.com\/files\/[^\s)]+\.(jpg|jpeg|png|gif|webp)/gi
  contentToFormat = contentToFormat.replace(imageUrlPattern, '').trim()

  // Remove empty lines left after URL removal
  contentToFormat = contentToFormat.replace(/\n\s*\n\s*\n/g, '\n\n')

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
  line-height: 1.6;
  color: rgb(var(--v-theme-on-surface));
  font-size: 16px;
  text-align: left;
  letter-spacing: -0.01em;
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
  margin: 0;
  padding-left: 16px;
}

.message-content :deep(li) {
  margin: 0;
  line-height: 1.2;
  padding: 0;
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

/* Tool Execution Loading Skeleton */
.tools-loading {
  margin-top: 16px;
  padding: 14px 16px;
  background: rgba(var(--v-theme-primary), 0.03);
  border: 1px solid rgba(var(--v-theme-primary), 0.15);
  border-radius: 8px;
}

.loading-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.loading-spinner {
  flex-shrink: 0;
  animation: spin-pulse 1.5s ease-in-out infinite;
}

@keyframes spin-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.loading-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  letter-spacing: 0.3px;
}

.loading-tools-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.loading-tool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(var(--v-theme-surface), 0.8);
  border-radius: 6px;
  animation: slideInLeft 0.3s ease forwards;
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.loading-tool-name {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface));
  flex: 1;
}

.loading-tool-check {
  animation: checkmark-pop 0.4s ease;
}

@keyframes checkmark-pop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.loading-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-step {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.skeleton-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.15);
  flex-shrink: 0;
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 12px;
  background: rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 6px;
  width: 60%;
}

.skeleton-line-short {
  height: 10px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 5px;
  width: 40%;
}

.shimmer {
  background: linear-gradient(
    90deg,
    rgba(var(--v-theme-on-surface), 0.08) 0%,
    rgba(var(--v-theme-on-surface), 0.15) 50%,
    rgba(var(--v-theme-on-surface), 0.08) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Compact Tools Timeline */
.tools-timeline-compact {
  margin-top: 10px;
  margin-bottom: 4px;
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 8px;
  overflow: hidden;
}

/* Accordion Header */
.timeline-accordion-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(var(--v-theme-primary), 0.05);
  cursor: pointer;
  transition: background 0.2s;
  user-select: none;
}

.timeline-accordion-header:hover {
  background: rgba(var(--v-theme-primary), 0.08);
}

.accordion-chevron {
  transition: transform 0.3s ease;
}

.accordion-chevron.accordion-open {
  transform: rotate(90deg);
}

.accordion-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  flex: 1;
}

.accordion-icon {
  opacity: 0.7;
}

/* Accordion Content Area */
.timeline-compact-content {
  padding: 12px;
  background: rgba(var(--v-theme-surface), 1);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Individual Tool Block */
.timeline-tool-block {
  background: rgba(var(--v-theme-on-surface), 0.02);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 8px;
  overflow: hidden;
  animation: fadeInBlock 0.3s ease forwards;
}

@keyframes fadeInBlock {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Tool Block Header */
.tool-block-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(var(--v-theme-on-surface), 0.02);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}

.tool-block-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: rgba(var(--v-theme-primary), 0.08);
  border-radius: 20px;
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
}

.tool-block-number {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
}

.tool-block-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  font-family: 'Courier New', monospace;
}

.tool-block-duration {
  font-size: 0.7rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  background: rgba(var(--v-theme-on-surface), 0.05);
  padding: 3px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}

/* Tool Block Body (REQUEST section) */
.tool-block-body {
  padding: 12px;
  background: rgba(var(--v-theme-surface), 1);
  position: relative;
}

.tool-request-label {
  font-size: 0.65rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.tool-request-code {
  margin: 0;
  padding: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  line-height: 1.5;
  color: rgb(var(--v-theme-on-surface));
  overflow-x: auto;
  white-space: pre;
  tab-size: 2;
}

.tool-copy-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.tool-copy-btn:hover {
  opacity: 1;
}

/* Old compact item styles - keeping for backwards compatibility but not used */
.timeline-compact-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: rgba(var(--v-theme-surface), 0.5);
}

.timeline-compact-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(var(--v-theme-primary), 0.03);
  border-radius: 6px;
  opacity: 0;
  animation: fadeInItem 0.3s ease forwards;
  transition: background 0.2s;
}

.timeline-compact-item:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}

@keyframes fadeInItem {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.timeline-compact-number {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
  flex-shrink: 0;
}

.timeline-compact-icon {
  flex-shrink: 0;
}

.timeline-compact-name {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  flex: 1;
}

.timeline-compact-duration {
  font-size: 0.65rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  background: rgba(var(--v-theme-on-surface), 0.05);
  padding: 2px 6px;
  border-radius: 3px;
}

.timeline-compact-expand {
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s, transform 0.2s;
}

.timeline-compact-expand:hover {
  opacity: 1;
}

.timeline-params-card {
  max-height: 400px;
  overflow: auto;
}

.timeline-params-content {
  padding: 12px;
}

.timeline-params-content pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  color: rgb(var(--v-theme-on-surface));
  white-space: pre-wrap;
  word-break: break-word;
}

/* Old timeline styles (kept for backwards compatibility) */
.tools-timeline {
  margin-top: 16px;
  padding: 14px 16px;
  background: rgba(var(--v-theme-primary), 0.03);
  border: 1px solid rgba(var(--v-theme-primary), 0.15);
  border-radius: 8px;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.timeline-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  letter-spacing: 0.3px;
}

.timeline-count {
  font-size: 0.7rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin-left: auto;
  background: rgba(var(--v-theme-primary), 0.1);
  padding: 2px 8px;
  border-radius: 10px;
}

.timeline-steps {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-step {
  display: flex;
  gap: 12px;
  position: relative;
  opacity: 0;
  animation: slideInStep 0.4s ease forwards;
}

@keyframes slideInStep {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.timeline-step-multi {
  padding-bottom: 16px;
}

.timeline-badge {
  position: relative;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.timeline-badge-inner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(var(--v-theme-primary), 0.3);
}

.timeline-connector {
  position: absolute;
  left: 13px;
  top: 28px;
  width: 2px;
  height: calc(100% + 16px);
  background: linear-gradient(
    to bottom,
    rgba(var(--v-theme-primary), 0.4),
    rgba(var(--v-theme-primary), 0.15)
  );
  z-index: 1;
}

.timeline-content {
  flex: 1;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
  padding: 10px 12px;
  transition: all 0.2s;
}

.timeline-content:hover {
  border-color: rgba(var(--v-theme-primary), 0.3);
  box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.08);
}

.timeline-step-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-step-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.timeline-step-duration {
  margin-left: auto;
  font-size: 0.7rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  background: rgba(var(--v-theme-on-surface), 0.05);
  padding: 2px 8px;
  border-radius: 4px;
}

.timeline-step-params {
  margin-top: 8px;
}

.timeline-params-btn {
  font-size: 0.65rem;
  height: 20px;
  padding: 0 8px;
  text-transform: none;
  letter-spacing: 0;
}

/* Tool Tooltip */
.tool-tooltip-params {
  font-size: 0.7rem;
}

.tool-tooltip-params pre {
  background: rgba(var(--v-theme-on-surface), 0.05);
  padding: 8px;
  border-radius: 4px;
  margin-top: 4px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.65rem;
  max-height: 200px;
  color: rgb(var(--v-theme-on-surface));
}

.table-viewer-button {
  margin-top: 12px;
  margin-bottom: 4px;
}

/* Airbnb-style Room Cards */
.room-cards-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 20px;
  max-width: 100%;
}

.room-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 16px;
  overflow: hidden;
  transition: box-shadow 0.3s, transform 0.2s;
  background: rgb(var(--v-theme-surface));
}

.room-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

/* Room Gallery Grid */
.room-gallery-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 4px;
  cursor: pointer;
  position: relative;
  height: 200px;
}

/* Single image layout */
.room-gallery-grid.single-image {
  display: block;
  height: 220px;
  grid-template-columns: unset;
}

.room-gallery-single {
  width: 100%;
  height: 100%;
}

.room-gallery-single img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Two images layout */
.room-gallery-grid.two-images {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  height: 220px;
}

.room-gallery-half {
  width: 100%;
  height: 100%;
}

.room-gallery-half img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.room-gallery-side {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-gallery-item {
  position: relative;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.room-gallery-main {
  height: 100%;
}

.room-gallery-small {
  height: 50%;
}

.room-gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}

.room-gallery-grid:hover .room-gallery-item img {
  transform: scale(1.08);
}

.room-gallery-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  backdrop-filter: blur(3px);
}

.room-overlay-text {
  font-size: 0.9rem;
  font-weight: 600;
  margin-top: 4px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}

/* Room Info Section */
.room-info {
  padding: 12px 16px;
  text-align: center;
}

.room-name {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 6px 0;
  color: rgb(var(--v-theme-on-surface));
}

.room-description {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.room-details {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.room-details li {
  font-size: 0.85rem;
  color: rgba(var(--v-theme-on-surface), 0.8);
  padding-left: 0;
  position: relative;
}

.room-details li::before {
  content: "";
  display: none;
}

.room-more-details {
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
  cursor: pointer;
}

.room-more-details::before {
  content: "";
  display: none;
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
