<template>
  <admin-layout>
    <div class="admin-integration">
      <v-container fluid>
      <v-row>
        <v-col cols="12">
          <div class="page-header">
            <v-icon size="32" color="primary" class="mr-3">mdi-puzzle</v-icon>
            <div>
              <h1 class="text-h4 font-weight-bold">Quendoo Integration</h1>
              <p class="text-subtitle-1 text-medium-emphasis mt-1">
                Embed the chatbot into your Quendoo admin panel
              </p>
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- Quick Start Card -->
      <v-row>
        <v-col cols="12" md="8">
          <v-card class="mb-4">
            <v-card-title class="bg-gradient">
              <v-icon class="mr-2">mdi-rocket-launch</v-icon>
              Quick Start
            </v-card-title>
            <v-card-text class="pa-6">
              <v-alert type="info" variant="tonal" class="mb-4">
                <strong>How it works:</strong> Embed the chatbot as an iframe in your admin panel.
                The chatbot automatically receives the Quendoo API key via secure PostMessage API.
              </v-alert>

              <h3 class="text-h6 mb-3">Step 1: Add iframe to your admin panel</h3>
              <v-card variant="outlined" class="mb-4">
                <v-card-text>
                  <div class="code-header d-flex justify-space-between align-center mb-2">
                    <span class="text-caption text-medium-emphasis">HTML</span>
                    <v-btn
                      size="small"
                      variant="text"
                      prepend-icon="mdi-content-copy"
                      @click="copyCode(htmlCode)"
                    >
                      Copy
                    </v-btn>
                  </div>
                  <pre class="code-block">{{ htmlCode }}</pre>
                </v-card-text>
              </v-card>

              <h3 class="text-h6 mb-3">Step 2: Add integration JavaScript</h3>
              <v-card variant="outlined" class="mb-4">
                <v-card-text>
                  <div class="code-header d-flex justify-space-between align-center mb-2">
                    <span class="text-caption text-medium-emphasis">JavaScript</span>
                    <v-btn
                      size="small"
                      variant="text"
                      prepend-icon="mdi-content-copy"
                      @click="copyCode(jsCode)"
                    >
                      Copy
                    </v-btn>
                  </div>
                  <pre class="code-block">{{ jsCode }}</pre>
                </v-card-text>
              </v-card>

              <h3 class="text-h6 mb-3">Step 3: PHP Backend Example</h3>
              <v-card variant="outlined">
                <v-card-text>
                  <div class="code-header d-flex justify-space-between align-center mb-2">
                    <span class="text-caption text-medium-emphasis">PHP</span>
                    <v-btn
                      size="small"
                      variant="text"
                      prepend-icon="mdi-content-copy"
                      @click="copyCode(phpCode)"
                    >
                      Copy
                    </v-btn>
                  </div>
                  <pre class="code-block">{{ phpCode }}</pre>
                </v-card-text>
              </v-card>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Info Sidebar -->
        <v-col cols="12" md="4">
          <v-card class="mb-4">
            <v-card-title class="bg-success">
              <v-icon class="mr-2">mdi-check-circle</v-icon>
              Benefits
            </v-card-title>
            <v-card-text class="pa-4">
              <v-list density="compact">
                <v-list-item prepend-icon="mdi-lock">
                  <v-list-item-title>Secure API key transfer</v-list-item-title>
                  <v-list-item-subtitle>Via PostMessage API</v-list-item-subtitle>
                </v-list-item>
                <v-list-item prepend-icon="mdi-lightning-bolt">
                  <v-list-item-title>Automatic setup</v-list-item-title>
                  <v-list-item-subtitle>No manual configuration needed</v-list-item-subtitle>
                </v-list-item>
                <v-list-item prepend-icon="mdi-account-multiple">
                  <v-list-item-title>Multi-user support</v-list-item-title>
                  <v-list-item-subtitle>Each user gets their own API key</v-list-item-subtitle>
                </v-list-item>
                <v-list-item prepend-icon="mdi-responsive">
                  <v-list-item-title>Responsive design</v-list-item-title>
                  <v-list-item-subtitle>Works on all devices</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>

          <v-card class="mb-4">
            <v-card-title class="bg-warning">
              <v-icon class="mr-2">mdi-shield-lock</v-icon>
              Security
            </v-card-title>
            <v-card-text class="pa-4">
              <v-alert type="warning" variant="tonal" density="compact" class="mb-3">
                <strong>Never hardcode API keys!</strong>
              </v-alert>
              <p class="text-body-2">
                Always retrieve API keys from your backend/session. The chatbot validates
                the origin of messages for security.
              </p>
              <v-divider class="my-3"></v-divider>
              <p class="text-caption text-medium-emphasis">
                <strong>Trusted Origins:</strong><br>
                • https://quendoo.com<br>
                • https://admin.quendoo.com<br>
                • http://localhost (dev only)
              </p>
            </v-card-text>
          </v-card>

          <v-card>
            <v-card-title class="bg-info">
              <v-icon class="mr-2">mdi-file-document</v-icon>
              Resources
            </v-card-title>
            <v-card-text class="pa-4">
              <v-list density="compact">
                <v-list-item
                  prepend-icon="mdi-download"
                  @click="downloadTestFile"
                  class="cursor-pointer"
                >
                  <v-list-item-title>Test Integration File</v-list-item-title>
                  <v-list-item-subtitle>Download HTML test file</v-list-item-subtitle>
                </v-list-item>
                <v-list-item
                  prepend-icon="mdi-github"
                  href="https://github.com/gorianvarbanov/quendoo-ai-dashboard"
                  target="_blank"
                >
                  <v-list-item-title>View on GitHub</v-list-item-title>
                  <v-list-item-subtitle>Source code & docs</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Message Protocol -->
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title class="bg-gradient">
              <v-icon class="mr-2">mdi-message-text</v-icon>
              Message Protocol
            </v-card-title>
            <v-card-text class="pa-6">
              <v-row>
                <v-col cols="12" md="6">
                  <h3 class="text-h6 mb-3">Messages TO Chatbot</h3>

                  <v-card variant="outlined" class="mb-3">
                    <v-card-title class="text-subtitle-2 bg-surface-variant">
                      QUENDOO_API_KEY
                    </v-card-title>
                    <v-card-text>
                      <pre class="code-block-small">{{ messageApiKey }}</pre>
                      <p class="text-caption mt-2">Send only the API key</p>
                    </v-card-text>
                  </v-card>

                  <v-card variant="outlined">
                    <v-card-title class="text-subtitle-2 bg-surface-variant">
                      QUENDOO_CONFIG (Recommended)
                    </v-card-title>
                    <v-card-text>
                      <pre class="code-block-small">{{ messageConfig }}</pre>
                      <p class="text-caption mt-2">Send full configuration with context</p>
                    </v-card-text>
                  </v-card>
                </v-col>

                <v-col cols="12" md="6">
                  <h3 class="text-h6 mb-3">Messages FROM Chatbot</h3>

                  <v-card variant="outlined" class="mb-3">
                    <v-card-title class="text-subtitle-2 bg-surface-variant">
                      CHATBOT_READY
                    </v-card-title>
                    <v-card-text>
                      <pre class="code-block-small">{{ messageChatbotReady }}</pre>
                      <p class="text-caption mt-2">Chatbot loaded and ready to receive messages</p>
                    </v-card-text>
                  </v-card>

                  <v-card variant="outlined" class="mb-3">
                    <v-card-title class="text-subtitle-2 bg-surface-variant">
                      QUENDOO_API_KEY_RECEIVED
                    </v-card-title>
                    <v-card-text>
                      <pre class="code-block-small">{{ messageApiKeyReceived }}</pre>
                      <p class="text-caption mt-2">Confirmation that API key was received</p>
                    </v-card-text>
                  </v-card>

                  <v-card variant="outlined">
                    <v-card-title class="text-subtitle-2 bg-surface-variant">
                      QUENDOO_CONFIG_RECEIVED
                    </v-card-title>
                    <v-card-text>
                      <pre class="code-block-small">{{ messageConfigReceived }}</pre>
                      <p class="text-caption mt-2">Confirmation that config was received</p>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Troubleshooting -->
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title class="bg-gradient">
              <v-icon class="mr-2">mdi-tools</v-icon>
              Troubleshooting
            </v-card-title>
            <v-card-text class="pa-6">
              <v-expansion-panels>
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <v-icon class="mr-2">mdi-help-circle</v-icon>
                    Chatbot not receiving API key
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <ol class="pl-4">
                      <li>Check if iframe is fully loaded (add <code>load</code> event listener)</li>
                      <li>Verify origin is correct (check console for security warnings)</li>
                      <li>Confirm message format matches the protocol above</li>
                      <li>Add delay: <code>setTimeout(sendConfigToChatbot, 1000)</code></li>
                    </ol>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <v-icon class="mr-2">mdi-shield-alert</v-icon>
                    CORS or security errors
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <ol class="pl-4">
                      <li>Ensure you're using HTTPS in production</li>
                      <li>Check if your domain is in the trusted origins list</li>
                      <li>Verify you're sending to correct origin</li>
                      <li>Contact admin to add your domain to trusted list</li>
                    </ol>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <v-icon class="mr-2">mdi-database-alert</v-icon>
                    API key not persisting
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <ol class="pl-4">
                      <li>Check if localStorage is enabled in browser</li>
                      <li>Look for JavaScript errors in console</li>
                      <li>Verify API key format is correct</li>
                      <li>Check Application → Local Storage in DevTools</li>
                    </ol>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Snackbar for copy confirmation -->
      <v-snackbar v-model="snackbar" :timeout="2000" color="success">
        Code copied to clipboard!
        <template v-slot:actions>
          <v-btn color="white" variant="text" @click="snackbar = false">
            Close
          </v-btn>
        </template>
      </v-snackbar>
    </v-container>
  </div>
  </admin-layout>
