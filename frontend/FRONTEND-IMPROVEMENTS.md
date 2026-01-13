# Chat Frontend Improvements - Препоръки

## 📋 Текущо състояние (Summary)

Vue 3 + Vuetify 3 + Pinia приложение с:
- ✅ Real-time streaming (SSE)
- ✅ Tool visualization
- ✅ Markdown rendering
- ✅ Document upload
- ✅ Mobile responsive
- ✅ Dark/Light theme
- ✅ localStorage + Backend persistence

---

## 🎯 ПРИОРИТЕТНИ ПОДОБРЕНИЯ

### 1. 🔴 URGENT: Token Limit Warning UI

**Проблем:** Потребителят не вижда когато се приближава token limit (200K)

**Решение:** Visual warning когато token usage > 90%

**Implementation:**
```vue
<!-- В ChatContainer.vue, добави след error alert -->
<v-alert
  v-if="tokenWarning"
  type="warning"
  closable
  @click:close="tokenWarning = null"
  class="mb-4"
  density="compact"
>
  <div class="d-flex align-center justify-space-between">
    <div>
      <strong>Token Limit Warning</strong>
      <div class="text-caption">
        Conversation history is {{ tokenWarning.percent }}% full ({{ tokenWarning.tokens.toLocaleString() }} / 200,000 tokens)
      </div>
    </div>
    <v-btn
      size="small"
      variant="outlined"
      @click="clearHistory"
    >
      Clear History
    </v-btn>
  </div>
</v-alert>

<script setup>
// В chatStore.js, добави state
const tokenWarning = ref(null);

// В sendMessageStreaming, след onComplete callback
if (response.tokenUsage && response.tokenUsage.input > 180000) {
  tokenWarning.value = {
    tokens: response.tokenUsage.input,
    percent: Math.round((response.tokenUsage.input / 200000) * 100)
  };
}

// Добави метод
const clearHistory = async () => {
  // POST /conversations/:id/clear endpoint
  await api.clearConversationHistory(currentConversationId.value);
  messages.value.set(currentConversationId.value, []);
  tokenWarning.value = null;
};
</script>
```

**Expected:** Потребителят вижда warning и може да изчисти историята с 1 клик

---

### 2. 🟡 HIGH: Clear Conversation History Button

**Проблем:** Няма начин потребителят да изчисти историята без да започне нов разговор

**Решение:** Добави "Clear History" бутон в conversation menu

**Implementation:**
```vue
<!-- В ChatContainer.vue, в top bar menu -->
<v-menu>
  <template v-slot:activator="{ props }">
    <v-btn icon="mdi-dots-vertical" v-bind="props" size="small"></v-btn>
  </template>
  <v-list>
    <v-list-item @click="openSettings">
      <v-list-item-title>
        <v-icon icon="mdi-cog" size="small" class="mr-2"></v-icon>
        Settings
      </v-list-item-title>
    </v-list-item>

    <!-- NEW: Clear History -->
    <v-list-item @click="confirmClearHistory">
      <v-list-item-title>
        <v-icon icon="mdi-broom" size="small" class="mr-2"></v-icon>
        Clear History
      </v-list-item-title>
    </v-list-item>

    <v-list-item @click="deleteConversation">
      <v-list-item-title class="text-error">
        <v-icon icon="mdi-delete" size="small" class="mr-2"></v-icon>
        Delete Conversation
      </v-list-item-title>
    </v-list-item>
  </v-list>
</v-menu>

<script setup>
const confirmClearHistory = () => {
  // Show confirmation dialog
  if (confirm('Clear conversation history? This will keep the conversation but remove old messages to free up token space.')) {
    chatStore.clearHistory();
  }
};
</script>
```

