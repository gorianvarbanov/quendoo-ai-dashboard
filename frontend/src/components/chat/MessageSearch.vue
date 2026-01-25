<template>
  <transition name="search-slide">
    <div v-if="isOpen" class="message-search-bar">
      <div class="search-container">
        <v-text-field
          ref="searchInputRef"
          :model-value="searchQuery"
          @update:model-value="updateSearchQuery"
          placeholder="Search in conversation..."
          variant="outlined"
          density="compact"
          hide-details
          clearable
          prepend-inner-icon="mdi-magnify"
          class="search-input"
          @keydown.enter.prevent="onEnter"
          @keydown.escape="close"
        >
          <template v-slot:append-inner>
            <div v-if="searchResults.length > 0" class="search-counter">
              {{ currentResultIndex + 1 }} / {{ searchResults.length }}
            </div>
          </template>
        </v-text-field>

        <div class="search-actions">
          <v-btn
            icon
            variant="text"
            size="small"
            @click="previousResult"
            :disabled="searchResults.length === 0"
            title="Previous (Shift+Enter)"
          >
            <v-icon size="18">mdi-chevron-up</v-icon>
          </v-btn>
          <v-btn
            icon
            variant="text"
            size="small"
            @click="nextResult"
            :disabled="searchResults.length === 0"
            title="Next (Enter)"
          >
            <v-icon size="18">mdi-chevron-down</v-icon>
          </v-btn>
          <v-btn
            icon
            variant="text"
            size="small"
            @click="close"
            title="Close (Esc)"
          >
            <v-icon size="18">mdi-close</v-icon>
          </v-btn>
        </div>
      </div>

      <!-- Search results preview -->
      <div v-if="currentResult" class="search-preview">
        <div class="preview-content">
          <span class="preview-role">{{ currentResult.message.role === 'user' ? 'You' : 'Quendoo AI' }}</span>
          <span class="preview-text">{{ currentResult.preview }}</span>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  searchQuery: {
    type: String,
    default: ''
  },
  searchResults: {
    type: Array,
    default: () => []
  },
  currentResultIndex: {
    type: Number,
    default: -1
  },
  currentResult: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:searchQuery', 'next', 'previous', 'close', 'jump-to'])

const searchInputRef = ref(null)

// Update search query (emit to parent)
const updateSearchQuery = (value) => {
  emit('update:searchQuery', value)
}

// Watch isOpen to focus input
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    searchInputRef.value?.focus()
  }
})

const onEnter = (event) => {
  if (event.shiftKey) {
    emit('previous')
  } else {
    emit('next')
  }
}

const nextResult = () => {
  emit('next')
}

const previousResult = () => {
  emit('previous')
}

const close = () => {
  emit('close')
}
</script>

<style scoped>
.message-search-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  padding: 12px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.search-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  flex: 1;
}

.search-counter {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  padding: 0 8px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-radius: 4px;
  font-family: monospace;
}

.search-actions {
  display: flex;
  gap: 4px;
}

.search-preview {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(var(--v-theme-primary), 0.05);
  border-radius: 6px;
  border-left: 3px solid rgb(var(--v-theme-primary));
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-role {
  font-size: 0.7rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preview-text {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.8);
  line-height: 1.4;
}

/* Transitions */
.search-slide-enter-active,
.search-slide-leave-active {
  transition: all 0.3s ease;
}

.search-slide-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.search-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