</template>

<script setup>
import { ref } from 'vue'
import AdminLayout from './AdminLayout.vue'

const snackbar = ref(false)

// Code examples
const htmlCode = `<!-- Quendoo AI Chatbot -->
<div id="quendoo-chatbot-container" style="width: 100%; height: 600px;">
  <iframe
    id="quendoo-chatbot-iframe"
    src="https://quendoo-ai-dashboard.web.app"
    style="width: 100%; height: 100%; border: none; border-radius: 8px;"
    allow="clipboard-write"
  ></iframe>
</div>`

const jsCode = `<script>
(function() {
  const chatbotIframe = document.getElementById('quendoo-chatbot-iframe');

  // Get API key from backend/session (NEVER hardcode!)
  const quendooApiKey = '<?php echo $_SESSION['quendoo_api_key']; ?>';

  let chatbotReady = false;

  window.addEventListener('message', function(event) {
    if (event.origin !== 'https://quendoo-ai-dashboard.web.app') return;

    if (event.data.type === 'CHATBOT_READY') {
      chatbotReady = true;
      sendConfigToChatbot();
    }

    if (event.data.type === 'QUENDOO_API_KEY_RECEIVED') {
      console.log('API key received:', event.data.success);
    }
  });

  function sendConfigToChatbot() {
    if (!chatbotReady) return;

    chatbotIframe.contentWindow.postMessage({
      type: 'QUENDOO_API_KEY',
      apiKey: quendooApiKey
    }, 'https://quendoo-ai-dashboard.web.app');
  }

  chatbotIframe.addEventListener('load', function() {
    setTimeout(function() {
      if (!chatbotReady) {
        chatbotReady = true;
        sendConfigToChatbot();
      }
    }, 1000);
  });
})();
<\/script>`

