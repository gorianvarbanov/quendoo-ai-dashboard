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
          {{ uiTranslations.documents }}
        </v-btn>

        <v-btn
          variant="text"
          prepend-icon="mdi-calendar-clock"
          @click="goToTasks"
          block
          class="mt-2"
        >
          {{ uiTranslations.tasks }}
        </v-btn>
      </div>

      <!-- Search Bar -->
      <div class="sidebar-search">
        <v-text-field
          ref="searchInputRef"
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
            <v-chip v-if="!searching" size="x-small" variant="outlined" class="mr-1">
              Ctrl+K
            </v-chip>
            <v-progress-circular
              v-if="searching"
              indeterminate
              size="20"
              width="2"
            />
          </template>
        </v-text-field>
      </div>

      <!-- Filter Chips -->
      <div v-if="!searchQuery" class="sidebar-filters">
        <v-chip-group
          v-model="activeFilter"
          selected-class="text-primary"
          mandatory
          class="filter-chips"
        >
          <v-chip value="all" size="small" variant="outlined">
            <v-icon start size="16">mdi-view-list</v-icon>
            All
          </v-chip>
          <v-chip value="favorites" size="small" variant="outlined">
            <v-icon start size="16">mdi-star</v-icon>
            Favorites
          </v-chip>
          <v-chip
            v-for="tag in allUsedTags"
            :key="tag"
            :value="tag"
            size="small"
            variant="outlined"
          >
            <v-icon
              start
              size="16"
              :color="predefinedTags.find(t => t.name === tag)?.color"
            >
              {{ predefinedTags.find(t => t.name === tag)?.icon || 'mdi-label' }}
            </v-icon>
            {{ tag }}
          </v-chip>
        </v-chip-group>
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
              class="conversation-item-wrapper"
            >
              <div
                class="conversation-item"
                :class="{ active: conv.id === currentConversation?.id }"
                @click="selectConversation(conv.id)"
              >
                <div class="conv-header">
                  <span class="conv-title">{{ conv.title }}</span>
                  <v-btn
                    icon
                    variant="text"
                    size="x-small"
                    @click.stop="toggleFavorite(conv.id)"
                    class="favorite-btn"
                  >
                    <v-icon size="16" :color="isFavorite(conv.id) ? 'warning' : 'grey'">
                      {{ isFavorite(conv.id) ? 'mdi-star' : 'mdi-star-outline' }}
                    </v-icon>
                  </v-btn>
                </div>

                <!-- Tags -->
                <div v-if="getTags(conv.id).length > 0" class="conv-tags">
                  <v-chip
                    v-for="tag in getTags(conv.id)"
                    :key="tag"
                    size="x-small"
                    :color="predefinedTags.find(t => t.name === tag)?.color"
                    variant="flat"
                  >
                    {{ tag }}
                  </v-chip>
                </div>
              </div>

              <!-- Conversation menu -->
              <v-menu location="bottom end">
                <template #activator="{ props }">
                  <v-btn
                    icon
                    variant="text"
                    size="x-small"
                    v-bind="props"
                    class="conversation-menu-btn"
                    @click.stop
                  >
                    <v-icon size="16">mdi-dots-vertical</v-icon>
                  </v-btn>
                </template>

                <v-list density="compact">
                  <!-- Tags submenu -->
                  <v-menu location="end" open-on-hover>
                    <template #activator="{ props }">
                      <v-list-item v-bind="props">
                        <template #prepend>
                          <v-icon size="18">mdi-label</v-icon>
                        </template>
                        <v-list-item-title>Manage Tags</v-list-item-title>
                        <template #append>
                          <v-icon size="18">mdi-chevron-right</v-icon>
                        </template>
                      </v-list-item>
                    </template>

                    <v-list density="compact">
                      <v-list-item
                        v-for="tag in predefinedTags"
                        :key="tag.name"
                        @click="toggleTag(conv.id, tag.name)"
                      >
                        <template #prepend>
                          <v-icon size="18" :color="tag.color">
                            {{ getTags(conv.id).includes(tag.name) ? 'mdi-check-circle' : tag.icon }}
                          </v-icon>
                        </template>
                        <v-list-item-title>{{ tag.name }}</v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-menu>

                  <v-divider class="my-1" />

                  <v-list-item @click="handleExport(conv, 'markdown')">
                    <template #prepend>
                      <v-icon size="18">mdi-language-markdown</v-icon>
                    </template>
                    <v-list-item-title>Export as Markdown</v-list-item-title>
                  </v-list-item>

                  <v-list-item @click="handleExport(conv, 'pdf')">
                    <template #prepend>
                      <v-icon size="18">mdi-file-pdf-box</v-icon>
                    </template>
                    <v-list-item-title>Export as PDF</v-list-item-title>
                  </v-list-item>

                  <v-list-item @click="handleExport(conv, 'json')">
                    <template #prepend>
                      <v-icon size="18">mdi-code-json</v-icon>
                    </template>
                    <v-list-item-title>Export as JSON</v-list-item-title>
                  </v-list-item>

                  <v-divider class="my-1" />

                  <v-list-item @click="handleDeleteConversation(conv.id)">
                    <template #prepend>
                      <v-icon size="18" color="error">mdi-delete</v-icon>
                    </template>
                    <v-list-item-title class="text-error">Delete</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
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
            <v-btn
              icon
              variant="text"
              size="small"
              @click="shortcutsHelpDialog = true"
              title="Keyboard Shortcuts (Ctrl+/)"
            >
              <v-icon size="18">mdi-keyboard</v-icon>
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

          <v-spacer />

          <!-- Export conversation menu -->
          <v-menu v-if="currentConversation && currentMessages.length > 0" location="bottom end">
            <template #activator="{ props }">
              <v-btn
                icon
                variant="text"
                size="small"
                v-bind="props"
                title="Export conversation"
              >
                <v-icon size="20">mdi-download</v-icon>
              </v-btn>
            </template>

            <v-list density="compact">
              <v-list-subheader>Export as</v-list-subheader>

              <v-list-item @click="handleExport(currentConversation, 'markdown')">
                <template #prepend>
                  <v-icon size="18">mdi-language-markdown</v-icon>
                </template>
                <v-list-item-title>Markdown (.md)</v-list-item-title>
              </v-list-item>

              <v-list-item @click="handleExport(currentConversation, 'pdf')">
                <template #prepend>
                  <v-icon size="18">mdi-file-pdf-box</v-icon>
                </template>
                <v-list-item-title>PDF (.pdf)</v-list-item-title>
              </v-list-item>

              <v-list-item @click="handleExport(currentConversation, 'json')">
                <template #prepend>
                  <v-icon size="18">mdi-code-json</v-icon>
                </template>
                <v-list-item-title>JSON (.json)</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
      </div>

      <!-- Error Alert with Action Buttons -->
      <v-alert
        v-if="error"
        type="error"
        closable
        @click:close="clearError"
        class="error-alert"
        density="comfortable"
        variant="tonal"
      >
        <div class="d-flex align-center justify-space-between">
          <div class="flex-grow-1">
            <div class="font-weight-bold mb-1">{{ error }}</div>
            <div v-if="errorSuggestion" class="text-caption text-medium-emphasis">
              {{ errorSuggestion }}
            </div>
          </div>

          <!-- Action buttons based on error type -->
          <div v-if="hasErrorActions" class="d-flex gap-2 ml-4 flex-shrink-0">
            <v-btn
              v-if="showNewConversationButton"
              size="small"
              variant="outlined"
              prepend-icon="mdi-plus"
              @click="handleNewConversationFromError"
            >
              Нов разговор
            </v-btn>
            <v-btn
              v-if="showRetryButton"
              size="small"
              variant="outlined"
              prepend-icon="mdi-refresh"
              @click="retryLastMessage"
            >
              Опитай отново
            </v-btn>
            <v-btn
              v-if="showClearHistoryButton"
              size="small"
              variant="outlined"
              prepend-icon="mdi-broom"
              @click="confirmClearHistory"
            >
              Изчисти история
            </v-btn>
          </div>
        </div>
      </v-alert>

      <!-- Message Search Bar -->
      <MessageSearch
        :is-open="messageSearchOpen"
        :search-query="messageSearchQuery"
        :search-results="messageSearchResults"
        :current-result-index="messageSearchCurrentIndex"
        :current-result="messageSearchCurrentResult"
        @update:search-query="messageSearchQuery = $event"
        @next="messageSearchNext"
        @previous="messageSearchPrevious"
        @close="messageSearchOpen = false; messageSearchClear()"
      />

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
            :conversation-id="currentConversation?.id"
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

    <!-- Keyboard Shortcuts Help Dialog -->
    <v-dialog v-model="shortcutsHelpDialog" max-width="500">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between">
          <span>Keyboard Shortcuts</span>
          <v-btn icon variant="text" size="small" @click="shortcutsHelpDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text>
          <v-list density="compact">
            <v-list-item>
              <template #prepend>
                <v-chip size="small" class="mr-2">Ctrl+N</v-chip>
              </template>
              <v-list-item-title>New conversation</v-list-item-title>
            </v-list-item>

            <v-list-item>
              <template #prepend>
                <v-chip size="small" class="mr-2">Ctrl+K</v-chip>
              </template>
              <v-list-item-title>Search conversations</v-list-item-title>
            </v-list-item>

            <v-list-item>
              <template #prepend>
                <v-chip size="small" class="mr-2">Escape</v-chip>
              </template>
              <v-list-item-title>Close dialogs</v-list-item-title>
            </v-list-item>

            <v-list-item>
              <template #prepend>
                <v-chip size="small" class="mr-2">Ctrl+F</v-chip>
              </template>
              <v-list-item-title>Search in conversation</v-list-item-title>
            </v-list-item>

            <v-list-item>
              <template #prepend>
                <v-chip size="small" class="mr-2">Ctrl+/</v-chip>
              </template>
              <v-list-item-title>Show this help</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" @click="shortcutsHelpDialog = false">
            Got it
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
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
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useMessageSearch } from '@/composables/useMessageSearch'
import { useConversationTags } from '@/composables/useConversationTags'
import { exportToMarkdown, exportToPDF, exportToJSON } from '@/services/exportService'
import MessageList from './MessageList.vue'
import ChatInput from './ChatInput.vue'
import AvailabilityPanel from './AvailabilityPanel.vue'
import MessageSearch from './MessageSearch.vue'

