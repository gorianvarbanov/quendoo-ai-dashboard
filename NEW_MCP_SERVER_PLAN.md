# New MCP Server for Quendoo AI Dashboard

## Защо нов MCP сървър?

**Проблем със съществуващия:**
- Прекалено сложен (PostgreSQL, OAuth device flow, Supabase JWT)
- Направен за Claude Desktop, не за web dashboard
- Трудна интеграция

**Решение:**
Създаваме **нов, опростен MCP сървър** директно интегриран в Dashboard backend!

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                  Quendoo AI Dashboard Backend                    │
│                      (Node.js/Express)                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Chat Endpoints                                            │ │
│  │  - POST /chat/quendoo                                      │ │
│  │  - Conversation management (Firestore)                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Embedded MCP Server (NEW!)                                │ │
│  │                                                            │ │
│  │  ├─ Tool Registry                                         │ │
│  │  │  └─ Quendoo PMS Tools (11+ tools)                      │ │
│  │  │     ├─ get_property_settings()                         │ │
│  │  │     ├─ get_rooms_details()                             │ │
│  │  │     ├─ get_availability()                              │ │
│  │  │     ├─ update_availability()                           │ │
│  │  │     ├─ get_bookings()                                  │ │
│  │  │     ├─ get_booking_offers()                            │ │
│  │  │     └─ ... more tools                                  │ │
│  │  │                                                         │ │
│  │  ├─ Tool Executor                                         │ │
│  │  │  └─ Calls Quendoo PMS API with tenant's key           │ │
│  │  │                                                         │ │
│  │  └─ API Key Manager (Firestore)                          │ │
│  │     └─ Encrypted keys per tenant                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Claude API Integration                                    │ │
│  │  - Sends user messages                                     │ │
│  │  - Includes MCP tools in tool_choice                       │ │
│  │  - Executes tool calls                                     │ │
│  │  - Returns AI responses                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                ┌──────────────────────────────┐
                │   Quendoo PMS API             │
                │   platform.quendoo.com        │
                └──────────────────────────────┘
```

---

## Какво съдържа новият MCP сървър?

### 1. Tool Registry (Регистър на инструменти)

**Файл:** `backend/mcp-client/src/mcp/toolRegistry.js`

```javascript
/**
 * MCP Tool Registry
 * Defines all available tools for Claude to use
 */

