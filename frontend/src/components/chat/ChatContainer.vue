<template>
  <div class="chat-layout">
    <!-- Sidebar -->
    <div class="sidebar" :class="{ 'sidebar-hidden': !sidebarOpen }">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <img src="@/assets/quendoo-logo.svg" alt="Quendoo AI" class="sidebar-logo-icon" />
          <span class="sidebar-title">Quendoo AI</span>
        </div>
        <v-btn
          icon
          variant="text"
          size="small"
          @click="sidebarOpen = false"
          class="sidebar-close"
        >
          <v-icon size="20">mdi-chevron-left</v-icon>
        </v-btn>
      </div>

      <div class="sidebar-actions">
        <v-btn
          variant="outlined"
          prepend-icon="mdi-plus"
          @click="handleNewConversation"
          block
          class="new-chat-btn"
        >
          New chat
        </v-btn>
      </div>

      <!-- Search Bar -->
      <div class="sidebar-search">
        <v-text-field
          v-model="searchQuery"
          placeholder="Search conversations..."
          variant="outlined"
          density="compact"
          hide-details
          clearable
          prepend-inner-icon="mdi-magnify"
          @update:model-value="handleSearch"
          class="search-input"
        >
          <template v-slot:append-inner>
            <v-progress-circular
              v-if="searching"
              indeterminate
              size="20"
              width="2"
            />
          </template>
        </v-text-field>
      </div>

      <div class="sidebar-content">
        <div class="conversations-list">
          <!-- Search Results -->
          <div v-if="searchQuery && searchResults.length > 0" class="conversations-section">
            <div class="section-header">
              <v-icon size="16" class="mr-1">mdi-magnify</v-icon>
              Search Results ({{ searchResults.length }})
            </div>
            <div
              v-for="conv in searchResults"
              :key="conv.id"
              class="conversation-item"
              :class="{ active: conv.id === currentConversation?.id }"
              @click="selectConversation(conv.id)"
            >
              <span class="conv-title">{{ conv.title }}</span>
            </div>
          </div>

          <!-- No Results -->
          <div v-else-if="searchQuery && searchResults.length === 0 && !searching" class="no-results">
            <v-icon size="48" color="grey-lighten-1">mdi-magnify</v-icon>
            <p>No conversations found</p>
            <p class="text-caption">Try a different search term</p>
          </div>

          <!-- Recent Conversations (shown when not searching) -->
          <div v-else-if="!searchQuery" class="conversations-section">
            <div
              v-for="conv in recentConversations"
              :key="conv.id"
              class="conversation-item"
              :class="{ active: conv.id === currentConversation?.id }"
              @click="selectConversation(conv.id)"
            >
              <span class="conv-title">{{ conv.title }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="sidebar-footer">
        <div class="footer-content">
          <v-select
            v-model="selectedModel"
            :items="models"
            variant="outlined"
            density="compact"
            hide-details
            class="model-selector-sidebar"
            prepend-inner-icon="mdi-brain"
          />
          <div class="footer-actions">
            <v-btn
              icon
              variant="text"
              size="small"
              @click="settingsDrawer = true"
              title="Settings"
            >
              <v-icon size="18">mdi-cog</v-icon>
            </v-btn>
            <v-btn
              icon
              variant="text"
              size="small"
              @click="theme.global.name.value = theme.global.name.value === 'light' ? 'dark' : 'light'"
              title="Toggle theme"
            >
              <v-icon size="18">{{ theme.global.name.value === 'light' ? 'mdi-weather-night' : 'mdi-weather-sunny' }}</v-icon>
            </v-btn>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Chat Area -->
    <div class="chat-main">
      <!-- Top Bar -->
      <div class="chat-topbar">
        <div class="topbar-content">
          <v-btn
            v-if="!sidebarOpen"
            icon
            variant="text"
            size="small"
            @click="sidebarOpen = true"
            class="menu-btn"
          >
            <v-icon size="20">mdi-menu</v-icon>
          </v-btn>
          <span class="conversation-title">{{ currentConversation?.title || 'New Conversation' }}</span>
        </div>
      </div>

      <!-- Error Alert -->
      <v-alert
        v-if="error"
        type="error"
        closable
        @click:close="clearError"
        class="error-alert"
        density="compact"
        variant="tonal"
      >
        {{ error }}
      </v-alert>

      <!-- Message List -->
      <MessageList
        :messages="currentMessages"
        :is-loading="isLoading"
        :is-streaming="isStreaming"
        :streaming-message="streamingMessage"
        class="message-list-area"
      />

      <!-- Chat Input - Fixed at bottom -->
      <div class="input-wrapper-fixed">
        <div class="input-container">
          <ChatInput
            :disabled="isLoading"
            :loading="isLoading"
            @send="handleSendMessage"
          />
        </div>
      </div>
    </div>

    <!-- Settings Drawer -->
    <v-navigation-drawer
      v-model="settingsDrawer"
      location="right"
      temporary
      width="400"
      class="settings-drawer"
    >
      <div class="settings-content">
        <div class="settings-header">
          <h2 class="settings-title">Settings</h2>
          <v-btn
            icon
            variant="text"
            size="small"
            @click="settingsDrawer = false"
          >
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>

        <v-divider class="mb-4" />

        <div class="settings-body">
          <!-- Anthropic API Key -->
          <div class="setting-section">
            <h3 class="setting-label">
              <v-icon size="20" class="mr-2">mdi-key</v-icon>
              Anthropic API Key
            </h3>
            <v-text-field
              v-model="anthropicApiKey"
              type="password"
              variant="outlined"
              density="comfortable"
              placeholder="sk-ant-..."
              hint="Your Anthropic API key for Claude"
              persistent-hint
              class="mb-4"
            />
          </div>

          <!-- Quendoo API Key -->
          <div class="setting-section">
            <h3 class="setting-label">
              <v-icon size="20" class="mr-2">mdi-hotel</v-icon>
              Quendoo API Key
            </h3>
            <v-text-field
              v-model="quendooApiKey"
              type="password"
              variant="outlined"
              density="comfortable"
              placeholder="Your Quendoo API key"
              hint="Your Quendoo PMS API key for hotel operations"
              persistent-hint
              class="mb-4"
            />
          </div>

          <!-- Save Button -->
          <v-btn
            color="primary"
            block
            size="large"
            @click="saveSettings"
            :loading="savingSettings"
          >
            Save Settings
          </v-btn>

          <!-- Success Message -->
          <v-alert
            v-if="settingsSaved"
            type="success"
            density="compact"
            class="mt-4"
            closable
            @click:close="settingsSaved = false"
          >
            Settings saved successfully!
          </v-alert>
        </div>
      </div>
    </v-navigation-drawer>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import { useChatStore } from '@/stores/chatStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { chatApi } from '@/services/api'
import MessageList from './MessageList.vue'
import ChatInput from './ChatInput.vue'

const router = useRouter()
const theme = useTheme()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

// Load saved conversations on mount
onMounted(() => {
  chatStore.loadFromStorage()
})

// Local state
const sidebarOpen = ref(window.innerWidth > 1024)

// Settings drawer state
const settingsDrawer = ref(false)
const anthropicApiKey = ref(settingsStore.anthropicApiKey)
const quendooApiKey = ref(settingsStore.quendooApiKey)
const savingSettings = ref(false)
const settingsSaved = ref(false)

// Save settings function
const saveSettings = async () => {
  savingSettings.value = true
  try {
    settingsStore.updateApiKey(anthropicApiKey.value)
    settingsStore.updateQuendooApiKey(quendooApiKey.value)
    settingsSaved.value = true
    setTimeout(() => {
      settingsSaved.value = false
    }, 3000)
  } catch (error) {
    console.error('[Settings] Failed to save:', error)
  } finally {
    savingSettings.value = false
  }
}

// Search state
const searchQuery = ref('')
const searchResults = ref([])
const searching = ref(false)
let searchTimeout = null

// Model mapping - display names to API model IDs
const modelMap = {
  'Claude Sonnet 3.5': 'claude-3-5-sonnet-20241022',
  'Claude Opus 3': 'claude-3-opus-20240229',
  'Claude Haiku 3.5': 'claude-3-5-haiku-20241022'
}

const models = ref(Object.keys(modelMap))
const selectedModel = ref('Claude Haiku 3.5')

// Watch for model changes and update store
watch(selectedModel, (newDisplayName) => {
  chatStore.selectedModel = modelMap[newDisplayName]
  console.log('[ChatContainer] Model changed to:', modelMap[newDisplayName])
})

// Computed properties
const currentMessages = computed(() => chatStore.currentMessages)
const currentConversation = computed(() => chatStore.currentConversation)
const isLoading = computed(() => chatStore.isLoading)
const isStreaming = computed(() => chatStore.isStreaming)
const streamingMessage = computed(() => chatStore.streamingMessage)
const error = computed(() => chatStore.error)

const recentConversations = computed(() => {
  return Array.from(chatStore.conversations.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20)
})

// Methods
function handleSendMessage(content) {
  chatStore.sendMessage(content)
}

async function handleNewConversation() {
  await chatStore.createConversation()
}

async function selectConversation(id) {
  await chatStore.setCurrentConversation(id)
}

function clearError() {
  chatStore.clearError()
}

// Search handler with debouncing
async function handleSearch(query) {
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  // If query is empty, clear results
  if (!query || query.trim() === '') {
    searchResults.value = []
    searching.value = false
    return
  }

  // Debounce search by 300ms
  searchTimeout = setTimeout(async () => {
    searching.value = true
    try {
      const response = await chatApi.searchConversations(query.trim(), 20)
      searchResults.value = response.conversations.map(conv => ({
        id: conv.id,
        title: conv.title || 'Conversation',
        createdAt: conv.createdAt?._seconds
          ? new Date(conv.createdAt._seconds * 1000).toISOString()
          : conv.createdAt,
        updatedAt: conv.updatedAt?._seconds
          ? new Date(conv.updatedAt._seconds * 1000).toISOString()
          : conv.updatedAt,
        messageCount: conv.messageCount || 0
      }))
    } catch (error) {
      console.error('[Search] Error searching conversations:', error)
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }, 300)
}

// Initialize with a conversation if none exists (after loading from storage)
onMounted(() => {
  // Only create a new conversation if there are no saved conversations
  if (chatStore.conversations.size === 0) {
    chatStore.createConversation()
  }
})
</script>

<style scoped>
.chat-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  background: rgb(var(--v-theme-surface));
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

/* Sidebar Styles */
.sidebar {
  width: 260px;
  background: rgb(var(--v-theme-surface));
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
  flex-shrink: 0;
  position: relative;
  left: 0;
}

.sidebar-hidden {
  transform: translateX(-260px);
  position: absolute;
  visibility: hidden;
}

.sidebar-header {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sidebar-logo-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.sidebar-title {
  font-size: 16px;
  font-weight: 600;
}

.sidebar-actions {
  padding: 16px;
}

.new-chat-btn {
  text-transform: none;
  font-weight: 500;
}

.sidebar-search {
  padding: 0 16px 12px 16px;
}

.search-input {
  font-size: 14px;
}

.section-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 4px;
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.no-results p {
  margin: 8px 0 0 0;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
}

/* Hide scrollbar for sidebar */
.sidebar-content::-webkit-scrollbar {
  width: 4px;
}

.sidebar-content::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-content::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 4px;
}

.sidebar-content::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface), 0.2);
}

