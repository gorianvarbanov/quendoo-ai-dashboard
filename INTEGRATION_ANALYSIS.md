# Quendoo AI Dashboard + MCP Server Integration Analysis

## Executive Summary

After analyzing both codebases, I've discovered that **the MCP server already has a complete, production-ready API key management system** that we can leverage for the Quendoo AI Dashboard. Instead of building a new system from scratch, we should **integrate the existing MCP infrastructure** into the dashboard.

---

## Current MCP Server Architecture

### Multi-Tenant System

The MCP server uses a sophisticated multi-tenant architecture:

```
User → Tenant → API Keys (Encrypted)
  ↓       ↓         ↓
JWT     UUID    AES-256 Encrypted Values
Auth   Context   (QUENDOO_API_KEY, etc.)
```

**Key Components:**

1. **PostgreSQL Database** with SQLAlchemy ORM
   - `users` table - User accounts with email/password
   - `tenants` table - One tenant per user
   - `api_keys` table - Encrypted API keys per tenant
   - `sessions` table - JWT session tracking
   - `device_sessions` - Long-lived device authentication
   - `device_codes` - OAuth device flow for passwordless auth

2. **Encryption System** (`security/encryption.py`)
   - Uses Fernet (AES-256-GCM)
   - Derives encryption key from JWT_PRIVATE_KEY via PBKDF2
   - 100,000 iterations for security
   - Automatic encrypt/decrypt on storage/retrieval

3. **API Key Manager** (`api_key_manager_v2.py`)
   - `save_api_key(tenant_id, key_name, key_value)` - Store encrypted key
   - `get_api_key(tenant_id, key_name)` - Retrieve decrypted key
   - `list_api_keys(tenant_id)` - List keys without values
   - `delete_api_key(tenant_id, key_name)` - Soft delete

4. **Authentication** (`security/auth.py`)
   - JWT token generation with user_id/tenant_id claims
   - Token verification and revocation
   - Device flow for Claude Desktop integration

5. **FastAPI Production Server** (`production_server.py`)
   - HTTP authentication middleware
   - Tenant context management (thread-safe)
   - OAuth device flow for passwordless authentication
   - Health checks and monitoring

---

## Current Quendoo AI Dashboard Architecture

### Stack

**Backend:**
- Node.js/Express server
- Google Cloud Firestore (NoSQL database)
- Firebase Admin SDK
- Currently stores: conversations, messages, settings, auditLogs

**Frontend:**
- Vue 3 + Vuetify
- Pinia state management
- Chat interface with sidebar
- Admin panel (login, analytics, settings)

### Current API Key Storage

**Problem:** API keys are stored in **frontend localStorage** and sent with every request:

```javascript
// frontend/src/services/api.js
const apiKey = localStorage.getItem('anthropic-api-key')
const mcpUrl = localStorage.getItem('mcp-server-url')

// Sent in request body
await apiClient.post('/chat/quendoo', {
  message,
  apiKey,  // ⚠️ CLIENT-SIDE STORAGE - SECURITY RISK
  mcpServerUrl
})
```

**Security Issues:**
1. API keys exposed in browser localStorage
2. API keys sent in every HTTP request (visible in network logs)
3. No encryption at rest
4. No multi-tenant isolation
5. No usage tracking or rate limiting

---

## Integration Strategy: Three Options

### Option 1: Full Migration to MCP Database (RECOMMENDED)

**Architecture:**
```
Quendoo Dashboard Frontend
      ↓
Quendoo Dashboard Backend (Node.js)
      ↓
MCP PostgreSQL Database (via REST API)
      ↓
MCP Server (uses same database)
```

**Implementation:**

1. **Backend Changes:**
   - Add PostgreSQL client to Node.js backend
   - Connect to same PostgreSQL database as MCP server
   - Use existing `api_keys` table structure
   - Implement encryption/decryption using same algorithm (Fernet)