const router = useRouter()
const theme = useTheme()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()


// Local state
const sidebarOpen = ref(window.innerWidth > 1024)

// Settings drawer state
const settingsDrawer = ref(false)

// Keyboard shortcuts help dialog
const shortcutsHelpDialog = ref(false)

// Search input ref for keyboard shortcut focus
const searchInputRef = ref(null)

// Message search state
const messageSearchOpen = ref(false)

// Message search composable
const {
  searchQuery: messageSearchQuery,
  searchResults: messageSearchResults,
  currentResultIndex: messageSearchCurrentIndex,
  currentResult: messageSearchCurrentResult,
  nextResult: messageSearchNext,
  previousResult: messageSearchPrevious,
  clearSearch: messageSearchClear
} = useMessageSearch(computed(() => currentMessages.value))

// Tags and favorites composable
const {
  predefinedTags,
  allUsedTags,
  addTag,
  removeTag,
  getTags,
  toggleFavorite,
  isFavorite
} = useConversationTags()

// Hotel registration state
const hotelToken = ref(localStorage.getItem('hotelToken'))
const hotelId = ref(localStorage.getItem('hotelId'))
const hotelName = ref(localStorage.getItem('hotelName'))

// Availability panel state
const availabilityPanelOpen = ref(false)
const availabilityData = ref(null)

