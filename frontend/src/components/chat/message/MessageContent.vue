<template>
  <div class="message-content">
    <span v-html="formattedContent"></span>
    <span v-if="isTyping" class="typing-cursor">|</span>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { marked } from 'marked'

// Configure marked for better rendering
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true, // GitHub Flavored Markdown
  headerIds: false,
  mangle: false
})

const props = defineProps({
  content: {
    type: String,
    required: true
  },
  isUser: {
    type: Boolean,
    default: false
  },
  isStreaming: {
    type: Boolean,
    default: false
  },
  shouldAnimate: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['typing'])

// Typewriter effect state
const displayedContent = ref('')
const isTyping = ref(false)

onMounted(() => {
  if (!props.isUser && props.content && !props.isStreaming && props.shouldAnimate) {
    startTypewriterEffect()
  } else {
    displayedContent.value = props.content
  }
})

// Watch for content changes (streaming)
watch(() => props.content, (newContent) => {
  if (props.isStreaming || !props.shouldAnimate) {
    displayedContent.value = newContent
  }
})

function startTypewriterEffect() {
  isTyping.value = true
  displayedContent.value = ''
  const fullContent = props.content
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

// Format content with Markdown support
const formattedContent = computed(() => {
  let contentToFormat = displayedContent.value || props.content || ''

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
    console.error('[MessageContent] Markdown parsing error:', error)
    // Fallback to escaped text with line breaks
    const div = document.createElement('div')
    div.textContent = contentToFormat
    return div.innerHTML.replace(/\n/g, '<br>')
  }
})
</script>

<style scoped>
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
</style>
