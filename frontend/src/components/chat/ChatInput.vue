<template>
  <div class="chat-input-container">
    <div class="input-wrapper">
      <v-textarea
        v-model="inputMessage"
        :placeholder="placeholder"
        :disabled="disabled"
        rows="2"
        auto-grow
        max-rows="10"
        variant="outlined"
        hide-details
        @keydown.enter.exact.prevent="handleEnter"
        @keydown.enter.shift.exact="handleShiftEnter"
        class="message-input"
        density="comfortable"
      >
        <template v-slot:append-inner>
          <v-btn
            icon
            :disabled="!canSend"
            :loading="loading"
            color="primary"
            @click="handleSend"
            size="small"
            variant="flat"
          >
            <v-icon size="20">mdi-send</v-icon>
          </v-btn>
        </template>
      </v-textarea>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  placeholder: {
    type: String,
    default: 'Type your message...'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['send'])

const inputMessage = ref('')

const canSend = computed(() => {
  return inputMessage.value.trim().length > 0 && !props.disabled && !props.loading
})

function handleSend() {
  if (!canSend.value) return

  const message = inputMessage.value.trim()
  if (message) {
    emit('send', message)
    inputMessage.value = ''
  }
}

function handleEnter() {
  handleSend()
}

function handleShiftEnter() {
  // Allow default behavior (new line)
}
</script>

<style scoped>
.chat-input-container {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.input-wrapper {
  background: rgb(var(--v-theme-surface));
  border-radius: 16px;
  box-shadow: 0 0 0 1px rgba(var(--v-theme-on-surface), 0.12);
  transition: none !important;
}

.input-wrapper:focus-within {
  box-shadow: 0 0 0 2px rgb(var(--v-theme-primary));
}

.input-wrapper * {
  transition: none !important;
}

.message-input {
  background: transparent;
  transition: none !important;
}

.message-input :deep(*) {
  transition: none !important;
}

.message-input :deep(.v-field) {
  border-radius: 16px;
  box-shadow: none;
  padding: 12px 16px;
  transition: none !important;
}

.message-input :deep(.v-field__outline) {
  display: none;
}

.message-input :deep(.v-field__input) {
  font-size: 0.9375rem;
  padding: 4px 0;
  min-height: 48px;
  transition: none !important;
  animation: none !important;
  align-items: flex-start;
  display: flex;
}

.message-input :deep(textarea) {
  transition: none !important;
  animation: none !important;
  padding-top: 8px !important;
  padding-bottom: 8px !important;
  line-height: 1.6 !important;
  font-size: 0.9375rem !important;
  min-height: 48px !important;
}

.message-input :deep(textarea::placeholder) {
  transition: none !important;
  animation: none !important;
  opacity: 1 !important;
  position: relative;
  top: 0;
  left: 0;
  transform: none;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.message-input :deep(.v-field__input::placeholder) {
  transition: none !important;
  animation: none !important;
  opacity: 1 !important;
  position: relative;
  top: 0;
  left: 0;
  transform: none;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
</style>