const phpCode = `<?php
// admin/chatbot.php

session_start();
if (!isset($_SESSION['user_id'])) {
    header('Location: /login.php');
    exit;
}

// Retrieve user's API key from database
$userId = $_SESSION['user_id'];
$db = new PDO('mysql:host=localhost;dbname=quendoo', 'user', 'pass');
$stmt = $db->prepare('SELECT api_key, hotel_id FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

$_SESSION['quendoo_api_key'] = $user['api_key'];
$_SESSION['hotel_id'] = $user['hotel_id'];
?>

<!DOCTYPE html>
<html>
<head>
    <title>Quendoo AI Co-Pilot</title>
</head>
<body>
    <h1>Quendoo AI Co-Pilot</h1>

    <!-- Embed chatbot (see HTML code above) -->

    <!-- Integration script (see JavaScript code above) -->
</body>
</html>`

// Message protocol examples
const messageApiKey = `{
  type: 'QUENDOO_API_KEY',
  apiKey: 'qnd_xxx...'
}`

const messageConfig = `{
  type: 'QUENDOO_CONFIG',
  apiKey: 'qnd_xxx...',
  hotelId: 'hotel-123',
  userId: 'user-456'
}`

const messageChatbotReady = `{
  type: 'CHATBOT_READY'
}`

const messageApiKeyReceived = `{
  type: 'QUENDOO_API_KEY_RECEIVED',
  success: true
}`

const messageConfigReceived = `{
  type: 'QUENDOO_CONFIG_RECEIVED',
  success: true
}`

// Copy code to clipboard
const copyCode = async (code) => {
  try {
    await navigator.clipboard.writeText(code)
    snackbar.value = true
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// Download test file
const downloadTestFile = () => {
  const link = document.createElement('a')
  link.href = '/test-integration.html'
  link.download = 'quendoo-chatbot-integration-test.html'
  link.click()
}
</script>

<style scoped>
.admin-integration {
  min-height: 100vh;
  background: rgb(var(--v-theme-surface));
}

.page-header {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
}

.bg-gradient {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.bg-success {
  background: #10b981;
  color: white;
}

.bg-warning {
  background: #f59e0b;
  color: white;
}

.bg-info {
  background: #0ea5e9;
  color: white;
}

.code-block {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  font-family: 'Courier New', Courier, monospace;
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
}

.code-block-small {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}

.code-header {
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
}

.cursor-pointer {
  cursor: pointer;
}

.cursor-pointer:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

code {
  background: rgba(var(--v-theme-primary), 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 13px;
}

ol {
  line-height: 1.8;
}

ol li {
  margin-bottom: 8px;
}
</style>