**Backend endpoint нужен:**
```javascript
// В backend/mcp-client/src/index.js
app.post('/conversations/:id/clear', async (req, res) => {
  try {
    const { id } = req.params;

    // Clear history in QuendooClaudeIntegration
    const quendooIntegration = quendooIntegrations.get(id);
    if (quendooIntegration) {
      quendooIntegration.clearHistory(id);
    }

    // Optionally: keep last 2 messages in DB for context
    await conversationService.clearMessages(id, { keepLast: 2 });

    res.json({ success: true, message: 'History cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### 3. 🟡 HIGH: Message Grouping by Date

**Проблем:** Дълги conversations са трудни за навигация

**Решение:** Group messages by date с date separators

**Implementation:**
```vue
<!-- В MessageList.vue -->
<template>
  <div ref="messageListRef" class="message-list">
    <template v-for="(group, date) in groupedMessages" :key="date">
      <!-- Date separator -->
      <div class="date-separator">
        <v-divider></v-divider>
        <span class="date-label">{{ formatDate(date) }}</span>
        <v-divider></v-divider>
      </div>

      <!-- Messages for this date -->
      <ChatMessage
        v-for="message in group"
        :key="message.id"
        :message="message"
      />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { format, isToday, isYesterday, parseISO } from 'date-fns';

const groupedMessages = computed(() => {
  const groups = {};

  messages.value.forEach(msg => {
    const date = format(parseISO(msg.timestamp), 'yyyy-MM-dd');
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
  });

  return groups;
});

const formatDate = (dateStr) => {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMMM d, yyyy');
};
</script>

<style scoped>
.date-separator {
  display: flex;
  align-items: center;
  margin: 24px 0 16px;
  gap: 12px;
}

.date-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  padding: 0 8px;
}
</style>
```

---

### 4. 🟡 HIGH: Conversation Search Improvements

**Проблем:** Search само по title, не search по message content

**Решение:** Full-text search през messages

**Implementation:**
```vue
<!-- В ChatContainer.vue sidebar -->
<v-text-field
  v-model="searchQuery"
  prepend-inner-icon="mdi-magnify"
  placeholder="Search conversations or messages..."
  density="compact"
  variant="outlined"
  hide-details
  clearable
  @update:model-value="debouncedSearch"
>
  <!-- Add filter chips -->
  <template v-slot:append>
    <v-menu>
      <template v-slot:activator="{ props }">
        <v-btn icon="mdi-filter" size="x-small" v-bind="props"></v-btn>
      </template>
      <v-list>
        <v-list-item @click="searchFilter = 'all'">
          <v-list-item-title>All</v-list-item-title>
        </v-list-item>
        <v-list-item @click="searchFilter = 'title'">
          <v-list-item-title>Titles only</v-list-item-title>
        </v-list-item>
        <v-list-item @click="searchFilter = 'messages'">
          <v-list-item-title>Message content</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </template>
</v-text-field>

<script setup>
const searchFilter = ref('all');