.conversations-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.conversation-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  position: relative;
}

.conversation-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.conversation-item.active {
  background: rgba(var(--v-theme-on-surface), 0.1);
}

.conv-title {
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  color: rgb(var(--v-theme-on-surface));
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.footer-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.model-selector-sidebar {
  font-size: 0.875rem;
}

.model-selector-sidebar :deep(.v-field) {
  font-size: 0.875rem;
  font-weight: 500;
}

.model-selector-sidebar :deep(.v-field__input) {
  padding: 8px 12px;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Main Chat Area */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-topbar {
  padding: 12px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgb(var(--v-theme-surface));
}

.topbar-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.menu-btn {
  flex-shrink: 0;
}

.conversation-title {
  font-size: 0.9375rem;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  flex: 1;
}

.error-alert {
  margin: 12px auto;
  max-width: 800px;
  width: calc(100% - 48px);
}

.message-list-area {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  scroll-behavior: smooth;
  padding-bottom: 200px; /* More space for fixed input area */
}

.input-wrapper-fixed {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgb(var(--v-theme-surface));
  z-index: 10;
  padding: 32px 24px 32px; /* More vertical padding for breathing room */
}

.sidebar ~ .chat-main .input-wrapper-fixed {
  left: 260px;
}

.sidebar-hidden ~ .chat-main .input-wrapper-fixed {
  left: 0;
}

.input-wrapper-fixed {
  transition: left 0.3s ease;
}

.input-container {
  max-width: 800px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .sidebar {
    position: absolute;
    z-index: 100;
    height: 100%;
  }
}

/* Settings Drawer Styles */
.settings-drawer {
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
}

.settings-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.settings-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.settings-body {
  flex: 1;
  overflow-y: auto;
}

.setting-section {
  margin-bottom: 24px;
}

.setting-label {
  font-size: 0.95rem;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}
</style>