2. **Frontend Changes:**
   - Remove API key storage from localStorage
   - Add admin UI for API key management
   - Store only JWT token in localStorage (for admin authentication)

3. **Security Benefits:**
   - All API keys encrypted in PostgreSQL
   - Single source of truth for credentials
   - Automatic multi-tenant isolation (tenant_id)
   - Audit logging built-in

**Code Changes Required:**

**backend/mcp-client/package.json:**
```json
{
  "dependencies": {
    "pg": "^8.11.3",
    "node-postgres": "^6.0.5"
  }
}
```

**backend/mcp-client/src/db/mcpDatabase.js (NEW FILE):**
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.MCP_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function getApiKey(tenantId, keyName) {
  const result = await pool.query(
    `SELECT encrypted_value FROM api_keys
     WHERE tenant_id = $1 AND key_name = $2 AND is_active = true`,
    [tenantId, keyName]
  );

  if (result.rows.length === 0) return null;

  // Decrypt using same algorithm as MCP server
  const decrypted = decrypt(result.rows[0].encrypted_value);
  return decrypted;
}

async function saveApiKey(tenantId, keyName, keyValue) {
  const encrypted = encrypt(keyValue);

  await pool.query(
    `INSERT INTO api_keys (tenant_id, key_name, encrypted_value, is_active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (tenant_id, key_name)
     DO UPDATE SET encrypted_value = EXCLUDED.encrypted_value, updated_at = NOW()`,
    [tenantId, keyName, encrypted]
  );
}

module.exports = { getApiKey, saveApiKey };
```

**backend/mcp-client/src/index.js (MODIFY):**
```javascript
const { getApiKey } = require('./db/mcpDatabase');

app.post('/chat/quendoo', async (req, res) => {
  const { message, conversationId, model } = req.body;

  // Get tenant_id from authenticated user (JWT token)
  const tenantId = req.user.tenantId; // From auth middleware

  // Fetch API key from database (encrypted storage)
  const anthropicApiKey = await getApiKey(tenantId, 'ANTHROPIC_API_KEY');

  if (!anthropicApiKey) {
    return res.status(400).json({ error: 'API key not configured' });
  }

  // Use API key (never sent from client)
  // ... rest of chat logic
});
```

**Pros:**
- ✅ Strongest security (encrypted storage, server-side only)
- ✅ Leverages existing battle-tested MCP infrastructure
- ✅ Multi-tenant ready out of the box
- ✅ Single source of truth for all credentials
- ✅ Audit logging and usage tracking built-in

**Cons:**
- ⚠️ Requires PostgreSQL database access
- ⚠️ More complex setup (database connection, encryption keys)
- ⚠️ Migration needed for existing users

---

### Option 2: Hybrid Approach (Firestore + MCP Database)

**Architecture:**
```
Quendoo Dashboard Frontend
      ↓
Quendoo Dashboard Backend (Node.js)
      ↓
Firestore (conversations, messages) + PostgreSQL (API keys only)
```

**Implementation:**
- Keep Firestore for conversation data
- Add PostgreSQL connection ONLY for API key storage
- Use MCP's encryption system for API keys

**Pros:**
- ✅ Secure API key storage
- ✅ Minimal changes to existing conversation logic
- ✅ Leverages MCP encryption

**Cons:**
- ⚠️ Two databases to maintain
- ⚠️ More complex architecture

---

### Option 3: Firestore-Only with Server-Side Key Management

**Architecture:**
```
Quendoo Dashboard Frontend
      ↓
Quendoo Dashboard Backend (Node.js)
      ↓
