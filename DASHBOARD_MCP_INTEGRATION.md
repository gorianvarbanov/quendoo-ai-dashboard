# Dashboard to Python MCP Server Integration

## Overview

This document shows how to integrate the existing Node.js backend with the new standalone Python MCP server.

## Architecture Flow

```
Frontend (Vue.js)
    ↓ HTTP Request (message + conversationId)
Backend (Node.js Express)
    ↓ Establish MCP connection with tenant context
Python MCP Server (FastAPI)
    ↓ Execute Quendoo tools with tenant's API key
Quendoo PMS API
```

## Backend Changes Required

### 1. New MCP Client Module

Create: `backend/mcp-client/src/mcp/pythonMcpClient.js`

```javascript
const axios = require('axios');

class PythonMCPClient {
  constructor(mcpServerUrl, tenantId) {
    this.mcpServerUrl = mcpServerUrl || process.env.PYTHON_MCP_SERVER_URL;
    this.tenantId = tenantId;
    this.connectionId = null;
    this.jwtToken = process.env.MCP_JWT_TOKEN; // For authentication
  }

  /**
   * Establish connection with MCP server
   * Returns connection_id to use for tool calls
   */
  async connect() {
    try {
      const response = await axios.post(
        `${this.mcpServerUrl}/mcp/connect`,
        {
          tenant_id: this.tenantId,
          metadata: {
            source: 'quendoo-dashboard',
            timestamp: new Date().toISOString()
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      this.connectionId = response.data.connection_id;
      console.log(`[MCP Client] Connected to MCP server: ${this.connectionId}`);

      return this.connectionId;
    } catch (error) {
      console.error('[MCP Client] Failed to connect to MCP server:', error.message);
      throw new Error('MCP connection failed');
    }
  }

  /**
   * Execute a tool via MCP server
   * @param {string} toolName - Name of the tool (e.g., 'get_availability')
   * @param {object} toolArgs - Tool arguments
   */
  async executeTool(toolName, toolArgs) {
    if (!this.connectionId) {
      await this.connect();
    }

    try {
      const response = await axios.post(
        `${this.mcpServerUrl}/mcp/tools/execute`,
        {
          connection_id: this.connectionId,
          tool_name: toolName,
          tool_args: toolArgs
        },
        {
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.result;
    } catch (error) {
      console.error(`[MCP Client] Tool execution failed: ${toolName}`, error.message);

      if (error.response?.status === 404) {
        throw new Error(`Tool not found: ${toolName}`);
      } else if (error.response?.status === 401) {
        throw new Error('MCP authentication failed');
      } else if (error.response?.status === 500) {
        throw new Error(`Tool execution error: ${error.response.data.detail}`);
      }

      throw error;
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect() {
    if (this.connectionId) {
      try {
        await axios.post(
          `${this.mcpServerUrl}/mcp/disconnect`,
          { connection_id: this.connectionId },
          {
            headers: {
              'Authorization': `Bearer ${this.jwtToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log(`[MCP Client] Disconnected: ${this.connectionId}`);
      } catch (error) {
        console.error('[MCP Client] Disconnect failed:', error.message);
      } finally {
        this.connectionId = null;
      }
    }
  }

  /**
   * List all available tools from MCP server
   */
  async listTools() {
    try {
      const response = await axios.get(
        `${this.mcpServerUrl}/mcp/tools/list`,
        {
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`
          }
        }
      );

      return response.data.tools;
    } catch (error) {
      console.error('[MCP Client] Failed to list tools:', error.message);
      throw error;
    }
  }
}

module.exports = { PythonMCPClient };
```

### 2. Modified Claude Integration

Update: `backend/mcp-client/src/quendooClaudeIntegration.js`

Add Python MCP client integration:

```javascript
const { PythonMCPClient } = require('./mcp/pythonMcpClient');

class ClaudeIntegration {
  constructor() {
    this.pythonMcp = null;
  }

  /**
   * Initialize MCP connection for tenant
   */
  async initializeMCP(tenantId) {
    this.pythonMcp = new PythonMCPClient(
      process.env.PYTHON_MCP_SERVER_URL,
      tenantId
    );
    await this.pythonMcp.connect();
  }

  /**
   * Handle tool calls from Claude via Python MCP
   */
  async handleToolCall(toolUse) {
    const { name, input } = toolUse;

    console.log(`[Claude Integration] Executing tool via Python MCP: ${name}`);

    try {
      // Execute tool through Python MCP server
      const result = await this.pythonMcp.executeTool(name, input);

      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result, null, 2)
      };
    } catch (error) {
      console.error(`[Claude Integration] Tool execution failed: ${name}`, error);

      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify({
          error: error.message,
          tool: name
        }),
        is_error: true
      };
    }
  }

  /**
   * Main chat method - now with Python MCP integration
   */
  async chat(message, conversationHistory = [], tenantId = 'default') {
    // Initialize MCP connection for this tenant
    await this.initializeMCP(tenantId);

    // Get available tools from Python MCP
    const availableTools = await this.pythonMcp.listTools();

    // Build messages for Claude
    const messages = [
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // Call Claude API with tools
    const response = await this.callClaude({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: process.env.SYSTEM_PROMPT || 'You are a helpful hotel management assistant.',
      messages: messages,
      tools: availableTools // Tools from Python MCP
    });

    // Handle tool calls if present
    if (response.stop_reason === 'tool_use') {
      const toolResults = [];

      for (const content of response.content) {
        if (content.type === 'tool_use') {
          const toolResult = await this.handleToolCall(content);
          toolResults.push(toolResult);
        }
      }

      // Send tool results back to Claude
      const followUpMessages = [
        ...messages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults }
      ];

      const finalResponse = await this.callClaude({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: process.env.SYSTEM_PROMPT,
        messages: followUpMessages,
        tools: availableTools
      });

      // Disconnect MCP after conversation
      await this.pythonMcp.disconnect();

      return {
        message: this.extractTextContent(finalResponse.content),
        usage: finalResponse.usage
      };
    }

    // No tool calls - just return text response
    await this.pythonMcp.disconnect();

    return {
      message: this.extractTextContent(response.content),
      usage: response.usage
    };
  }

  /**
   * Extract text content from Claude response
   */
  extractTextContent(content) {
    if (Array.isArray(content)) {
      return content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');
    }
    return content;
  }

  /**
   * Call Claude API
   */
  async callClaude(params) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    return await response.json();
  }
}

module.exports = { ClaudeIntegration };
```

### 3. Update Main Express Endpoint

Modify: `backend/mcp-client/src/index.js`

```javascript
const { ClaudeIntegration } = require('./quendooClaudeIntegration');

app.post('/chat/quendoo', async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    // TODO: Get tenant ID from authenticated user session
    // For now using 'default', but should come from JWT token or session
    const tenantId = req.user?.tenantId || 'default';

    console.log(`[Chat] Processing message for tenant: ${tenantId}`);

    // Get conversation history from database
    const messages = await conversationService.getMessages(conversationId);
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Use Claude Integration with Python MCP
    const claudeIntegration = new ClaudeIntegration();
    const response = await claudeIntegration.chat(
      message,
      conversationHistory,
      tenantId
    );

    // Save messages to database
    await conversationService.addMessage(conversationId, {
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    await conversationService.addMessage(conversationId, {
      role: 'assistant',
      content: response.message,
      timestamp: new Date()
    });

    res.json({
      message: response.message,
      conversationId: conversationId
    });

  } catch (error) {
    console.error('[Chat] Error:', error);
    res.status(500).json({ error: 'Chat processing failed' });
  }
});
```

### 4. Environment Variables

Add to `backend/mcp-client/.env`:

```bash
# Python MCP Server
PYTHON_MCP_SERVER_URL=https://quendoo-mcp-server-xxxxx.run.app
MCP_JWT_TOKEN=your-secret-jwt-token-here

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-xxxxx

# System Prompt (server-controlled)
SYSTEM_PROMPT="You are a specialized AI assistant for Quendoo hotel management system. You can help with room availability, bookings, property settings, and guest management. Use the available tools to access real-time data from the Quendoo PMS API."
```

## Admin API Key Management

Add endpoints for managing tenant API keys:

### 5. Admin API Key Endpoints

Add to `backend/mcp-client/src/index.js`:

```javascript
/**
 * Save tenant's Quendoo API key (encrypted on MCP server)
 */
app.post('/admin/api-keys', async (req, res) => {
  try {
    const { tenantId, keyName, keyValue } = req.body;

    // Forward to Python MCP server for encrypted storage
    const response = await axios.post(
      `${process.env.PYTHON_MCP_SERVER_URL}/admin/api-keys`,
      {
        tenant_id: tenantId,
        key_name: keyName,
        key_value: keyValue
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.MCP_JWT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      message: 'API key saved successfully (encrypted)'
    });

  } catch (error) {
    console.error('[Admin] Failed to save API key:', error);
    res.status(500).json({ error: 'Failed to save API key' });
  }
});

/**
 * List tenant's API keys (without values)
 */
app.get('/admin/api-keys/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const response = await axios.get(
      `${process.env.PYTHON_MCP_SERVER_URL}/admin/api-keys/${tenantId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.MCP_JWT_TOKEN}`
        }
      }
    );

    res.json(response.data);

  } catch (error) {
    console.error('[Admin] Failed to list API keys:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

/**
 * Delete tenant's API key
 */
app.delete('/admin/api-keys/:tenantId/:keyName', async (req, res) => {
  try {
    const { tenantId, keyName } = req.params;

    await axios.delete(
      `${process.env.PYTHON_MCP_SERVER_URL}/admin/api-keys/${tenantId}/${keyName}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.MCP_JWT_TOKEN}`
        }
      }
    );

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });

  } catch (error) {
    console.error('[Admin] Failed to delete API key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});
```

## Frontend Admin UI for API Keys

### 6. New Admin View for API Key Management

Create: `frontend/src/views/admin/AdminApiKeys.vue`

```vue
<template>
  <v-container>
    <v-card>
      <v-card-title>
        <span class="text-h5">Quendoo API Key Management</span>
      </v-card-title>

      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-4">
          API keys are encrypted and stored securely on the MCP server.
        </v-alert>

        <!-- Current API Keys -->
        <v-list v-if="apiKeys.length > 0">
          <v-list-item
            v-for="key in apiKeys"
            :key="key.key_name"
          >
            <template v-slot:prepend>
              <v-icon>mdi-key</v-icon>
            </template>

            <v-list-item-title>{{ key.key_name }}</v-list-item-title>
            <v-list-item-subtitle>
              Created: {{ formatDate(key.created_at) }}
            </v-list-item-subtitle>

            <template v-slot:append>
              <v-btn
                icon="mdi-delete"
                variant="text"
                color="error"
                @click="deleteApiKey(key.key_name)"
              />
            </template>
          </v-list-item>
        </v-list>

        <v-alert v-else type="warning" variant="tonal" class="my-4">
          No API keys configured. Add your Quendoo API key below.
        </v-alert>

        <!-- Add New API Key -->
        <v-divider class="my-4" />

        <v-form @submit.prevent="saveApiKey">
          <v-text-field
            v-model="newKeyName"
            label="Key Name"
            hint="e.g., QUENDOO_API_KEY"
            persistent-hint
            required
            class="mb-4"
          />

          <v-text-field
            v-model="newKeyValue"
            label="API Key Value"
            type="password"
            hint="Your Quendoo API key (will be encrypted)"
            persistent-hint
            required
            class="mb-4"
          />

          <v-btn
            type="submit"
            color="primary"
            :loading="saving"
            :disabled="!newKeyName || !newKeyValue"
          >
            Save API Key
          </v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const apiKeys = ref([]);
const newKeyName = ref('QUENDOO_API_KEY');
const newKeyValue = ref('');
const saving = ref(false);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

onMounted(async () => {
  await loadApiKeys();
});

async function loadApiKeys() {
  try {
    // TODO: Get tenant ID from auth store
    const tenantId = 'default';

    const response = await axios.get(`${API_BASE_URL}/admin/api-keys/${tenantId}`);
    apiKeys.value = response.data.keys;
  } catch (error) {
    console.error('Failed to load API keys:', error);
  }
}

async function saveApiKey() {
  saving.value = true;

  try {
    const tenantId = 'default'; // TODO: Get from auth store

    await axios.post(`${API_BASE_URL}/admin/api-keys`, {
      tenantId: tenantId,
      keyName: newKeyName.value,
      keyValue: newKeyValue.value
    });

    // Clear form
    newKeyValue.value = '';

    // Reload keys
    await loadApiKeys();

    alert('API key saved successfully!');
  } catch (error) {
    console.error('Failed to save API key:', error);
    alert('Failed to save API key. Please try again.');
  } finally {
    saving.value = false;
  }
}

async function deleteApiKey(keyName) {
  if (!confirm(`Delete API key "${keyName}"?`)) {
    return;
  }

  try {
    const tenantId = 'default'; // TODO: Get from auth store

    await axios.delete(`${API_BASE_URL}/admin/api-keys/${tenantId}/${keyName}`);

    await loadApiKeys();

    alert('API key deleted successfully!');
  } catch (error) {
    console.error('Failed to delete API key:', error);
    alert('Failed to delete API key. Please try again.');
  }
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString();
}
</script>
```

## Complete Integration Flow

```
1. User sends message in chat
   → Frontend: POST /chat/quendoo { message, conversationId }

2. Backend receives request
   → Extracts tenantId from session/JWT (currently 'default')
   → Creates ClaudeIntegration instance
   → Calls claudeIntegration.chat(message, history, tenantId)

3. Claude Integration initializes MCP
   → Creates PythonMCPClient(mcpServerUrl, tenantId)
   → Calls pythonMcp.connect()
   → Python MCP Server: POST /mcp/connect { tenant_id, metadata }
   → Returns connection_id
   → Stores connection_id → tenant_id mapping

4. Get available tools
   → pythonMcp.listTools()
   → Python MCP Server: GET /mcp/tools/list
   → Returns all 11+ Quendoo tools

5. Call Claude API with tools
   → Anthropic API with tools array
   → Claude decides to use tool (e.g., "get_availability")

6. Execute tool via MCP
   → pythonMcp.executeTool('get_availability', { property_id, dates })
   → Python MCP Server: POST /mcp/tools/execute
   → MCP looks up tenant_id from connection_id
   → MCP gets encrypted QUENDOO_API_KEY for tenant
   → MCP calls Quendoo API with tenant's key
   → Returns result

7. Send tool result back to Claude
   → Claude generates natural language response

8. Return to user
   → Save messages to Firestore
   → Send response to frontend
   → Disconnect MCP connection

9. User sees response in chat UI
```

## Deployment Checklist

### Python MCP Server
- [ ] Deploy to Cloud Run: `quendoo-mcp-server`
- [ ] Set environment variables (ENCRYPTION_KEY, DATABASE_URL, JWT_SECRET)
- [ ] Create PostgreSQL database on Cloud SQL
- [ ] Run database migrations
- [ ] Test endpoints with curl

### Node.js Backend
- [ ] Add PYTHON_MCP_SERVER_URL environment variable
- [ ] Add MCP_JWT_TOKEN environment variable
- [ ] Install axios if not already installed: `npm install axios`
- [ ] Create `mcp/pythonMcpClient.js` file
- [ ] Update `quendooClaudeIntegration.js`
- [ ] Add admin API key endpoints to `index.js`
- [ ] Redeploy to Cloud Run

### Frontend
- [ ] Create `AdminApiKeys.vue` component
- [ ] Add route to admin router: `/admin/api-keys`
- [ ] Add navigation link in admin dashboard
- [ ] Build and deploy to Firebase Hosting

## Testing

### 1. Test MCP Connection
```bash
curl -X POST https://quendoo-mcp-server-xxxxx.run.app/mcp/connect \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-tenant-123",
    "metadata": {
      "source": "test"
    }
  }'

# Should return: { "connection_id": "conn_xxxxx" }
```

### 2. Test Save API Key
```bash
curl -X POST https://quendoo-mcp-server-xxxxx.run.app/admin/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-tenant-123",
    "key_name": "QUENDOO_API_KEY",
    "key_value": "your-actual-quendoo-api-key"
  }'
```

### 3. Test Tool Execution
```bash
curl -X POST https://quendoo-mcp-server-xxxxx.run.app/mcp/tools/execute \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "connection_id": "conn_xxxxx",
    "tool_name": "get_property_settings",
    "tool_args": {
      "property_id": "12345"
    }
  }'
```

### 4. Test End-to-End from Dashboard
1. Go to admin panel → API Keys
2. Add QUENDOO_API_KEY
3. Go to chat
4. Send message: "What rooms are available for March 15-18?"
5. Check that Claude uses tools and returns real data
6. Check backend logs for MCP connection
7. Check Python MCP logs for tool execution

## Security Considerations

1. **JWT Token:** Generate strong JWT secret:
   ```bash
   openssl rand -base64 32
   ```

2. **Encryption Key:** Generate strong encryption key:
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

3. **API Key Storage:**
   - Never log decrypted API keys
   - Never return decrypted keys to frontend
   - Only MCP server has access to encryption key

4. **Tenant Isolation:**
   - Always validate tenant_id in every request
   - Connection IDs are single-tenant only
   - No cross-tenant data leakage

## Monitoring

### Logs to Watch

**Cloud Run (Python MCP):**
- Connection registrations
- Tool executions
- Quendoo API calls
- Encryption/decryption operations

**Cloud Run (Node.js Backend):**
- MCP connection attempts
- Tool call requests
- Claude API calls

**Frontend:**
- Failed tool executions
- API key save/delete operations

## Next Steps

After integration is complete:

1. **User Authentication:** Implement proper JWT-based authentication so each hotel/user has their own tenant_id
2. **Usage Tracking:** Log tool usage per tenant for billing/analytics
3. **Rate Limiting:** Add per-tenant rate limits on MCP server
4. **Multi-region:** Deploy MCP server to multiple regions for low latency
5. **Monitoring Dashboard:** Create admin view showing tool usage statistics per tenant