// AI Assistant Settings state
// Initialize language from localStorage if available
const language = ref(localStorage.getItem('language') || 'en')
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

// Watch for language changes and propagate to localStorage and other components
watch(language, (newLanguage) => {
  console.log('[ChatContainer] Language changed to:', newLanguage)
  // Update localStorage
  localStorage.setItem('language', newLanguage)
  // Emit custom event for same-tab components to listen
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: newLanguage }))
})

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
    searchResults: t('searchResults', lang),
    // Navigation
    documents: t('documents', lang),
    tasks: t('tasks', lang)
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

const goToTasks = () => {
  router.push('/tasks')
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

// Tags and favorites filter state
const activeFilter = ref('all') // 'all', 'favorites', or tag name
const tagMenuOpen = ref(false)
const managingTagsFor = ref(null) // conversation ID for tag management dialog

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

// Error handling computed properties
const errorSuggestion = computed(() => {
  if (!error.value) return null

  const errorText = error.value.toLowerCase()

  if (errorText.includes('твърде много заявки')) {
    return 'Моля изчакай 1-2 минути преди да опиташ отново.'
  }
  if (errorText.includes('интернет') || errorText.includes('свържа')) {
    return 'Провери интернет връзката си и опитай отново.'
  }
  if (errorText.includes('история')) {
    return 'Историята на разговора е развалена. Започни нов разговор за да продължиш.'
  }

  return null
})

const showNewConversationButton = computed(() => {
  if (!error.value) return false
  const errorText = error.value.toLowerCase()
  return errorText.includes('нов разговор') || errorText.includes('история')
})

const showRetryButton = computed(() => {
  if (!error.value) return false
  const errorText = error.value.toLowerCase()
  return errorText.includes('опитай отново') ||
         errorText.includes('интернет') ||
         errorText.includes('сървър')
})

const showClearHistoryButton = computed(() => {
  if (!error.value) return false
  const errorText = error.value.toLowerCase()
  return errorText.includes('история') && !errorText.includes('нов разговор')
})

const hasErrorActions = computed(() => {
  return showNewConversationButton.value ||
         showRetryButton.value ||
         showClearHistoryButton.value
})

const recentConversations = computed(() => {
  let conversations = Array.from(chatStore.conversations.values())
    .filter(conv => {
      // Show only conversations with messages or with a custom title
      return (conv.messageCount && conv.messageCount > 0) ||
             (conv.title && conv.title !== 'New Conversation')
    })

  // Apply filter
  if (activeFilter.value === 'favorites') {
    conversations = conversations.filter(conv => isFavorite(conv.id))
  } else if (activeFilter.value !== 'all') {
    // Filter by tag
    conversations = conversations.filter(conv => {
      const tags = getTags(conv.id)
      return tags.includes(activeFilter.value)
    })
  }

  return conversations
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20)
})