export const quendooTools = [
  {
    name: 'get_property_settings',
    description: 'Get property settings including rooms, rates, services, meals, beds, booking modules.',
    input_schema: {
      type: 'object',
      properties: {
        api_lng: {
          type: 'string',
          description: 'Language code (e.g., "en", "bg"). Optional.',
        },
        names: {
          type: 'string',
          description: 'Comma-separated list of setting names (e.g., "rooms,rates"). Optional.',
        },
      },
    },
  },

  {
    name: 'get_rooms_details',
    description: 'Get detailed information for rooms.',
    input_schema: {
      type: 'object',
      properties: {
        api_lng: {
          type: 'string',
          description: 'Language code. Optional.',
        },
        room_id: {
          type: 'integer',
          description: 'Specific room ID. Optional (returns all rooms if omitted).',
        },
      },
    },
  },

  {
    name: 'get_availability',
    description: 'Get room availability for a date range and system (e.g., BOOKING, AIRBNB).',
    input_schema: {
      type: 'object',
      properties: {
        date_from: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        date_to: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
        sysres: {
          type: 'string',
          description: 'System/channel code (e.g., "BOOKING", "AIRBNB", "EXPEDIA")',
        },
      },
      required: ['date_from', 'date_to', 'sysres'],
    },
  },

  {
    name: 'update_availability',
    description: 'Update room availability values.',
    input_schema: {
      type: 'object',
      properties: {
        values: {
          type: 'array',
          description: 'List of availability updates',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
              room_id: { type: 'integer', description: 'Room ID' },
              availability: { type: 'integer', description: 'Number of available rooms' },
              sysres: { type: 'string', description: 'System code (e.g., BOOKING)' },
            },
            required: ['date', 'room_id', 'availability', 'sysres'],
          },
        },
      },
      required: ['values'],
    },
  },

  {
    name: 'get_bookings',
    description: 'List all bookings for the property.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'get_booking_offers',
    description: 'Fetch booking offers (pricing and availability) for specific dates.',
    input_schema: {
      type: 'object',
      properties: {
        date_from: {
          type: 'string',
          description: 'Check-in date in YYYY-MM-DD format',
        },
        nights: {
          type: 'integer',
          description: 'Number of nights',
        },
        bm_code: {
          type: 'string',
          description: 'Booking module code. Optional (auto-detects if omitted).',
        },
        api_lng: {
          type: 'string',
          description: 'Language code. Optional.',
        },
        guests: {
          type: 'array',
          description: 'Guest configuration per room. Optional.',
          items: {
            type: 'object',
            properties: {
              adults: { type: 'integer' },
              children_by_ages: {
                type: 'array',
                items: { type: 'integer' },
              },
            },
          },
        },
        currency: {
          type: 'string',
          description: 'Currency code (BGN, EUR, USD, GBP, RUB). Optional.',
        },
      },
      required: ['date_from', 'nights'],
    },
  },

  {
    name: 'ack_booking',
    description: 'Acknowledge receipt of a booking to prevent resubmission.',
    input_schema: {
      type: 'object',
      properties: {
        revision_id: {
          type: 'integer',
          description: 'Booking revision ID to acknowledge',
        },
        booking_items: {
          type: 'array',
          description: 'Optional list of booking items with external IDs',
          items: {
            type: 'object',
            properties: {
              booking_item_id: { type: 'integer' },
              ext_reservation_id: { type: 'string' },
            },
          },
        },
      },
      required: ['revision_id'],
    },
  },

  {
    name: 'post_room_assignment',
    description: 'Assign room numbers and self check-in codes to booking items.',
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'List of room assignments',
          items: {
            type: 'object',
            properties: {
              booking_item_id: { type: 'integer', description: 'Booking item ID' },
              room_number: { type: 'string', description: 'Physical room number' },
              self_checkin_code: { type: 'string', description: 'Self check-in code. Optional.' },
            },
            required: ['booking_item_id', 'room_number'],
          },
        },
      },
      required: ['items'],
    },
  },
];

export function getToolByName(name) {
  return quendooTools.find((tool) => tool.name === name);
}

export function getAllTools() {
  return quendooTools;
}
```

---

### 2. Quendoo API Client

**Файл:** `backend/mcp-client/src/mcp/quendooClient.js`

```javascript
/**
 * Quendoo PMS API Client
 * Simple HTTP client for calling Quendoo API endpoints
 */
import axios from 'axios';

const DEFAULT_BASE_URL = 'https://www.platform.quendoo.com/api/pms/v1';

export class QuendooClient {
  constructor(apiKey, baseUrl = null, apiLang = null) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, ''); // Remove trailing slash
    this.defaultLang = apiLang;
  }

  /**
   * Build query parameters with API key
   */
  _buildParams(extraParams = {}) {
    const params = {
      api_key: this.apiKey,
      ...extraParams,
    };

    if (this.defaultLang) {
      params.api_lng = this.defaultLang;
    }

    // Remove null/undefined values
    Object.keys(params).forEach((key) => {
      if (params[key] === null || params[key] === undefined) {
        delete params[key];
      }
    });

    return params;
  }

  /**
   * GET request to Quendoo API
   */
  async get(path, params = {}) {
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await axios.get(url, {
        params: this._buildParams(params),
        timeout: 15000,
      });

      return response.data;
    } catch (error) {
      throw new Error(
        `Quendoo API request failed: ${error.response?.status} ${error.response?.statusText || error.message}`
      );
    }
  }

  /**
   * POST request to Quendoo API
   */
  async post(path, data = {}, params = {}) {
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await axios.post(url, data, {
        params: this._buildParams(params),
        timeout: 30000,
      });

      return response.data;
    } catch (error) {
      throw new Error(
        `Quendoo API request failed: ${error.response?.status} ${error.response?.statusText || error.message}`
      );
    }
  }
}
```

---

### 3. Tool Executor

**Файл:** `backend/mcp-client/src/mcp/toolExecutor.js`

```javascript
/**
 * MCP Tool Executor
 * Executes tool calls by mapping them to Quendoo API endpoints
 */