const debouncedSearch = debounce(async (query) => {
  if (!query) {
    searchResults.value = [];
    return;
  }

  // Backend search with filter
  const results = await api.searchConversations(query, searchFilter.value);
  searchResults.value = results;
}, 300);
</script>
```

**Backend endpoint:**
```javascript
// В backend/mcp-client/src/index.js
app.get('/conversations/search', async (req, res) => {
  const { q, filter = 'all' } = req.query;
  const hotelId = req.hotelId;

  let results = [];

  if (filter === 'all' || filter === 'title') {
    // Search by title
    const titleResults = await conversationService.searchByTitle(hotelId, q);
    results.push(...titleResults);
  }

  if (filter === 'all' || filter === 'messages') {
    // Search message content
    const messageResults = await conversationService.searchMessages(hotelId, q);
    results.push(...messageResults);
  }

  // Deduplicate and sort by relevance
  const unique = [...new Map(results.map(r => [r.conversationId, r])).values()];
  res.json(unique);
});
```

---

### 5. 🟢 MEDIUM: Message Actions Improvements

**Проблем:** Copy, thumbs up/down са малко визуално скрити

**Решение:** По-очевидни action buttons с tooltips

**Implementation:**
```vue
<!-- В ChatMessage.vue -->
<div class="message-actions" v-show="!isStreaming">
  <!-- Copy -->
  <v-tooltip text="Copy message" location="top">
    <template v-slot:activator="{ props }">
      <v-btn
        icon="mdi-content-copy"
        size="small"
        variant="text"
        v-bind="props"
        @click="copyMessage"
      ></v-btn>
    </template>
  </v-tooltip>

  <!-- Regenerate (AI messages only) -->
  <v-tooltip text="Regenerate response" location="top" v-if="message.role === 'assistant'">
    <template v-slot:activator="{ props }">
      <v-btn
        icon="mdi-refresh"
        size="small"
        variant="text"
        v-bind="props"
        @click="regenerateResponse"
      ></v-btn>
    </template>
  </v-tooltip>

  <!-- Edit (user messages only) -->
  <v-tooltip text="Edit and resend" location="top" v-if="message.role === 'user'">
    <template v-slot:activator="{ props }">
      <v-btn
        icon="mdi-pencil"
        size="small"
        variant="text"
        v-bind="props"
        @click="editMessage"
      ></v-btn>
    </template>
  </v-tooltip>

  <!-- Feedback -->
  <v-btn-toggle
    v-model="feedback"
    density="compact"
    variant="text"
    mandatory
    class="ml-2"
  >
    <v-tooltip text="Good response" location="top">
      <template v-slot:activator="{ props }">
        <v-btn
          icon="mdi-thumb-up-outline"
          size="small"
          value="up"
          v-bind="props"
        ></v-btn>
      </template>
    </v-tooltip>

    <v-tooltip text="Bad response" location="top">
      <template v-slot:activator="{ props }">
        <v-btn
          icon="mdi-thumb-down-outline"
          size="small"
          value="down"
          v-bind="props"
        ></v-btn>
      </template>
    </v-tooltip>
  </v-btn-toggle>
</div>

<style scoped>
.message-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-container:hover .message-actions {
  opacity: 1;
}
</style>
```

---

### 6. 🟢 MEDIUM: Keyboard Shortcuts Panel

**Проблем:** Потребителят не знае за shortcuts (Ctrl+Enter, Shift+Enter)

**Решение:** Shortcuts помощен panel с kbd tags

**Implementation:**
```vue
<!-- В ChatContainer.vue -->
<v-menu
  v-model="shortcutsMenuOpen"
  :close-on-content-click="false"
  location="top"
>
  <template v-slot:activator="{ props }">
    <v-btn
      icon="mdi-keyboard"
      size="small"
      variant="text"
      v-bind="props"
      class="shortcuts-btn"
    ></v-btn>
  </template>

  <v-card width="400">
    <v-card-title>Keyboard Shortcuts</v-card-title>
    <v-card-text>
      <v-list density="compact">
        <v-list-item>
          <template v-slot:prepend>
            <kbd>Enter</kbd>
          </template>
          <v-list-item-title>Send message</v-list-item-title>
        </v-list-item>

        <v-list-item>
          <template v-slot:prepend>
            <kbd>Shift</kbd> + <kbd>Enter</kbd>
          </template>
          <v-list-item-title>New line</v-list-item-title>
        </v-list-item>

        <v-list-item>
          <template v-slot:prepend>
            <kbd>Ctrl</kbd> + <kbd>K</kbd>
          </template>
          <v-list-item-title>New conversation</v-list-item-title>
        </v-list-item>

        <v-list-item>
          <template v-slot:prepend>
            <kbd>Ctrl</kbd> + <kbd>/</kbd>
          </template>
          <v-list-item-title>Search conversations</v-list-item-title>
        </v-list-item>

        <v-list-item>
          <template v-slot:prepend>
            <kbd>Esc</kbd>
          </template>
          <v-list-item-title>Close sidebar/drawer</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</v-menu>

<style scoped>
kbd {
  background-color: rgb(var(--v-theme-surface-variant));
  border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 4px;
  padding: 2px 6px;
  font-family: monospace;
  font-size: 12px;
}
</style>

<script setup>
// Implement keyboard shortcuts
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});