Firestore (all data including encrypted API keys)
```

**Implementation:**
- Create new Firestore collection: `tenant_api_keys`
- Encrypt API keys before storage (using Google Cloud KMS or similar)
- Never send keys to frontend

**New Firestore Collection:**
```javascript
// Firestore: tenant_api_keys/{tenantId}/keys/{keyName}
{
  tenantId: 'default',
  keyName: 'ANTHROPIC_API_KEY',
  encryptedValue: 'gAAAAABf...',
  isActive: true,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Pros:**
- ✅ No additional database needed
- ✅ Simpler deployment
- ✅ Uses existing Firestore setup

**Cons:**
- ⚠️ Need to implement encryption from scratch
- ⚠️ Not leveraging MCP's proven system
- ⚠️ Firestore costs for API key storage

---

## Recommendation: Option 1 (Full Migration)

**Why Option 1?**

1. **Security:** MCP server already has production-ready encryption (Fernet/AES-256-GCM)
2. **Multi-tenancy:** Built-in tenant isolation with UUIDs
3. **Proven:** MCP server is already deployed and handling real traffic
4. **DRY Principle:** Don't reinvent the wheel - reuse existing infrastructure
5. **Future-proof:** Easy to add features like usage tracking, rate limiting, audit logs

**Migration Path:**

### Phase 1: Database Connection (Week 1)
1. Add PostgreSQL connection to Node.js backend
2. Replicate MCP's encryption system in Node.js
3. Create migration script to move existing API keys from localStorage to PostgreSQL

### Phase 2: Backend Integration (Week 2)
1. Modify `/chat/quendoo` endpoint to fetch API keys from database
2. Add authentication middleware (JWT)
3. Link users to tenants (create tenant_id for each user)

### Phase 3: Frontend Changes (Week 3)
1. Remove API key inputs from Settings page
2. Add "API Key Management" to Admin Panel
3. Display masked keys (e.g., `sk-ant-...****1234`)
4. Add "Add/Edit/Delete" functionality

### Phase 4: Multi-Tenant Support (Week 4)
1. Add user registration/login (if not exists)
2. Create tenant per user automatically
3. Migrate conversation data to be tenant-specific

---

## Database Schema Alignment

### Current MCP Database (PostgreSQL)

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
);

-- Tenants table (1 user = 1 tenant)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- API Keys table (encrypted storage)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key_name VARCHAR(100) NOT NULL,  -- 'ANTHROPIC_API_KEY', 'QUENDOO_API_KEY'
    encrypted_value TEXT NOT NULL,    -- AES-256 encrypted
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, key_name)
);

-- Sessions table (JWT tracking)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_jti VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT
);
```

### Current Quendoo Dashboard (Firestore)

```
Collections:
├── conversations/
│   ├── {conversationId}/
│   │   ├── id: string
│   │   ├── userId: string
│   │   ├── title: string
│   │   ├── createdAt: timestamp
│   │   ├── updatedAt: timestamp
│   │   └── messageCount: number
│
├── messages/
│   ├── {messageId}/
│   │   ├── conversationId: string
│   │   ├── role: 'user' | 'assistant'
│   │   ├── content: string
│   │   ├── createdAt: timestamp
│   │   └── metadata: object
│
└── auditLogs/
    └── ... (security events)
```

**Integration Strategy:**
- Keep Firestore for conversations/messages (NoSQL is better for chat data)
- Use PostgreSQL for users, tenants, API keys (relational data)
- Link via `userId` field (can be same UUID in both databases)

---

## Security Comparison

### Current State (localStorage)

| Aspect | Status | Risk Level |
|--------|--------|-----------|
| API Key Storage | Browser localStorage | 🔴 CRITICAL |
| Encryption at Rest | None | 🔴 CRITICAL |
| Transmission | HTTP body (plaintext) | 🔴 CRITICAL |
| Multi-tenant Isolation | None | 🔴 CRITICAL |
| Audit Logging | Partial | 🟡 MEDIUM |

### After Option 1 Integration

| Aspect | Status | Risk Level |
|--------|--------|-----------|
| API Key Storage | PostgreSQL (server-side only) | 🟢 LOW |
| Encryption at Rest | AES-256-GCM (Fernet) | 🟢 LOW |
| Transmission | Never sent to client | 🟢 LOW |
| Multi-tenant Isolation | UUID-based tenant context | 🟢 LOW |
| Audit Logging | Full (database + Firestore) | 🟢 LOW |

---

## Implementation Code Examples

### 1. PostgreSQL Connection Module

**backend/mcp-client/src/db/postgresClient.js (NEW FILE):**
```javascript
const { Pool } = require('pg');
const crypto = require('crypto');

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.MCP_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('[PostgreSQL] Connected to MCP database');
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected error:', err);
});