// Keyboard shortcuts setup
useKeyboardShortcuts({
  // Ctrl+N - New conversation
  'ctrl+n': (e) => {
    console.log('[Keyboard] New conversation shortcut triggered')
    handleNewConversation()
  },

  // Ctrl+K - Focus search
  'ctrl+k': (e) => {
    console.log('[Keyboard] Search shortcut triggered')
    if (!sidebarOpen.value) {
      sidebarOpen.value = true
    }
    // Focus search input after sidebar opens
    setTimeout(() => {
      if (searchInputRef.value) {
        searchInputRef.value.focus()
      }
    }, 100)
  },

  // Escape - Close drawers/modals
  'escape': (e) => {
    console.log('[Keyboard] Escape shortcut triggered')
    if (settingsDrawer.value) {
      settingsDrawer.value = false
    } else if (availabilityPanelOpen.value) {
      availabilityPanelOpen.value = false
    } else if (shortcutsHelpDialog.value) {
      shortcutsHelpDialog.value = false
    } else if (sidebarOpen.value && window.innerWidth <= 1024) {
      // Close sidebar on mobile
      sidebarOpen.value = false
    }
  },

  // Ctrl+/ - Show shortcuts help
  'ctrl+/': (e) => {
    console.log('[Keyboard] Show shortcuts help')
    shortcutsHelpDialog.value = true
  },

  // Ctrl+F - Search in conversation
  'ctrl+f': (e) => {
    console.log('[Keyboard] Search in conversation')
    if (currentMessages.value.length > 0) {
      messageSearchOpen.value = !messageSearchOpen.value
      if (!messageSearchOpen.value) {
        messageSearchClear()
      }
    }
  }
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

// Error action button handlers
async function handleNewConversationFromError() {
  clearError()
  await handleNewConversation()
}

async function retryLastMessage() {
  clearError()
  // Get the last user message
  const messages = currentMessages.value
  const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user')

  if (lastUserMessage) {
    // Resend the message
    await chatStore.sendMessage(lastUserMessage.content)
  }
}

async function confirmClearHistory() {
  if (confirm('Сигурен ли си, че искаш да изчистиш историята? Това ще премахне старите съобщения, но ще запази разговора.')) {
    clearError()
    // TODO: Implement clear history endpoint in backend
    // For now, just create a new conversation
    await handleNewConversation()
  }
}

// Export conversation handler
async function handleExport(conversation, format) {
  console.log(`[ChatContainer] Exporting conversation ${conversation.id} as ${format}`)

  try {
    // Get messages for this conversation
    const conversationMessages = currentMessages.value

    if (conversationMessages.length === 0) {
      console.error('[ChatContainer] No messages to export')
      return
    }

    // Export based on format
    switch (format) {
      case 'markdown':
        exportToMarkdown(conversation, conversationMessages)
        break
      case 'pdf':
        exportToPDF(conversation, conversationMessages)
        break
      case 'json':
        exportToJSON(conversation, conversationMessages)
        break
      default:
        console.error('[ChatContainer] Unknown export format:', format)
    }

    console.log(`[ChatContainer] Export successful: ${format}`)
  } catch (err) {
    console.error('[ChatContainer] Export failed:', err)
    error.value = `Failed to export conversation: ${err.message}`
  }
}

// Toggle tag on conversation
function toggleTag(conversationId, tagName) {
  const tags = getTags(conversationId)
  if (tags.includes(tagName)) {
    removeTag(conversationId, tagName)
    console.log(`[ChatContainer] Removed tag '${tagName}' from conversation ${conversationId}`)
  } else {
    addTag(conversationId, tagName)
    console.log(`[ChatContainer] Added tag '${tagName}' to conversation ${conversationId}`)
  }
}

// Delete conversation handler
async function handleDeleteConversation(conversationId) {
  if (confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
    try {
      await chatStore.deleteConversation(conversationId)
      console.log(`[ChatContainer] Deleted conversation ${conversationId}`)

      // If we deleted the current conversation, create a new one
      if (currentConversation.value?.id === conversationId) {
        await handleNewConversation()
      }
    } catch (err) {
      console.error('[ChatContainer] Failed to delete conversation:', err)
      chatStore.error = `Failed to delete conversation: ${err.message}`
    }
  }
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
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  animation: logoFadeIn 0.8s ease-out;
  transition: transform 0.3s ease;
}

.sidebar-logo-icon:hover {
  transform: scale(1.05) rotate(5deg);
}

@keyframes logoFadeIn {
  0% {
    opacity: 0;
    transform: scale(0.8) translateY(-10px);
  }
  60% {
    opacity: 0.8;
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.sidebar-title {
  font-size: 16px;
  font-weight: 600;
  animation: titleFadeIn 1s ease-out 0.2s backwards;
  background: linear-gradient(135deg, #296fdc 0%, #29aff3 50%, #03fecc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

@keyframes titleFadeIn {
  0% {
    opacity: 0;
    transform: translateX(-10px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
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
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  flex: 1;
  color: rgb(var(--v-theme-on-surface));
  word-break: break-word;
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

/* Tags and Favorites Styles */
.sidebar-filters {
  padding: 8px 16px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.conversation-item-wrapper {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 4px 8px;
}

.conversation-item-wrapper:hover .conversation-menu-btn {
  opacity: 1;
}

.conversation-item {
  flex: 1;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;
  min-width: 0;
}

.conversation-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.conversation-item.active {
  background: rgba(var(--v-theme-primary), 0.12);
}

.conv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.conv-title {
  flex: 1;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorite-btn {
  opacity: 0;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.conversation-item-wrapper:hover .favorite-btn,
.favorite-btn.active {
  opacity: 1;
}

.conv-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.conversation-menu-btn {
  opacity: 0;
  transition: opacity 0.2s;
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 10px;
}
</style>