const handleKeyDown = (e) => {
  // Ctrl+K: New conversation
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    createNewConversation();
  }

  // Ctrl+/: Focus search
  if (e.ctrlKey && e.key === '/') {
    e.preventDefault();
    searchInputRef.value?.focus();
  }

  // Esc: Close sidebar/drawer
  if (e.key === 'Escape') {
    sidebarOpen.value = false;
    settingsDrawer.value = false;
    visualizationDrawer.value = false;
  }
};
</script>
```

---

### 7. 🟢 MEDIUM: Message Editing (Edit & Resend)

**Проблем:** Ако потребителят направи грешка, трябва да copy-paste

**Решение:** Edit button за user messages

**Implementation:**
```vue
<!-- В ChatMessage.vue -->
<div v-if="isEditing" class="edit-mode">
  <v-textarea
    v-model="editedContent"
    variant="outlined"
    density="compact"
    auto-grow
    rows="2"
  ></v-textarea>

  <div class="d-flex gap-2 mt-2">
    <v-btn
      size="small"
      color="primary"
      @click="saveEdit"
    >
      Save & Resend
    </v-btn>
    <v-btn
      size="small"
      variant="text"
      @click="cancelEdit"
    >
      Cancel
    </v-btn>
  </div>
</div>

<div v-else class="message-content" v-html="renderedContent"></div>

<script setup>
const isEditing = ref(false);
const editedContent = ref('');

const editMessage = () => {
  isEditing.value = true;
  editedContent.value = message.content;
};

const saveEdit = async () => {
  // Delete all messages after this one
  await chatStore.deleteMessagesAfter(message.id);

  // Send edited message as new
  await chatStore.sendMessage(editedContent.value);

  isEditing.value = false;
};

const cancelEdit = () => {
  isEditing.value = false;
  editedContent.value = '';
};
</script>
```

---

### 8. 🟢 MEDIUM: Export Conversation

**Проблем:** Няма начин да експортираш conversation за споделяне или archive

**Решение:** Export to PDF/Markdown buttons

**Implementation:**
```vue
<!-- В ChatContainer.vue menu -->
<v-list-item @click="exportConversation">
  <v-list-item-title>
    <v-icon icon="mdi-download" size="small" class="mr-2"></v-icon>
    Export Conversation
  </v-list-item-title>
</v-list-item>

