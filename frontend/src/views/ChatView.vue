<template>
  <div class="chat-view">
    <ChatContainer />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import ChatContainer from '@/components/chat/ChatContainer.vue'
import { useChatStore } from '@/stores/chatStore'

const chatStore = useChatStore()

// Load conversations from database on mount
onMounted(async () => {
  await chatStore.loadFromDatabase()
})
</script>

<style scoped>
.chat-view {
  width: 100%;
  height: 100vh;
  padding: 0;
  margin: 0;
}
</style>