import { QuendooClient } from './quendooClient.js';
import { getToolByName } from './toolRegistry.js';

export class ToolExecutor {
  constructor(apiKey) {
    this.client = new QuendooClient(apiKey);
  }

  /**
   * Execute a tool call
   */
  async executeTool(toolName, toolInput) {
    const tool = getToolByName(toolName);

    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    console.log(`[Tool Executor] Executing: ${toolName}`, toolInput);

    // Map tool name to Quendoo API endpoint
    switch (toolName) {
      case 'get_property_settings':
        return this.client.get('/Property/getPropertySettings', {
          api_lng: toolInput.api_lng,
          names: toolInput.names,
        });

      case 'get_rooms_details':
        return this.client.get('/Property/getRoomsDetails', {
          api_lng: toolInput.api_lng,
          room_id: toolInput.room_id,
        });

      case 'get_availability':
        return this.client.get('/Availability/getAvailability', {
          date_from: toolInput.date_from,
          date_to: toolInput.date_to,
          sysres: toolInput.sysres,
        });

      case 'update_availability':
        return this.client.post('/Availability/updateAvailability', {
          values: toolInput.values,
        });

      case 'get_bookings':
        return this.client.get('/Booking/getBookings');

      case 'get_booking_offers':
        return this._getBookingOffers(toolInput);

      case 'ack_booking':
        return this.client.post('/Booking/ackBooking', {
          revision_id: toolInput.revision_id,
          booking_items: toolInput.booking_items,
        });

      case 'post_room_assignment':
        return this.client.post('/Booking/postRoomAssignment', {
          items: toolInput.items,
        });

      default:
        throw new Error(`Tool not implemented: ${toolName}`);
    }
  }

  /**
   * Get booking offers (with auto-detection of booking module)
   */
  async _getBookingOffers(input) {
    let bmCode = input.bm_code;

    // Auto-detect booking module if not provided
    if (!bmCode) {
      const settings = await this.client.get('/Property/getPropertySettings', {
        names: 'booking_modules',
      });

      const bookingModules = settings.data?.booking_modules;
      if (bookingModules && bookingModules.length > 0) {
        bmCode = bookingModules[0].code;
        console.log(`[Tool Executor] Auto-detected booking module: ${bmCode}`);
      } else {
        throw new Error('No booking modules found. Please configure booking modules in Quendoo.');
      }
    }

    return this.client.get('/Property/getBookingOffers', {
      bm_code: bmCode,
      date_from: input.date_from,
      nights: input.nights,
      api_lng: input.api_lng,
      guests: input.guests,
      currency: input.currency,
    });
  }
}
```

---

### 4. API Key Manager (Firestore)

**Файл:** `backend/mcp-client/src/mcp/apiKeyManager.js`

```javascript
/**
 * API Key Manager for MCP Server
 * Stores encrypted API keys in Firestore per tenant
 */
import { getFirestore, COLLECTIONS } from '../db/firestore.js';
import { encryptionManager } from '../security/encryption.js';

/**
 * Save API key for a tenant
 */
export async function saveApiKey(tenantId, keyName, keyValue) {
  if (!keyName || !keyValue) {
    throw new Error('keyName and keyValue are required');
  }

  const db = await getFirestore();

  // Encrypt the API key
  const encryptedValue = encryptionManager.encrypt(keyValue);

  // Store in Firestore: api_keys/{tenantId}/keys/{keyName}
  const keyRef = db
    .collection('api_keys')
    .doc(tenantId)
    .collection('keys')
    .doc(keyName);

  await keyRef.set({
    keyName,
    encryptedValue,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`[API Key Manager] Saved key '${keyName}' for tenant ${tenantId}`);

  return {
    success: true,
    message: `API key '${keyName}' saved successfully`,
  };
}

/**
 * Get decrypted API key for a tenant
 */
export async function getApiKey(tenantId, keyName) {
  const db = await getFirestore();

  const keyRef = db
    .collection('api_keys')
    .doc(tenantId)
    .collection('keys')
    .doc(keyName);

  const doc = await keyRef.get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data();

  if (!data.isActive) {
    return null;
  }

  try {
    // Decrypt and return
    return encryptionManager.decrypt(data.encryptedValue);
  } catch (error) {
    console.error(`[API Key Manager] Error decrypting key '${keyName}':`, error);
    return null;
  }
}

/**
 * List all API keys for a tenant (without decrypting)
 */
export async function listApiKeys(tenantId) {
  const db = await getFirestore();

  const keysSnapshot = await db
    .collection('api_keys')
    .doc(tenantId)
    .collection('keys')
    .where('isActive', '==', true)
    .get();

  return keysSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      keyName: data.keyName,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });
}

