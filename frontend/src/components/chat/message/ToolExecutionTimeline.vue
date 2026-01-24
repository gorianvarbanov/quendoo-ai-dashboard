<template>
  <div>
    <!-- Loading state (streaming) -->
    <div v-if="isStreaming" class="tools-loading">
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
          :class="{ 'tool-running': tool.status === 'running', 'tool-completed': tool.status === 'completed' }"
        >
          <!-- Running spinner or completed checkmark -->
          <v-progress-circular
            v-if="tool.status === 'running'"
            indeterminate
            size="14"
            width="2"
            color="primary"
            class="tool-spinner"
          ></v-progress-circular>
          <v-icon v-else size="14" :color="getToolColor(tool.name)">
            mdi-{{ getToolIcon(tool.name) }}
          </v-icon>
          <span class="loading-tool-name">{{ tool.name }}</span>
          <v-icon v-if="tool.status === 'completed'" size="12" color="success" class="loading-tool-check">
            mdi-check-circle
          </v-icon>
          <span v-if="tool.duration && tool.status === 'completed'" class="tool-duration-small">
            {{ tool.duration }}ms
          </span>
        </div>
      </div>
    </div>

    <!-- Compact timeline accordion (completed, not hidden by scraper) -->
    <div v-else-if="toolsUsed && toolsUsed.length > 0 && !hideForScraper" class="tools-timeline-compact">
      <!-- Accordion Header -->
      <div class="timeline-accordion-header" @click="toggleAccordion">
        <v-icon
          size="16"
          color="primary"
          class="accordion-chevron"
          :class="{ 'accordion-open': isExpanded }"
        >
          mdi-chevron-right
        </v-icon>
        <span class="accordion-title">Tools Used ({{ toolsUsed.length }})</span>
        <v-icon size="14" color="primary" class="accordion-icon">mdi-wrench</v-icon>
      </div>

      <!-- Accordion Content -->
      <div v-show="isExpanded" class="timeline-compact-content">
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
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  toolsUsed: {
    type: Array,
    default: () => []
  },
  isStreaming: {
    type: Boolean,
    default: false
  },
  hideForScraper: {
    type: Boolean,
    default: false
  }
})

// Accordion state
const isExpanded = ref(false)

function toggleAccordion() {
  isExpanded.value = !isExpanded.value
}

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

// Copy tool code to clipboard
async function copyToolCode(tool) {
  try {
    const code = JSON.stringify(tool.params, null, 2)
    await navigator.clipboard.writeText(code)
    console.log('[ToolExecutionTimeline] Tool code copied to clipboard')
  } catch (error) {
    console.error('[ToolExecutionTimeline] Failed to copy tool code:', error)
  }
}
</script>

<style scoped>
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
  transition: background 0.3s;
}

.loading-tool-item.tool-running {
  background: rgba(var(--v-theme-primary), 0.08);
  border-left: 3px solid rgb(var(--v-theme-primary));
  padding-left: 7px;
}

.loading-tool-item.tool-completed {
  background: rgba(var(--v-theme-success), 0.05);
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

.tool-spinner {
  flex-shrink: 0;
}

.tool-duration-small {
  font-size: 0.65rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  font-family: 'Courier New', monospace;
  margin-left: auto;
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
</style>
