<template>
  <div class="message-actions">
    <v-btn icon variant="text" size="x-small" title="Copy message" @click="$emit('copy')">
      <v-icon size="14">mdi-content-copy</v-icon>
    </v-btn>
    <v-btn icon variant="text" size="x-small" title="Good response" @click="$emit('like')">
      <v-icon size="14">mdi-thumb-up-outline</v-icon>
    </v-btn>
    <v-btn icon variant="text" size="x-small" title="Bad response" @click="$emit('dislike')">
      <v-icon size="14">mdi-thumb-down-outline</v-icon>
    </v-btn>
    <v-btn icon variant="text" size="x-small" title="Retry" @click="$emit('retry')">
      <v-icon size="14">mdi-refresh</v-icon>
    </v-btn>
  </div>
</template>

<script setup>
const props = defineProps({
  message: {
    type: Object,
    required: true
  }
})

defineEmits(['copy', 'like', 'dislike', 'retry'])
</script>

<style scoped>
.message-actions {
  display: flex;
  gap: 2px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

/* Parent hover will set opacity to 1 */
.message-container:hover .message-actions {
  opacity: 1;
}

.message-actions :deep(.v-btn) {
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.message-actions :deep(.v-btn:hover) {
  color: rgb(var(--v-theme-on-surface));
  background: rgba(var(--v-theme-on-surface), 0.05);
}
</style>
