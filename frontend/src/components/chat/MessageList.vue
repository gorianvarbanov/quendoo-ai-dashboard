<template>
  <v-sheet class="message-list" ref="messageListRef">
    <div v-if="messages.length === 0" class="empty-state">
      <div class="empty-icon">
        <v-icon icon="mdi-chat-outline" size="48" color="grey-lighten-1" />
      </div>
      <h2 class="empty-title">No messages yet</h2>
      <p class="empty-subtitle">Start a conversation by typing a message below</p>
    </div>

    <div v-else class="messages-container">
      <ChatMessage
        v-for="message in messages"
        :key="message.id"
        :message="message"
        :is-streaming="message.isStreaming || false"
        @typing="scrollToBottom"
      />

      <!-- AI is thinking indicator (shown before first tool starts) -->
      <div v-if="isLoading && !hasAnyMessages" class="loading-container">
        <QuendooLoadingIcon />
        <span class="loading-text">AI is thinking...</span>
      </div>
    </div>
  </v-sheet>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import ChatMessage from './ChatMessage.vue'
import QuendooLoadingIcon from '@/components/common/QuendooLoadingIcon.vue'

const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  isStreaming: {
    type: Boolean,
    default: false
  },
  streamingMessage: {
    type: String,
    default: ''
  }
})

const messageListRef = ref(null)

// Check if we have any messages (including streaming messages)
const hasAnyMessages = computed(() => {
  return props.messages.some(msg => msg.isStreaming || msg.role === 'assistant')
})

// Auto-scroll to bottom when new messages arrive, loading starts, or streaming changes
watch(
  () => [props.messages.length, props.streamingMessage, props.isLoading, props.isStreaming],
  async () => {
    await nextTick()
    scrollToBottom()
  },
  { flush: 'post' }
)

function scrollToBottom() {
  if (messageListRef.value) {
    const element = messageListRef.value.$el || messageListRef.value
    // Scroll so the latest message appears with about half viewport of empty space below
    const scrollOffset = element.clientHeight * 0.5
    const targetScroll = element.scrollHeight - scrollOffset

    element.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: 'smooth'
    })
  }
}
</script>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  scroll-behavior: smooth;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
  padding: 48px 32px;
}

.empty-icon {
  margin-bottom: 16px;
  opacity: 0.3;
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 8px;
  opacity: 0.7;
}

.empty-subtitle {
  font-size: 0.9375rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin: 0;
}

.messages-container {
  display: flex;
  flex-direction: column;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  padding: 32px 24px 24px;
  gap: 28px;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
}

.loading-text {
  font-size: 0.9375rem;
  color: rgb(var(--v-theme-on-surface));
  font-weight: 400;
}
</style>