module.exports = pool;
```

### 2. Encryption Module (Node.js equivalent of Python Fernet)

**backend/mcp-client/src/security/encryption.js (NEW FILE):**
```javascript
const crypto = require('crypto');
const { promisify } = require('util');
const pbkdf2 = promisify(crypto.pbkdf2);

class EncryptionManager {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.masterKey = null;
  }

  async initialize() {
    // Use JWT_PRIVATE_KEY as master key source (same as Python version)
    const masterKeySource = process.env.JWT_PRIVATE_KEY;

    if (!masterKeySource) {
      throw new Error('JWT_PRIVATE_KEY environment variable is required for encryption');
    }

    // Derive encryption key using PBKDF2 (same as Python version)
    this.masterKey = await pbkdf2(
      Buffer.from(masterKeySource, 'utf8'),
      'quendoo_mcp_salt_v1',  // Same salt as Python
      100000,  // Same iteration count
      32,  // 32 bytes = 256 bits
      'sha256'
    );

    console.log('[Encryption] Initialized with PBKDF2-derived key');
  }

  encrypt(plaintext) {
    if (!plaintext) {
      throw new Error('Plaintext cannot be empty');
    }

    // Generate random IV (Initialization Vector)
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine: IV + AuthTag + Ciphertext (base64 encoded)
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]);

    return combined.toString('base64');
  }

  decrypt(ciphertext) {
    if (!ciphertext) {
      throw new Error('Ciphertext cannot be empty');
    }

    try {
      // Decode from base64
      const combined = Buffer.from(ciphertext, 'base64');

      // Extract components
      const iv = combined.slice(0, 16);
      const authTag = combined.slice(16, 32);
      const encrypted = combined.slice(32);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
}

// Singleton instance
const encryptionManager = new EncryptionManager();

module.exports = { encryptionManager };
```

### 3. API Key Manager (Node.js equivalent)

**backend/mcp-client/src/db/apiKeyManager.js (NEW FILE):**
```javascript
const pool = require('./postgresClient');
const { encryptionManager } = require('../security/encryption');

class ApiKeyManager {
  /**
   * Save or update an encrypted API key for a tenant
   */
  async saveApiKey(tenantId, keyName, keyValue) {
    if (!keyName || !keyValue) {
      throw new Error('keyName and keyValue are required');
    }

    // Encrypt the API key
    const encryptedValue = encryptionManager.encrypt(keyValue);

    const query = `
      INSERT INTO api_keys (tenant_id, key_name, encrypted_value, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (tenant_id, key_name)
      DO UPDATE SET
        encrypted_value = EXCLUDED.encrypted_value,
        updated_at = NOW(),
        is_active = true
      RETURNING id
    `;

    const result = await pool.query(query, [tenantId, keyName, encryptedValue]);

    return {
      success: true,
      message: `API key '${keyName}' saved successfully`,
      keyId: result.rows[0].id
    };
  }

  /**
   * Retrieve and decrypt an API key for a tenant
   */
  async getApiKey(tenantId, keyName) {
    const query = `
      SELECT encrypted_value
      FROM api_keys
      WHERE tenant_id = $1 AND key_name = $2 AND is_active = true
    `;

    const result = await pool.query(query, [tenantId, keyName]);

    if (result.rows.length === 0) {
      return null;
    }

    try {
      return encryptionManager.decrypt(result.rows[0].encrypted_value);
    } catch (error) {
      console.error(`[API Key Manager] Error decrypting key: ${error.message}`);
      return null;
    }
  }

  /**
   * List all API keys for a tenant (without decrypting values)
   */
  async listApiKeys(tenantId) {
    const query = `
      SELECT id, key_name, created_at, updated_at
      FROM api_keys
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [tenantId]);

    return result.rows.map(row => ({
      id: row.id,
      keyName: row.key_name,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  }

  /**
   * Delete (soft delete) an API key
   */
  async deleteApiKey(tenantId, keyName) {
    const query = `
      UPDATE api_keys
      SET is_active = false, updated_at = NOW()
      WHERE tenant_id = $1 AND key_name = $2
      RETURNING id
    `;

    const result = await pool.query(query, [tenantId, keyName]);

    if (result.rows.length === 0) {
      return {
        success: false,
        message: `API key '${keyName}' not found`
      };
    }

    return {
      success: true,
      message: `API key '${keyName}' deleted successfully`
    };
  }
}

module.exports = new ApiKeyManager();
```

### 4. Modified Chat Endpoint

**backend/mcp-client/src/index.js (MODIFY):**
```javascript
const apiKeyManager = require('./db/apiKeyManager');

// Initialize encryption on startup
const { encryptionManager } = require('./security/encryption');
await encryptionManager.initialize();

app.post('/chat/quendoo', async (req, res) => {
  try {
    const { message, conversationId, model } = req.body;

    // Get tenant_id from authenticated user (from JWT middleware)
    const tenantId = req.user?.tenantId || 'default';  // For now, use 'default' tenant

    // Fetch Anthropic API key from database (encrypted storage)
    const anthropicApiKey = await apiKeyManager.getApiKey(tenantId, 'ANTHROPIC_API_KEY');

    if (!anthropicApiKey) {
      return res.status(400).json({
        error: 'Anthropic API key not configured. Please add it in Admin Settings.'
      });
    }

    // Fetch MCP server URL from database
    const mcpServerUrl = await apiKeyManager.getApiKey(tenantId, 'MCP_SERVER_URL');

    // Use API keys (never sent from client)
    const response = await sendMessageToClaude({
      message,
      conversationId,
      model,
      apiKey: anthropicApiKey,
      mcpServerUrl
    });

    res.json(response);

  } catch (error) {
    console.error('[Chat] Error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});
```

### 5. Admin API Endpoints for Key Management

**backend/mcp-client/src/index.js (ADD):**
```javascript
// Get all API keys for current tenant (admin only)
app.get('/admin/api-keys', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const keys = await apiKeyManager.listApiKeys(tenantId);
    res.json({ keys });
  } catch (error) {
    console.error('[Admin] Error listing keys:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// Save/update API key (admin only)
app.post('/admin/api-keys', authenticateAdmin, async (req, res) => {
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

// Delete API key (admin only)
app.delete('/admin/api-keys/:keyName', authenticateAdmin, async (req, res) => {
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

## Environment Variables Required

**backend/mcp-client/.env:**
```bash
# Existing
ANTHROPIC_API_KEY=<will-be-removed-and-stored-in-database>
PORT=8080
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

# New for PostgreSQL integration
MCP_DATABASE_URL=postgresql://user:password@host:5432/quendoo_mcp
JWT_PRIVATE_KEY=<same-key-as-mcp-server-for-encryption>

# Admin authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<secure-password>
JWT_SECRET=<jwt-signing-key>
```

---

## Migration Plan: Detailed Steps

### Step 1: Database Setup

1. **Get PostgreSQL credentials from MCP server:**
   ```bash
   # Ask user for MCP_DATABASE_URL
   # Format: postgresql://user:password@host:5432/quendoo_mcp
   ```

2. **Test connection from Node.js:**
   ```javascript
   const { Pool } = require('pg');
   const pool = new Pool({ connectionString: process.env.MCP_DATABASE_URL });
   pool.query('SELECT NOW()', (err, res) => {
     console.log('Database connected:', res.rows[0].now);
   });
   ```

### Step 2: Implement Encryption

1. **Install dependencies:**
   ```bash
   cd backend/mcp-client
   npm install pg
   ```

2. **Create encryption module** (see code above)

3. **Test encryption/decryption:**
   ```javascript
   const encrypted = encryptionManager.encrypt('test-api-key');
   const decrypted = encryptionManager.decrypt(encrypted);
   console.assert(decrypted === 'test-api-key');
   ```

### Step 3: Migrate Existing API Keys

**backend/mcp-client/scripts/migrate-api-keys.js (NEW FILE):**
```javascript
const apiKeyManager = require('../src/db/apiKeyManager');

async function migrateApiKeys() {
  // Get existing API keys from environment or Firestore
  const existingKeys = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    MCP_SERVER_URL: process.env.MCP_SERVER_URL || 'http://localhost:3100'
  };

  const tenantId = 'default';  // For single-tenant initially

  for (const [keyName, keyValue] of Object.entries(existingKeys)) {
    if (keyValue) {
      console.log(`Migrating ${keyName}...`);
      await apiKeyManager.saveApiKey(tenantId, keyName, keyValue);
      console.log(`✓ ${keyName} migrated successfully`);
    }
  }

  console.log('Migration complete!');
}

migrateApiKeys().catch(console.error);
```

**Run migration:**
```bash
node backend/mcp-client/scripts/migrate-api-keys.js
```

### Step 4: Update Backend Endpoints

1. Modify `/chat/quendoo` to fetch keys from database
2. Add admin endpoints for key management
3. Remove API key from request body validation

### Step 5: Update Frontend

**frontend/src/views/admin/AdminSettings.vue (MODIFY):**
```vue
<template>
  <div class="admin-settings">
    <h2>API Key Management</h2>

    <!-- List existing keys -->
    <v-list>
      <v-list-item v-for="key in apiKeys" :key="key.id">
        <v-list-item-title>{{ key.keyName }}</v-list-item-title>
        <v-list-item-subtitle>
          Last updated: {{ formatDate(key.updatedAt) }}
        </v-list-item-subtitle>
        <template v-slot:append>
          <v-btn icon size="small" @click="deleteKey(key.keyName)">
            <v-icon>mdi-delete</v-icon>
          </v-btn>
        </template>
      </v-list-item>
    </v-list>

    <!-- Add new key form -->
    <v-card class="mt-4">
      <v-card-title>Add/Update API Key</v-card-title>
      <v-card-text>
        <v-select
          v-model="newKey.keyName"
          :items="['ANTHROPIC_API_KEY', 'MCP_SERVER_URL', 'QUENDOO_API_KEY']"
          label="Key Name"
        />
        <v-text-field
          v-model="newKey.keyValue"
          label="Key Value"
          type="password"
          :hint="getKeyHint(newKey.keyName)"
        />
      </v-card-text>
      <v-card-actions>
        <v-btn color="primary" @click="saveKey">Save Key</v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
const apiKeys = ref([]);
const newKey = ref({ keyName: '', keyValue: '' });

const loadApiKeys = async () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  const response = await axios.get(`${baseUrl}/admin/api-keys`, {
    headers: { 'Authorization': `Bearer ${authStore.token}` }
  });
  apiKeys.value = response.data.keys;
};

const saveKey = async () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  await axios.post(`${baseUrl}/admin/api-keys`, newKey.value, {
    headers: { 'Authorization': `Bearer ${authStore.token}` }
  });

  newKey.value = { keyName: '', keyValue: '' };
  await loadApiKeys();
};