<script setup>
const exportConversation = () => {
  const conversation = conversations.value.get(currentConversationId.value);
  const msgs = messages.value.get(currentConversationId.value) || [];

  // Generate Markdown
  let markdown = `# ${conversation.title}\n\n`;
  markdown += `**Date:** ${format(parseISO(conversation.createdAt), 'PPpp')}\n\n`;
  markdown += `---\n\n`;

  msgs.forEach(msg => {
    const role = msg.role === 'user' ? 'You' : 'AI Assistant';
    const time = format(parseISO(msg.timestamp), 'HH:mm');
    markdown += `### ${role} (${time})\n\n`;
    markdown += `${msg.content}\n\n`;

    if (msg.toolsUsed && msg.toolsUsed.length > 0) {
      markdown += `**Tools Used:** ${msg.toolsUsed.map(t => t.name).join(', ')}\n\n`;
    }

    markdown += `---\n\n`;
  });

  // Download as .md file
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${conversation.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
};
</script>
```

---

### 9. 🟢 MEDIUM: Token Usage Indicator

**Проблем:** Потребителят не вижда текущо token usage в real-time

**Решение:** Token usage badge в top bar

**Implementation:**
```vue
<!-- В ChatContainer.vue top bar -->
<v-toolbar density="compact">
  <v-toolbar-title>{{ currentConversation?.title || 'New Conversation' }}</v-toolbar-title>

  <!-- Token usage badge -->
  <v-chip
    v-if="tokenUsage"
    size="small"
    :color="tokenUsageColor"
    variant="tonal"
    prepend-icon="mdi-counter"
    class="ml-2"
  >
    {{ tokenUsage.toLocaleString() }} tokens
  </v-chip>

  <v-spacer></v-spacer>
  <v-btn icon="mdi-dots-vertical"></v-btn>
</v-toolbar>

<script setup>
const tokenUsage = ref(null);

const tokenUsageColor = computed(() => {
  if (!tokenUsage.value) return 'grey';
  const percent = (tokenUsage.value / 200000) * 100;
  if (percent > 90) return 'error';
  if (percent > 70) return 'warning';
  return 'success';
});

// Update после cada response
watch(() => chatStore.lastResponse, (response) => {
  if (response?.tokenUsage) {
    tokenUsage.value = response.tokenUsage.input;
  }
});
</script>
```

---

### 10. 🔵 LOW: Conversation Templates

**Проблем:** Често срещани scenarios изискват многократно въвеждане на същия context

**Решение:** Pre-defined conversation templates

**Implementation:**
```vue
<!-- В ChatContainer.vue sidebar, над recent conversations -->
<v-expansion-panels class="mb-4">
  <v-expansion-panel>
    <v-expansion-panel-title>
      <v-icon icon="mdi-lightning-bolt" size="small" class="mr-2"></v-icon>
      Quick Start Templates
    </v-expansion-panel-title>
    <v-expansion-panel-text>
      <v-list density="compact">
        <v-list-item
          v-for="template in templates"
          :key="template.id"
          @click="startFromTemplate(template)"
        >
          <template v-slot:prepend>
            <v-icon :icon="template.icon" size="small"></v-icon>
          </template>
          <v-list-item-title>{{ template.title }}</v-list-item-title>
          <v-list-item-subtitle>{{ template.description }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-expansion-panel-text>
  </v-expansion-panel>
</v-expansion-panels>

<script setup>
const templates = [
  {
    id: 'check-availability',
    title: 'Check Availability',
    description: 'Check room availability for dates',
    icon: 'mdi-calendar-check',
    prompt: 'Покажи ми наличните стаи за следващата седмица.'
  },
  {
    id: 'reservation-lookup',
    title: 'Find Reservation',
    description: 'Look up reservation by number',
    icon: 'mdi-magnify',
    prompt: 'Покажи ми информация за резервация номер: '
  },
  {
    id: 'document-search',
    title: 'Search Documents',
    description: 'Search through uploaded documents',
    icon: 'mdi-file-search',
    prompt: 'Потърси в документите за: '
  },
  {
    id: 'contact-guest',
    title: 'Contact Guest',
    description: 'Make a phone call to a guest',
    icon: 'mdi-phone',
    prompt: 'Обади се на гост на телефон: '
  }
];

const startFromTemplate = async (template) => {
  // Create new conversation
  await chatStore.createConversation({ title: template.title });

  // Prefill input with template prompt
  nextTick(() => {
    chatInputRef.value?.focus();
    chatInputRef.value?.setValue(template.prompt);
  });
};
</script>
```

---

### 11. 🔵 LOW: Message Reactions

**Проблем:** Thumbs up/down е binary, не улавя нюанси

**Решение:** Emoji reactions (като Slack/Discord)

**Implementation:**
```vue
<!-- В ChatMessage.vue -->
<div class="message-reactions">
  <v-menu>
    <template v-slot:activator="{ props }">
      <v-btn
        icon="mdi-emoticon-plus"
        size="x-small"
        variant="text"
        v-bind="props"
      ></v-btn>
    </template>

    <v-card>
      <v-card-text>
        <div class="emoji-picker">
          <span
            v-for="emoji in ['👍', '👎', '❤️', '🎉', '😂', '🤔', '👀', '🔥']"
            :key="emoji"
            class="emoji-option"
            @click="addReaction(emoji)"
          >
            {{ emoji }}
          </span>
        </div>
      </v-card-text>
    </v-card>
  </v-menu>

  <!-- Show reactions -->
  <v-chip
    v-for="(count, emoji) in message.reactions"
    :key="emoji"
    size="small"
    @click="toggleReaction(emoji)"
    :variant="hasUserReacted(emoji) ? 'elevated' : 'text'"
  >
    {{ emoji }} {{ count }}
  </v-chip>
</div>

<style scoped>
.emoji-picker {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.emoji-option {
  font-size: 24px;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  text-align: center;
  transition: background-color 0.2s;
}

.emoji-option:hover {
  background-color: rgba(0, 0, 0, 0.05);
}
</style>
```

---

### 12. 🔵 LOW: Conversation Sharing (Public Links)

**Проблем:** Не можеш да споделиш интересен conversation с колега

**Решение:** Generate shareable link

**Implementation:**
```vue
<!-- В ChatContainer.vue menu -->
<v-list-item @click="shareConversation">
  <v-list-item-title>
    <v-icon icon="mdi-share-variant" size="small" class="mr-2"></v-icon>
    Share Conversation
  </v-list-item-title>
</v-list-item>

<v-dialog v-model="shareDialog" max-width="500">
  <v-card>
    <v-card-title>Share Conversation</v-card-title>
    <v-card-text>
      <v-text-field
        :model-value="shareLink"
        readonly
        variant="outlined"
        density="compact"
      >
        <template v-slot:append>
          <v-btn
            icon="mdi-content-copy"
            size="small"
            @click="copyShareLink"
          ></v-btn>
        </template>
      </v-text-field>

      <v-alert type="info" density="compact" class="mt-4">
        Anyone with this link can view this conversation (read-only).
      </v-alert>
    </v-card-text>
    <v-card-actions>
      <v-spacer></v-spacer>
      <v-btn @click="shareDialog = false">Close</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>

<script setup>
const shareDialog = ref(false);
const shareLink = ref('');

const shareConversation = async () => {
  // Generate public share token
  const response = await api.createShareLink(currentConversationId.value);
  shareLink.value = `${window.location.origin}/shared/${response.shareToken}`;
  shareDialog.value = true;
};
</script>
```

---

## 🎨 VISUAL/UX IMPROVEMENTS

### 13. Better Tool Result Visualization

**Проблем:** JSON в accordion е скучен и труден за четене

**Решение:** Custom visualizations за specific tools

**Example - Availability Results:**
```vue
<!-- В ChatMessage.vue, вместо plain JSON -->
<div v-if="tool.name === 'get_availability'" class="availability-viz">
  <v-simple-table>
    <thead>
      <tr>
        <th>Room Type</th>
        <th>Date</th>
        <th>Available</th>
        <th>Price</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="room in tool.result.rooms"
        :key="room.id"
        :class="{ 'text-success': room.available, 'text-error': !room.available }"
      >
        <td>{{ room.type }}</td>
        <td>{{ formatDate(room.date) }}</td>
        <td>
          <v-icon
            :icon="room.available ? 'mdi-check-circle' : 'mdi-close-circle'"
            size="small"
          ></v-icon>
        </td>
        <td>{{ room.price }} лв</td>
      </tr>
    </tbody>
  </v-simple-table>
</div>
```

### 14. Progressive Loading Animation

**Проблем:** "AI is thinking" е статичен text

**Решение:** Animated loading states с etапи

```vue
<div v-if="isLoading" class="loading-stages">
  <div class="stage" :class="{ active: stage >= 1 }">
    <v-icon icon="mdi-brain" size="small"></v-icon>
    <span>Thinking...</span>
  </div>

  <div class="stage" :class="{ active: stage >= 2 }">
    <v-icon icon="mdi-tools" size="small"></v-icon>
    <span>Gathering data...</span>
  </div>

  <div class="stage" :class="{ active: stage >= 3 }">
    <v-icon icon="mdi-file-document" size="small"></v-icon>
    <span>Preparing response...</span>
  </div>
</div>

<script setup>
const stage = ref(1);

// Progress through stages
watch(isLoading, (loading) => {
  if (loading) {
    stage.value = 1;
    setTimeout(() => stage.value = 2, 1000);
    setTimeout(() => stage.value = 3, 2500);
  }
});
</script>

<style scoped>
.stage {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.3;
  transition: opacity 0.3s;
}

.stage.active {
  opacity: 1;
}
</style>
```

---

## 🔧 TECHNICAL IMPROVEMENTS

### 15. Infinite Scroll for Conversation History

**Проблем:** Ако има 100+ conversations, sidebar е бавен

**Решение:** Lazy loading с intersection observer

```vue
<!-- В ChatContainer.vue sidebar -->
<div class="conversations-list" ref="conversationsListRef">
  <v-list-item
    v-for="conv in visibleConversations"
    :key="conv.id"
    @click="selectConversation(conv.id)"
  >
    <!-- ... -->
  </v-list-item>

  <!-- Sentinel element for infinite scroll -->
  <div ref="sentinelRef" class="sentinel"></div>
</div>

<script setup>
import { useIntersectionObserver } from '@vueuse/core';

const visibleConversations = ref([]);
const page = ref(1);
const pageSize = 20;

const { stop } = useIntersectionObserver(
  sentinelRef,
  ([{ isIntersecting }]) => {
    if (isIntersecting) {
      loadMoreConversations();
    }
  }
);

const loadMoreConversations = () => {
  const start = (page.value - 1) * pageSize;
  const end = start + pageSize;
  const nextBatch = allConversations.value.slice(start, end);

  visibleConversations.value.push(...nextBatch);
  page.value++;
};

onMounted(() => {
  loadMoreConversations();
});
</script>
```

### 16. Optimistic UI Updates

**Проблем:** Message се появява след backend response (забавяне)

**Решение:** Show message instantly, update on confirm

```javascript
// В chatStore.js
const sendMessage = async (content) => {
  const tempId = `temp_${Date.now()}`;

  // Add message optimistically
  const tempMessage = {
    id: tempId,
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
    pending: true // Mark as pending
  };

  addMessage(currentConversationId.value, tempMessage);

  try {
    // Send to backend
    const response = await api.sendMessageStreaming(content, {
      onComplete: (result) => {
        // Replace temp message with real one
        const msgs = messages.value.get(currentConversationId.value);
        const index = msgs.findIndex(m => m.id === tempId);
        if (index !== -1) {
          msgs[index] = {
            ...tempMessage,
            id: result.messageId, // Real ID from backend
            pending: false
          };
        }
      }
    });
  } catch (error) {
    // Remove temp message on error
    const msgs = messages.value.get(currentConversationId.value);
    const index = msgs.findIndex(m => m.id === tempId);
    if (index !== -1) {
      msgs.splice(index, 1);
    }
    throw error;
  }
};
```

### 17. Service Worker for Offline Support

**Проблем:** Ако загубиш connection, chat спира да работи

**Решение:** Cache conversations в service worker

```javascript
// public/service-worker.js
const CACHE_NAME = 'quendoo-chat-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/main.css',
  '/assets/main.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Cache-first strategy for static assets
  if (event.request.url.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }

  // Network-first for API calls
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
  }
});
```

---

## 📊 ANALYTICS & MONITORING

### 18. User Analytics Integration

Track user behavior за optimization:

```javascript
// src/utils/analytics.js
export const trackEvent = (category, action, label) => {
  if (window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label
    });
  }
};