/**
 * Delete (soft delete) an API key
 */
export async function deleteApiKey(tenantId, keyName) {
  const db = await getFirestore();

  const keyRef = db
    .collection('api_keys')
    .doc(tenantId)
    .collection('keys')
    .doc(keyName);

  const doc = await keyRef.get();

  if (!doc.exists) {
    return {
      success: false,
      message: `API key '${keyName}' not found`,
    };
  }

  // Soft delete
  await keyRef.update({
    isActive: false,
    updatedAt: new Date(),
  });

  console.log(`[API Key Manager] Deleted key '${keyName}' for tenant ${tenantId}`);

  return {
    success: true,
    message: `API key '${keyName}' deleted successfully`,
  };
}
```

---

### 5. MCP Integration with Claude

**Файл:** `backend/mcp-client/src/mcp/mcpClaudeIntegration.js`

```javascript
/**
 * MCP + Claude Integration
 * Connects Claude API with MCP tools
 */
import Anthropic from '@anthropic-ai/sdk';
import { getAllTools } from './toolRegistry.js';
import { ToolExecutor } from './toolExecutor.js';
import { getApiKey } from './apiKeyManager.js';

export class MCPClaudeIntegration {
  constructor(anthropicApiKey) {
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
  }

  /**
   * Send message to Claude with MCP tools
   */
  async sendMessage(tenantId, userMessage, conversationHistory = [], model = 'claude-3-5-sonnet-20241022') {
    // Get tenant's Quendoo API key
    const quendooApiKey = await getApiKey(tenantId, 'QUENDOO_API_KEY');

    if (!quendooApiKey) {
      throw new Error('QUENDOO_API_KEY not configured. Please add it in Settings.');
    }

    // Create tool executor with tenant's API key
    const toolExecutor = new ToolExecutor(quendooApiKey);

    // Get all available tools
    const tools = getAllTools();

    // Build messages array
    const messages = [
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    // Initial Claude API call
    let response = await this.anthropic.messages.create({
      model,
      max_tokens: 4096,
      tools,
      messages,
    });

    console.log(`[MCP Claude] Initial response - Stop reason: ${response.stop_reason}`);

    // Handle tool calls (agentic loop)
    let iterations = 0;
    const maxIterations = 10;

    while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
      iterations++;

      // Extract tool calls from response
      const toolCalls = response.content.filter((block) => block.type === 'tool_use');

      console.log(`[MCP Claude] Iteration ${iterations}: ${toolCalls.length} tool calls`);

      // Execute all tool calls
      const toolResults = [];

      for (const toolCall of toolCalls) {
        try {
          console.log(`[MCP Claude] Executing tool: ${toolCall.name}`);

          const result = await toolExecutor.executeTool(toolCall.name, toolCall.input);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          console.error(`[MCP Claude] Tool execution error:`, error);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: JSON.stringify({ error: error.message }),
            is_error: true,
          });
        }
      }

      // Add assistant response and tool results to messages
      messages.push({
        role: 'assistant',
        content: response.content,
      });

      messages.push({
        role: 'user',
        content: toolResults,
      });

      // Continue conversation with tool results
      response = await this.anthropic.messages.create({
        model,
        max_tokens: 4096,
        tools,
        messages,
      });

