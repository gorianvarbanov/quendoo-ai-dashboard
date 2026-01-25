<template>
  <div class="skeleton-loader" :class="{ 'skeleton-pulse': animate }">
    <!-- Message Skeleton -->
    <div v-if="type === 'message'" class="skeleton-message">
      <div class="skeleton-avatar"></div>
      <div class="skeleton-content">
        <div class="skeleton-header">
          <div class="skeleton-line" style="width: 80px; height: 12px;"></div>
          <div class="skeleton-line" style="width: 40px; height: 10px;"></div>
        </div>
        <div class="skeleton-text">
          <div class="skeleton-line" style="width: 100%; height: 14px;"></div>
          <div class="skeleton-line" style="width: 95%; height: 14px;"></div>
          <div class="skeleton-line" style="width: 85%; height: 14px;"></div>
        </div>
      </div>
    </div>

    <!-- Conversation Item Skeleton -->
    <div v-else-if="type === 'conversation'" class="skeleton-conversation">
      <div class="skeleton-line" style="width: 100%; height: 16px;"></div>
      <div class="skeleton-line" style="width: 60%; height: 12px; margin-top: 8px;"></div>
    </div>

    <!-- Card Skeleton -->
    <div v-else-if="type === 'card'" class="skeleton-card">
      <div class="skeleton-image"></div>
      <div class="skeleton-card-content">
        <div class="skeleton-line" style="width: 80%; height: 16px;"></div>
        <div class="skeleton-line" style="width: 100%; height: 12px; margin-top: 8px;"></div>
        <div class="skeleton-line" style="width: 90%; height: 12px; margin-top: 4px;"></div>
      </div>
    </div>

    <!-- Generic Rectangle -->
    <div
      v-else-if="type === 'rectangle'"
      class="skeleton-rectangle"
      :style="{ width, height, borderRadius }"
    ></div>

    <!-- Generic Circle -->
    <div
      v-else-if="type === 'circle'"
      class="skeleton-circle"
      :style="{ width: size, height: size }"
    ></div>

    <!-- Text Line -->
    <div
      v-else-if="type === 'text'"
      class="skeleton-line"
      :style="{ width, height: height || '14px' }"
    ></div>
  </div>
</template>

<script setup>
const props = defineProps({
  type: {
    type: String,
    default: 'text',
    validator: (value) => ['message', 'conversation', 'card', 'rectangle', 'circle', 'text'].includes(value)
  },
  width: {
    type: String,
    default: '100%'
  },
  height: {
    type: String,
    default: '20px'
  },
  size: {
    type: String,
    default: '40px'
  },
  borderRadius: {
    type: String,
    default: '8px'
  },
  animate: {
    type: Boolean,
    default: true
  }
})
</script>

<style scoped>
.skeleton-loader {
  position: relative;
  overflow: hidden;
}

.skeleton-pulse {
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Generic skeleton elements */
.skeleton-line,
.skeleton-rectangle,
.skeleton-circle,
.skeleton-image,
.skeleton-avatar {
  background: linear-gradient(
    90deg,
    rgba(var(--v-theme-on-surface), 0.08) 25%,
    rgba(var(--v-theme-on-surface), 0.12) 50%,
    rgba(var(--v-theme-on-surface), 0.08) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 2s infinite;
  border-radius: 4px;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.skeleton-circle {
  border-radius: 50%;
}

/* Message skeleton */
.skeleton-message {
  display: flex;
  gap: 12px;
  padding: 16px 0;
}

.skeleton-avatar {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-header {
  display: flex;
  gap: 12px;
  align-items: center;
}

.skeleton-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Conversation skeleton */
.skeleton-conversation {
  padding: 12px 16px;
}

/* Card skeleton */
.skeleton-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
  overflow: hidden;
}

.skeleton-image {
  width: 100%;
  height: 200px;
}

.skeleton-card-content {
  padding: 16px;
}
</style>
