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
          {{ uiTranslations.newConversation }}
        </v-btn>
        <v-btn
          variant="text"
          prepend-icon="mdi-file-document-multiple"
          @click="goToDocuments"
          block
          class="mt-2"
        >
          Documents
        </v-btn>
      </div>

      <!-- Search Bar -->
      <div class="sidebar-search">
        <v-text-field
          v-model="searchQuery"
          :placeholder="uiTranslations.searchConversations"
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
          <span class="conversation-title">{{ currentConversation?.title || uiTranslations.newConversation }}</span>
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
        @open-availability="handleOpenAvailability"
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
          <!-- Hotel Registration Status -->
          <div class="setting-section">
            <h3 class="setting-label">
              <v-icon size="20" class="mr-2">mdi-hotel</v-icon>
              Hotel Registration
            </h3>

            <v-alert
              v-if="!isHotelRegistered"
              type="info"
              variant="tonal"
              class="mb-4"
            >
              <div class="text-subtitle-2 mb-2">Registration Required</div>
              <div class="text-body-2">
                To use the Quendoo AI chatbot, you need to register your hotel with your Quendoo API key.
              </div>
            </v-alert>

            <v-alert
              v-else
              type="success"
              variant="tonal"
              class="mb-4"
            >
              <div class="text-subtitle-2 mb-2">{{ uiTranslations.hotelRegistered }}</div>
              <div class="text-body-2">
                {{ uiTranslations.hotelRegisteredDesc }}
              </div>
            </v-alert>

            <div v-if="isHotelRegistered" class="hotel-info mb-4">
              <div class="info-row">
                <span class="info-label">{{ uiTranslations.hotelId }}:</span>
                <span class="info-value">{{ hotelId }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">{{ uiTranslations.hotelName }}:</span>
                <span class="info-value">{{ hotelName }}</span>
              </div>
            </div>

            <v-btn
              v-if="!isHotelRegistered"
              color="primary"
              block
              size="large"
              @click="goToRegistration"
              prepend-icon="mdi-plus-circle"
            >
              Register Hotel
            </v-btn>

            <v-btn
              v-else
              color="error"
              variant="outlined"
              block
              size="large"
              @click="handleLogout"
              prepend-icon="mdi-logout"
            >
              {{ uiTranslations.logout }}
            </v-btn>

            <div v-if="!isHotelRegistered" class="info-text">
              <v-icon size="small" class="mr-1">mdi-information</v-icon>
              {{ uiTranslations.securityInfo }}
            </div>
          </div>

          <!-- AI Assistant Settings (only show if hotel is registered) -->
          <div v-if="isHotelRegistered" class="setting-section">
            <v-divider class="my-6" />

            <h3 class="setting-label">
              <v-icon size="20" class="mr-2">mdi-robot</v-icon>
              {{ uiTranslations.aiAssistantSettings }}
            </h3>

            <v-select
              v-model="language"
              :items="languages"
              item-title="label"
              item-value="value"
              :label="uiTranslations.responseLanguage"
              variant="outlined"
              density="comfortable"
              class="mb-4"
              prepend-inner-icon="mdi-translate"
              :hint="uiTranslations.languageHint"
              persistent-hint
            />

            <v-textarea
              v-model="customPrompt"
              :label="uiTranslations.customInstructions"
              variant="outlined"
              rows="4"
              class="mb-4"
              prepend-inner-icon="mdi-text"
              :hint="uiTranslations.customInstructionsHint"
              persistent-hint
              counter="2000"
              :rules="[v => !v || v.length <= 2000 || 'Must be at most 2000 characters']"
            />

            <v-alert
              v-if="settingsSaved"
              type="success"
              variant="tonal"
              density="compact"
              class="mb-4"
            >
              {{ uiTranslations.settingsSaved }}
            </v-alert>

            <v-alert
              v-if="settingsError"
              type="error"
              variant="tonal"
              density="compact"
              class="mb-4"
            >
              {{ settingsError }}
            </v-alert>

            <v-btn
              color="primary"
              block
              size="large"
              @click="saveSettings"
              :loading="savingSettings"
              :disabled="!settingsChanged"
              prepend-icon="mdi-content-save"
            >
              {{ uiTranslations.saveSettings }}
            </v-btn>
          </div>
        </div>
      </div>
    </v-navigation-drawer>

    <!-- Availability Panel -->
    <AvailabilityPanel
      v-model="availabilityPanelOpen"
      :raw-data="availabilityData"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import { useChatStore } from '@/stores/chatStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { chatApi } from '@/services/api'
import axios from 'axios'
import { t } from '@/i18n/translations'
import MessageList from './MessageList.vue'
import ChatInput from './ChatInput.vue'
import AvailabilityPanel from './AvailabilityPanel.vue'

const router = useRouter()
const theme = useTheme()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()


// Local state
const sidebarOpen = ref(window.innerWidth > 1024)

// Settings drawer state
const settingsDrawer = ref(false)

// Hotel registration state
const hotelToken = ref(localStorage.getItem('hotelToken'))
const hotelId = ref(localStorage.getItem('hotelId'))
const hotelName = ref(localStorage.getItem('hotelName'))

// Availability panel state
const availabilityPanelOpen = ref(false)
const availabilityData = ref(null)

// AI Assistant Settings state
const language = ref('en')
const customPrompt = ref('')
const originalLanguage = ref('en')
const originalCustomPrompt = ref('')
const savingSettings = ref(false)
const settingsSaved = ref(false)
const settingsError = ref(null)

// Language options
const languages = [
  { label: 'English', value: 'en' },
  { label: 'Български', value: 'bg' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Français', value: 'fr' },
  { label: 'Español', value: 'es' },
  { label: 'Italiano', value: 'it' },
  { label: 'Русский', value: 'ru' },
  { label: 'Македонски', value: 'mk' },
  { label: 'Română', value: 'ro' }
]

// Computed translations based on selected language
const uiTranslations = computed(() => {
  const lang = language.value || 'en'
  return {
    hotelRegistration: t('hotelRegistration', lang),
    hotelRegistered: t('hotelRegistered', lang),
    hotelRegisteredDesc: t('hotelRegisteredDesc', lang),
    hotelId: t('hotelId', lang),
    hotelName: t('hotelName', lang),
    logout: t('logout', lang),
    securityInfo: t('securityInfo', lang),
    aiAssistantSettings: t('aiAssistantSettings', lang),
    responseLanguage: t('responseLanguage', lang),
    languageHint: t('languageHint', lang),
    customInstructions: t('customInstructions', lang),
    customInstructionsHint: t('customInstructionsHint', lang),
    saveSettings: t('saveSettings', lang),
    settingsSaved: t('settingsSaved', lang),
    newConversation: t('newConversation', lang),
    settings: t('settings', lang),
    searchConversations: t('searchConversations', lang),
    noMessagesYet: t('noMessagesYet', lang),
    startConversation: t('startConversation', lang),
    typeMessage: t('typeMessage', lang),
    noConversationsFound: t('noConversationsFound', lang),
    tryDifferentSearch: t('tryDifferentSearch', lang),
    searchResults: t('searchResults', lang)
  }
})

// Computed
const isHotelRegistered = computed(() => {
  return !!hotelToken.value && !!hotelId.value
})

const settingsChanged = computed(() => {
  return language.value !== originalLanguage.value ||
         customPrompt.value !== originalCustomPrompt.value
})

// Navigation
const goToRegistration = () => {
  router.push('/register')
}

const goToDocuments = () => {
  router.push('/documents')
}

const goToSettings = () => {
  settingsDrawer.value = true
}

const handleLogout = () => {
  // Clear hotel authentication data
  localStorage.removeItem('hotelToken')
  localStorage.removeItem('hotelId')
  localStorage.removeItem('hotelName')
  localStorage.removeItem('hotelEmail')

  console.log('[ChatContainer] Hotel logged out, redirecting to login')

  // Redirect to login page
  router.push('/login')
}

// Search state
const searchQuery = ref('')
const searchResults = ref([])
const searching = ref(false)
let searchTimeout = null

// Model mapping - display names to API model IDs
const modelMap = {
  'Claude 4 Sonnet': 'claude-sonnet-4-20250514',
  'Claude Sonnet 3.5': 'claude-3-5-sonnet-20241022',
  'Claude Opus 3': 'claude-3-opus-20240229'
}

const models = ref(Object.keys(modelMap))
const selectedModel = ref('Claude 4 Sonnet')

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
    .filter(conv => {
      // Show only conversations with messages or with a custom title
      return (conv.messageCount && conv.messageCount > 0) ||
             (conv.title && conv.title !== 'New Conversation')
    })
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

// Availability panel handler
function handleOpenAvailability(data) {
  console.log('[ChatContainer] Opening availability panel with data:', data)
  availabilityData.value = data
  availabilityPanelOpen.value = true
}

// Load hotel settings from backend
async function loadHotelSettings() {
  if (!isHotelRegistered.value) return

  try {
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
    const response = await axios.get(`${backendUrl}/api/hotels/me`, {
      headers: {
        'Authorization': `Bearer ${hotelToken.value}`
      }
    })

    if (response.data.success) {
      const hotelData = response.data.hotel
      language.value = hotelData.language || 'en'
      customPrompt.value = hotelData.customPrompt || ''
      originalLanguage.value = language.value
      originalCustomPrompt.value = customPrompt.value
      console.log('[ChatContainer] Hotel settings loaded:', { language: language.value, hasCustomPrompt: !!customPrompt.value })
    }
  } catch (error) {
    console.error('[ChatContainer] Failed to load hotel settings:', error)
  }
}

// Save hotel settings to backend
async function saveSettings() {
  if (!isHotelRegistered.value) return

  savingSettings.value = true
  settingsSaved.value = false
  settingsError.value = null

  try {
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
    const fullUrl = `${backendUrl}/api/hotels/settings`
    console.log('[ChatContainer] Saving settings to URL:', fullUrl)
    console.log('[ChatContainer] VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL)

    const response = await axios.patch(
      fullUrl,
      {
        language: language.value,
        customPrompt: customPrompt.value
      },
      {
        headers: {
          'Authorization': `Bearer ${hotelToken.value}`
        }
      }
    )

    if (response.data.success) {
      originalLanguage.value = language.value
      originalCustomPrompt.value = customPrompt.value
      settingsSaved.value = true
      console.log('[ChatContainer] Settings saved successfully')

      // Hide success message after 3 seconds
      setTimeout(() => {
        settingsSaved.value = false
      }, 3000)
    } else {
      settingsError.value = response.data.error || 'Failed to save settings'
    }
  } catch (error) {
    console.error('[ChatContainer] Failed to save settings:', error)
    console.error('[ChatContainer] Error response:', error.response)
    console.error('[ChatContainer] Error data:', error.response?.data)
    settingsError.value = error.response?.data?.error || error.message || 'Failed to save settings. Please try again.'
  } finally {
    savingSettings.value = false
  }
}

// Load settings when component mounts and hotel is registered
watch(isHotelRegistered, (registered) => {
  if (registered) {
    loadHotelSettings()
  }
}, { immediate: true })

// Also load settings when settings drawer opens
watch(settingsDrawer, (isOpen) => {
  if (isOpen && isHotelRegistered.value) {
    loadHotelSettings()
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

.hotel-info {
  background: rgba(var(--v-theme-on-surface), 0.03);
  border-radius: 8px;
  padding: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.05);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 0.875rem;
}

.info-value {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-on-surface));
}

.info-text {
  margin-top: 12px;
  padding: 12px;
  background: rgba(var(--v-theme-on-surface), 0.03);
  border-radius: 8px;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.4;
}
</style>