// Usage
trackEvent('chat', 'send_message', 'text');
trackEvent('chat', 'tool_executed', 'get_availability');
trackEvent('conversation', 'created', 'template');
```

---

## 🚀 IMPLEMENTATION PRIORITY

### Phase 1 (Urgent - Тази седмица):
1. ✅ Token limit warning UI
2. ✅ Clear history button
3. ✅ Token usage indicator

### Phase 2 (High - Следващи 2 седмици):
4. Message grouping by date
5. Improved search
6. Message actions improvements
7. Keyboard shortcuts

### Phase 3 (Medium - Следващ месец):
8. Message editing
9. Export conversation
10. Better tool visualizations
11. Progressive loading animation

### Phase 4 (Low - Future):
12. Conversation templates
13. Message reactions
14. Conversation sharing
15. Infinite scroll
16. Optimistic UI
17. Service worker
18. Analytics

---

## ✅ Success Metrics

След implementations, measure:
- **Token limit errors:** < 1% от conversations
- **Conversation length:** Average 15-20 messages (vs current 10)
- **User engagement:** +30% message volume
- **Tool usage visibility:** +50% users see tool results
- **Search usage:** +40% users use search
- **Mobile usage:** +25% mobile traffic

---

Готово! Имаш comprehensive план за frontend improvements. Кои от тези предложения искаш да приоритизираме за implementation? 🚀