const deleteKey = async (keyName) => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  await axios.delete(`${baseUrl}/admin/api-keys/${keyName}`, {
    headers: { 'Authorization': `Bearer ${authStore.token}` }
  });
  await loadApiKeys();
};

const getKeyHint = (keyName) => {
  const hints = {
    'ANTHROPIC_API_KEY': 'Format: sk-ant-api03-...',
    'MCP_SERVER_URL': 'Format: http://localhost:3100',
    'QUENDOO_API_KEY': 'Your Quendoo PMS API key'
  };
  return hints[keyName] || '';
};

onMounted(loadApiKeys);
</script>
```

---

## Testing Checklist

### Security Tests

- [ ] API keys are never sent from frontend to backend
- [ ] API keys are encrypted in database (verify with database client)
- [ ] Decryption works correctly (test encrypt/decrypt cycle)
- [ ] Admin authentication required for key management endpoints
- [ ] Non-admin users cannot access key management
- [ ] Soft delete works (deleted keys marked inactive, not removed)

### Functionality Tests

- [ ] Chat works with API key from database
- [ ] Admin can add new API key
- [ ] Admin can update existing API key
- [ ] Admin can delete API key
- [ ] Admin can view list of keys (without seeing values)
- [ ] Error handling when API key not configured
- [ ] Migration script successfully moves keys from env to database

### Integration Tests

- [ ] Node.js backend connects to PostgreSQL
- [ ] Encryption uses same algorithm as MCP server (test cross-compatibility)
- [ ] Multi-tenant isolation works (if implemented)
- [ ] Performance: API key retrieval < 50ms

---

## Rollback Plan

If integration fails:

1. **Revert backend changes:**
   ```bash
   git revert <commit-hash>
   ```

2. **Restore environment variables:**
   ```bash
   export ANTHROPIC_API_KEY=<original-key>
   ```

3. **Fallback code:**
   ```javascript
   // Add this to index.js as fallback
   const anthropicApiKey = await apiKeyManager.getApiKey(tenantId, 'ANTHROPIC_API_KEY')
     || process.env.ANTHROPIC_API_KEY;  // Fallback to env variable
   ```

---

## Timeline Estimate

| Phase | Tasks | Duration |
|-------|-------|----------|
| **Week 1** | Database connection, encryption, migration script | 5 days |
| **Week 2** | Backend API endpoints, authentication middleware | 5 days |
| **Week 3** | Frontend admin UI, testing | 5 days |
| **Week 4** | Multi-tenant support, documentation, deployment | 5 days |

**Total: 4 weeks (20 working days)**

---

## Next Steps

1. **Decision:** Choose integration option (recommend Option 1)
2. **Access:** Get PostgreSQL database credentials from MCP server
3. **Setup:** Install dependencies and test database connection
4. **Implement:** Follow implementation plan above
5. **Test:** Run security and functionality tests
6. **Deploy:** Deploy to Cloud Run with new environment variables
7. **Monitor:** Check logs for encryption/decryption performance

---

## Questions for User

1. Do you have access to the MCP PostgreSQL database connection string?
2. Should we implement multi-tenant support immediately or start with single tenant?
3. Do you want to migrate existing API keys automatically or require admin to re-enter them?
4. Should we keep Firestore for conversation data or migrate that to PostgreSQL as well?

---

## Conclusion

The MCP server already has **production-ready API key management** with:
- ✅ AES-256-GCM encryption
- ✅ Multi-tenant isolation
- ✅ Secure storage in PostgreSQL
- ✅ Proven in production

**Recommendation:** Leverage this existing infrastructure instead of building from scratch. This provides:
- **Better security** (encrypted storage, server-side only)
- **Faster development** (reuse existing code)
- **Single source of truth** (one database for all API keys)
- **Future-proof** (easy to add rate limiting, usage tracking, etc.)

**Key Insight:** The hardest parts (encryption, database schema, multi-tenancy) are already solved by the MCP server. We just need to connect the Quendoo Dashboard backend to the same database.