      console.log(`[MCP Claude] Iteration ${iterations} - Stop reason: ${response.stop_reason}`);
    }

    // Extract final text response
    const textBlocks = response.content.filter((block) => block.type === 'text');
    const finalResponse = textBlocks.map((block) => block.text).join('\n');

    // Extract tools used
    const toolsUsed = [];
    for (const msg of messages) {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const toolUses = msg.content.filter((block) => block.type === 'tool_use');
        toolsUsed.push(...toolUses.map((t) => t.name));
      }
    }

    return {
      content: finalResponse,
      toolsUsed: [...new Set(toolsUsed)], // Unique tools
      iterations,
    };
  }
}
```

---

### 6. Chat Endpoint Integration

**Файл:** `backend/mcp-client/src/index.js` (модифициран)

```javascript
import { MCPClaudeIntegration } from './mcp/mcpClaudeIntegration.js';
import { authenticateToken } from './auth/jwtAuth.js';
import * as conversationService from './db/conversationService.js';
import { inputValidator, outputFilter, securityMonitor } from './security/index.js';

// Initialize MCP+Claude integration
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const mcpClaude = new MCPClaudeIntegration(anthropicApiKey);

/**
 * Chat endpoint with MCP tools
 */
app.post('/chat/quendoo', authenticateToken, async (req, res) => {
  try {
    const { message, conversationId, model } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    // Input validation
    const validation = inputValidator.validateInput(message);
    if (validation.blocked) {
      securityMonitor.logSecurityEvent({
        type: 'INPUT_BLOCKED',
        userId,
        tenantId,
        conversationId,
        reason: validation.reason,
      });
      return res.status(400).json({ error: 'Invalid input' });
    }

    // Get conversation history
    const conversation = await conversationService.getConversationWithMessages(conversationId);
    const conversationHistory = conversation.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Send to Claude with MCP tools
    const response = await mcpClaude.sendMessage(
      tenantId,
      message,
      conversationHistory,
      model || 'claude-3-5-sonnet-20241022'
    );

    // Output filtering
    const filtered = outputFilter.filterResponse(response.content);

    // Save assistant message to Firestore
    await conversationService.addMessage(conversationId, {
      role: 'assistant',
      content: filtered.content,
      metadata: {
        model,
        toolsUsed: response.toolsUsed,
        iterations: response.iterations,
      },
    });

    res.json({
      status: 'success',
      response: {
        content: filtered.content,
        toolsUsed: response.toolsUsed,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Chat] Error:', error);

    // Check if it's API key error
    if (error.message.includes('QUENDOO_API_KEY not configured')) {
      return res.status(400).json({
        error: 'Quendoo API key not configured',
        message: 'Please add your Quendoo API key in Admin Settings to use hotel management features.',
      });
    }

    res.status(500).json({ error: 'Failed to process message' });
  }
});
```

---

### 7. API Key Management Endpoints

**Файл:** `backend/mcp-client/src/index.js` (добавяме)

```javascript
import * as apiKeyManager from './mcp/apiKeyManager.js';

/**
 * Get all API keys for current tenant
 */
app.get('/admin/api-keys', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const keys = await apiKeyManager.listApiKeys(tenantId);
    res.json({ keys });
  } catch (error) {
    console.error('[Admin] Error listing keys:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

/**
 * Save/update API key
 */
app.post('/admin/api-keys', authenticateToken, async (req, res) => {
  try {
    const { keyName, keyValue } = req.body;
    const tenantId = req.user.tenantId;

    const result = await apiKeyManager.saveApiKey(tenantId, keyName, keyValue);
    res.json(result);
  } catch (error) {
    console.error('[Admin] Error saving key:', error);
    res.status(500).json({ error: 'Failed to save API key' });
  }
});

/**
 * Delete API key
 */
app.delete('/admin/api-keys/:keyName', authenticateToken, async (req, res) => {
  try {
    const { keyName } = req.params;
    const tenantId = req.user.tenantId;

    const result = await apiKeyManager.deleteApiKey(tenantId, keyName);
    res.json(result);
  } catch (error) {
    console.error('[Admin] Error deleting key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});
```

---

## Какво трябва да направим?

### Стъпка 1: Създаване на MCP модули (1-2 дни)

1. **Създай директория:**
   ```bash
   mkdir backend/mcp-client/src/mcp
   ```

2. **Създай файловете:**
   - `toolRegistry.js` - Регистър на всички tools
   - `quendooClient.js` - HTTP client за Quendoo API
   - `toolExecutor.js` - Изпълнява tool calls
   - `apiKeyManager.js` - API key management (Firestore)
   - `mcpClaudeIntegration.js` - Интеграция Claude + MCP tools

### Стъпка 2: Модифициране на Chat Endpoint (1 ден)

1. **Модифицирай `/chat/quendoo`:**
   - Използвай `MCPClaudeIntegration` вместо директно Claude API
   - Подавай `tenantId` за API key retrieval
   - Обработвай tool execution errors

### Стъпка 3: Encryption Module (1 ден)

**Създай:** `backend/mcp-client/src/security/encryption.js`

```javascript
/**
 * Encryption Manager
 * AES-256-GCM encryption for API keys
 */
import crypto from 'crypto';

class EncryptionManager {
  constructor() {
    // Use JWT_SECRET as master key (or separate ENCRYPTION_KEY)
    const masterKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;

    if (!masterKey || masterKey.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters');
    }

    // Derive 256-bit key
    this.key = crypto.scryptSync(masterKey, 'quendoo-salt', 32);
  }

  encrypt(plaintext) {
    if (!plaintext) {
      throw new Error('Plaintext cannot be empty');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Combine: IV + AuthTag + Ciphertext (all hex encoded)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(ciphertext) {
    if (!ciphertext) {
      throw new Error('Ciphertext cannot be empty');
    }

    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid ciphertext format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
}

export const encryptionManager = new EncryptionManager();
```

### Стъпка 4: Testing (2-3 дни)

1. **Unit Tests:**
   - Test QuendooClient API calls
   - Test ToolExecutor for all tools
   - Test encryption/decryption

2. **Integration Tests:**
   - Test end-to-end chat flow
   - Test tool execution with real Quendoo API
   - Test multi-tenant isolation

3. **Manual Testing:**
   - Test in UI with different tool scenarios

---

## Firestore Structure

```
api_keys/
  {tenantId}/
    keys/
      QUENDOO_API_KEY/
        keyName: "QUENDOO_API_KEY"
        encryptedValue: "encrypted-string"
        isActive: true
        createdAt: timestamp
        updatedAt: timestamp

      ANTHROPIC_API_KEY/
        keyName: "ANTHROPIC_API_KEY"
        encryptedValue: "encrypted-string"
        isActive: true
        createdAt: timestamp
        updatedAt: timestamp
```

---

## Environment Variables

```bash
# backend/mcp-client/.env

# Claude API
ANTHROPIC_API_KEY=sk-ant-api03-...

# Encryption (for API keys in Firestore)
ENCRYPTION_KEY=<generate-random-32-char-string>

# Or reuse JWT secret
# JWT_SECRET=<32-char-secret>

# Firestore
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

# Server
PORT=8080
NODE_ENV=production
```

---

## Предимства на новия MCP сървър:

1. ✅ **Много по-прост** - Само Node.js, без Python/PostgreSQL
2. ✅ **Firestore за всичко** - Не трябва втора база данни
3. ✅ **Вграден в backend** - Едно deployment, по-бързо
4. ✅ **Лесна интеграция** - Директно в `/chat/quendoo` endpoint
5. ✅ **Multi-tenant готов** - Използва `tenantId` от JWT
6. ✅ **Същите tools като MCP** - Всички 11+ Quendoo tools
7. ✅ **Encrypted API keys** - AES-256-GCM в Firestore
8. ✅ **Независим** - Не зависи от external MCP server

---

## Timeline

| Стъпка | Задачи | Време |
|--------|--------|-------|
| **Ден 1** | Създай toolRegistry.js, quendooClient.js | 1 ден |
| **Ден 2** | Създай toolExecutor.js, apiKeyManager.js | 1 ден |
| **Ден 3** | Създай mcpClaudeIntegration.js, encryption.js | 1 ден |
| **Ден 4** | Модифицирай /chat/quendoo endpoint | 1 ден |
| **Ден 5-7** | Testing, debugging, docs | 3 дни |

**Total: 1 седмица (7 дни)** 🚀

---

## Готов ли си да започнем?

Нека стартираме със създаването на първите файлове:
1. `toolRegistry.js` - Дефиниция на всички tools
2. `quendooClient.js` - HTTP client

Да започваме? 💪
