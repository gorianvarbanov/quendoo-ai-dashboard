# Multi-Tenant Implementation Plan for Quendoo AI Dashboard

## Проблем

Понастоящем Dashboard-ът използва **hardcoded 'default' userId** за всички операции:

```javascript
// backend/mcp-client/src/index.js
const conversations = await conversationService.getConversations('default', limit);
const results = await conversationService.searchConversations('default', q.trim(), searchLimit);
```

**Последици:**
- ❌ Всички потребители виждат едни и същи conversations
- ❌ Няма изолация между различни users/organizations
- ❌ Не може да използваме MCP multi-tenant архитектурата
- ❌ Security risk - всеки може да види чуждите conversations

## Цел

Внедряване на пълен multi-tenant support:
- ✅ Всеки user има собствен tenant
- ✅ Conversations са изолирани per tenant
- ✅ API keys са per tenant (криптирани в база)
- ✅ Admin authentication system
- ✅ JWT tokens за автентикация

---

## Архитектурно Решение

### Вариант 1: Бърз Single-Tenant Mode (За сега)

**Идея:** Запазваме едно-потребителски режим, но подготвяме за бъдещ multi-tenant.

**Имплементация:**
1. Добавяме admin login с username/password
2. Admin има JWT token в localStorage
3. Backend проверява JWT token
4. Всички операции все още използват 'default' userId
5. **Но** - подготвяме структурата за бъдещ multi-tenant

**Плюсове:**
- ✅ Бързо за имплементиране (2-3 дни)
- ✅ Добавя security (admin login)
- ✅ Лесно да се разшири до full multi-tenant после
- ✅ Не изисква промяна на database schema

**Минуси:**
- ⚠️ Все още hardcoded 'default' userId
- ⚠️ Не използва MCP tenant isolation

**Timeframe:** 2-3 дни

---

### Вариант 2: Full Multi-Tenant с MCP Database (Препоръчвам)

**Идея:** Пълна интеграция с MCP PostgreSQL database за истински multi-tenant.

**Имплементация:**

#### Фаза 1: User Management (Седмица 1)

1. **Добавяме PostgreSQL connection към backend:**
   ```javascript
   // backend/mcp-client/src/db/postgresClient.js
   const { Pool } = require('pg');
   const pool = new Pool({
     connectionString: process.env.MCP_DATABASE_URL
   });
   ```

2. **Създаваме authentication middleware:**
   ```javascript
   // backend/mcp-client/src/auth/jwtAuth.js
   import jwt from 'jsonwebtoken';

   export function authenticateToken(req, res, next) {
     const token = req.headers.authorization?.split(' ')[1];

     if (!token) {
       return res.status(401).json({ error: 'Authentication required' });
     }

     try {
       const decoded = jwt.verify(token, process.env.JWT_SECRET);
       req.user = {
         userId: decoded.userId,
         tenantId: decoded.tenantId,
         email: decoded.email
       };
       next();
     } catch (error) {
       return res.status(403).json({ error: 'Invalid token' });
     }
   }
   ```

3. **Добавяме login endpoint:**
   ```javascript
   // backend/mcp-client/src/index.js
   app.post('/auth/login', async (req, res) => {
     const { email, password } = req.body;

     // Query PostgreSQL users table
     const user = await pool.query(
       'SELECT id, email, password_hash FROM users WHERE email = $1',
       [email]
     );

     if (!user.rows.length) {
       return res.status(401).json({ error: 'Invalid credentials' });
     }

     // Verify password (bcrypt)
     const valid = await bcrypt.compare(password, user.rows[0].password_hash);
     if (!valid) {
       return res.status(401).json({ error: 'Invalid credentials' });
     }

     // Get tenant for user
     const tenant = await pool.query(
       'SELECT id FROM tenants WHERE user_id = $1',
       [user.rows[0].id]
     );

     // Generate JWT token
     const token = jwt.sign(
       {
         userId: user.rows[0].id,
         tenantId: tenant.rows[0].id,
         email: user.rows[0].email
       },
       process.env.JWT_SECRET,
       { expiresIn: '7d' }
     );

     res.json({ token, user: { email: user.rows[0].email } });
   });
   ```

#### Фаза 2: Tenant-Isolated Conversations (Седмица 2)

1. **Модифицираме Firestore да включва tenantId:**

   **Преди:**
   ```
   conversations/
     conv_123/
       userId: 'default'  ❌
       title: "..."
   ```

   **След:**
   ```
   conversations/
     conv_123/
       userId: 'uuid-of-user'  ✅
       tenantId: 'uuid-of-tenant'  ✅
       title: "..."
   ```

2. **Променяме всички endpoints да използват req.user.tenantId:**

   ```javascript
   // Преди
   app.get('/conversations', async (req, res) => {
     const conversations = await conversationService.getConversations('default', limit);
   });

   // След
   app.get('/conversations', authenticateToken, async (req, res) => {
     const tenantId = req.user.tenantId;
     const conversations = await conversationService.getConversations(tenantId, limit);
   });
   ```

3. **Модифицираме conversationService да query-ва по tenantId:**

   ```javascript
   // backend/mcp-client/src/db/conversationService.js
   export async function getConversations(tenantId = 'default', limit = 50) {
     const db = await getFirestore();
     const conversationsRef = db.collection(COLLECTIONS.CONVERSATIONS);

     const snapshot = await conversationsRef
       .where('tenantId', '==', tenantId)  // ✅ Filter by tenant
       .limit(limit)
       .get();

     // ... rest of code
   }
   ```

#### Фаза 3: API Key Management per Tenant (Седмица 3)

1. **Интегрираме с MCP api_keys table:**
   - API keys се съхраняват криптирани в PostgreSQL
   - Всеки tenant има собствени API keys
   - Backend взима API key от database, не от localStorage

   ```javascript
   // backend/mcp-client/src/db/apiKeyManager.js
   export async function getApiKey(tenantId, keyName) {
     const result = await pool.query(
       `SELECT encrypted_value FROM api_keys
        WHERE tenant_id = $1 AND key_name = $2 AND is_active = true`,
       [tenantId, keyName]
     );

     if (!result.rows.length) return null;

     // Decrypt and return
     return decrypt(result.rows[0].encrypted_value);
   }
   ```

2. **Модифицираме /chat/quendoo да взима API key от database:**

   ```javascript
   app.post('/chat/quendoo', authenticateToken, async (req, res) => {
     const { message, conversationId, model } = req.body;
     const tenantId = req.user.tenantId;

     // Get API key from database (per tenant)
     const apiKey = await getApiKey(tenantId, 'ANTHROPIC_API_KEY');

     if (!apiKey) {
       return res.status(400).json({
         error: 'API key not configured. Please add it in Settings.'
       });
     }

     // Use tenant's API key
     const response = await sendMessageToClaude(message, apiKey);
     res.json(response);
   });
   ```

#### Фаза 4: Frontend Changes (Седмица 4)

1. **Добавяме Login страница:**

   ```vue
   <!-- frontend/src/views/admin/AdminLogin.vue -->
   <template>
     <v-container class="fill-height">
       <v-row justify="center">
         <v-col cols="12" sm="8" md="4">
           <v-card>
             <v-card-title>Admin Login</v-card-title>
             <v-card-text>
               <v-form @submit.prevent="handleLogin">
                 <v-text-field
                   v-model="email"
                   label="Email"
                   type="email"
                   required
                 />
                 <v-text-field
                   v-model="password"
                   label="Password"
                   type="password"
                   required
                 />
                 <v-btn type="submit" color="primary" block>Login</v-btn>
               </v-form>
             </v-card-text>
           </v-card>
         </v-col>
       </v-row>
     </v-container>
   </template>

   <script setup>
   import { ref } from 'vue';
   import { useRouter } from 'vue-router';
   import { useAuthStore } from '@/stores/authStore';

   const router = useRouter();
   const authStore = useAuthStore();
   const email = ref('');
   const password = ref('');

   const handleLogin = async () => {
     await authStore.login(email.value, password.value);
     router.push('/');
   };
   </script>
   ```

2. **Създаваме Auth Store:**

   ```javascript
   // frontend/src/stores/authStore.js
   import { defineStore } from 'pinia';
   import { ref } from 'vue';
   import axios from 'axios';

   export const useAuthStore = defineStore('auth', () => {
     const token = ref(localStorage.getItem('auth-token'));
     const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));

     async function login(email, password) {
       const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
       const response = await axios.post(`${baseUrl}/auth/login`, {
         email,
         password
       });

       token.value = response.data.token;
       user.value = response.data.user;

       localStorage.setItem('auth-token', token.value);
       localStorage.setItem('user', JSON.stringify(user.value));
     }

     function logout() {
       token.value = null;
       user.value = null;
       localStorage.removeItem('auth-token');
       localStorage.removeItem('user');
     }

     return { token, user, login, logout };
   });
   ```

3. **Модифицираме API service да изпраща JWT token:**

   ```javascript
   // frontend/src/services/api.js
   import axios from 'axios';
   import { useAuthStore } from '@/stores/authStore';

   const apiClient = axios.create({
     baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
   });

   // Add JWT token to all requests
   apiClient.interceptors.request.use(config => {
     const authStore = useAuthStore();
     if (authStore.token) {
       config.headers.Authorization = `Bearer ${authStore.token}`;
     }
     return config;
   });
   ```

4. **Добавяме route guard:**

   ```javascript
   // frontend/src/router/index.js
   import { useAuthStore } from '@/stores/authStore';

   router.beforeEach((to, from, next) => {
     const authStore = useAuthStore();

     // Check if route requires auth
     if (to.meta.requiresAuth && !authStore.token) {
       next('/admin/login');
     } else {
       next();
     }
   });
   ```

---

## Database Schema Changes

### Firestore (Existing)

**Преди:**
```
conversations/
  {conversationId}/
    userId: 'default'
    title: string
    createdAt: timestamp
    updatedAt: timestamp
```

**След:**
```
conversations/
  {conversationId}/
    userId: string (UUID from PostgreSQL)
    tenantId: string (UUID from PostgreSQL)
    title: string
    createdAt: timestamp
    updatedAt: timestamp
```

### PostgreSQL (MCP Database - Already Exists!)

```sql
-- Users table (already exists in MCP)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tenants table (already exists in MCP)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id),
    tenant_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- API Keys table (already exists in MCP)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    key_name VARCHAR(100) NOT NULL,
    encrypted_value TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, key_name)
);
```

**ВАЖНО:** Тези таблици вече съществуват в MCP database! Не трябва да ги създаваме.

---

## Migration Strategy

### Стъпка 1: Създаване на Default User & Tenant в MCP Database

```sql
-- Create default admin user
INSERT INTO users (id, email, password_hash, full_name, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@quendoo.com',
  '$2b$10$...', -- bcrypt hash of 'admin123'
  'Admin User',
  true
);

-- Create default tenant
INSERT INTO tenants (id, user_id, tenant_name)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Default Organization'
);
```

### Стъпка 2: Migrate Existing Conversations

```javascript
// scripts/migrate-conversations-to-tenant.js
const admin = require('firebase-admin');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.MCP_DATABASE_URL });
const db = admin.firestore();

async function migrateConversations() {
  const defaultTenantId = '00000000-0000-0000-0000-000000000002';

  const conversationsRef = db.collection('conversations');
  const snapshot = await conversationsRef.where('userId', '==', 'default').get();

  console.log(`Found ${snapshot.size} conversations to migrate`);

  for (const doc of snapshot.docs) {
    await doc.ref.update({
      userId: '00000000-0000-0000-0000-000000000001', // Default user ID
      tenantId: defaultTenantId
    });
    console.log(`Migrated conversation: ${doc.id}`);
  }

  console.log('Migration complete!');
}

migrateConversations();
```

### Стъпка 3: Migrate API Keys

```javascript
// scripts/migrate-api-keys.js
const { Pool } = require('pg');
const { encryptionManager } = require('../src/security/encryption');

const pool = new Pool({ connectionString: process.env.MCP_DATABASE_URL });

async function migrateApiKeys() {
  await encryptionManager.initialize();

  const defaultTenantId = '00000000-0000-0000-0000-000000000002';
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('No API key to migrate');
    return;
  }

  // Encrypt API key
  const encrypted = encryptionManager.encrypt(apiKey);

  // Insert into database
  await pool.query(
    `INSERT INTO api_keys (tenant_id, key_name, encrypted_value, is_active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (tenant_id, key_name) DO UPDATE
     SET encrypted_value = EXCLUDED.encrypted_value`,
    [defaultTenantId, 'ANTHROPIC_API_KEY', encrypted]
  );

  console.log('API key migrated successfully');
}

migrateApiKeys();
```

---

## Implementation Timeline

| Phase | Tasks | Duration | Status |
|-------|-------|----------|--------|
| **Week 1** | PostgreSQL connection, Auth middleware, Login endpoint | 5 days | ⏳ Not Started |
| **Week 2** | Tenant-isolated conversations, Update all endpoints | 5 days | ⏳ Not Started |
| **Week 3** | API key management integration, Encryption | 5 days | ⏳ Not Started |
| **Week 4** | Frontend auth, Login page, Route guards, Testing | 5 days | ⏳ Not Started |

**Total: 4 седмици (20 работни дни)**

---

## Detailed Implementation Steps

### Week 1: Authentication Foundation

#### Day 1: PostgreSQL Setup

1. **Install dependencies:**
   ```bash
   cd backend/mcp-client
   npm install pg bcrypt jsonwebtoken
   ```

2. **Create PostgreSQL client:**
   ```javascript
   // backend/mcp-client/src/db/postgresClient.js
   import pkg from 'pg';
   const { Pool } = pkg;

   const pool = new Pool({
     connectionString: process.env.MCP_DATABASE_URL,
     ssl: process.env.NODE_ENV === 'production' ? {
       rejectUnauthorized: false
     } : false
   });

   export default pool;
   ```

3. **Test connection:**
   ```javascript
   // backend/mcp-client/src/db/testConnection.js
   import pool from './postgresClient.js';

   async function testConnection() {
     try {
       const result = await pool.query('SELECT NOW()');
       console.log('PostgreSQL connected:', result.rows[0].now);
     } catch (error) {
       console.error('PostgreSQL connection failed:', error);
     }
   }

   testConnection();
   ```

#### Day 2: Authentication Middleware

1. **Create JWT auth middleware:**
   ```javascript
   // backend/mcp-client/src/auth/jwtAuth.js
   import jwt from 'jsonwebtoken';

   export function authenticateToken(req, res, next) {
     const authHeader = req.headers.authorization;
     const token = authHeader && authHeader.split(' ')[1];

     if (!token) {
       return res.status(401).json({ error: 'Authentication required' });
     }

     try {
       const decoded = jwt.verify(token, process.env.JWT_SECRET);
       req.user = {
         userId: decoded.userId,
         tenantId: decoded.tenantId,
         email: decoded.email
       };
       next();
     } catch (error) {
       return res.status(403).json({ error: 'Invalid or expired token' });
     }
   }

   export function optionalAuth(req, res, next) {
     const authHeader = req.headers.authorization;
     const token = authHeader && authHeader.split(' ')[1];

     if (token) {
       try {
         const decoded = jwt.verify(token, process.env.JWT_SECRET);
         req.user = {
           userId: decoded.userId,
           tenantId: decoded.tenantId,
           email: decoded.email
         };
       } catch (error) {
         // Invalid token, but continue without auth
       }
     }

     next();
   }
   ```

#### Day 3: Login Endpoint

1. **Create user service:**
   ```javascript
   // backend/mcp-client/src/db/userService.js
   import pool from './postgresClient.js';
   import bcrypt from 'bcrypt';

   export async function getUserByEmail(email) {
     const result = await pool.query(
       'SELECT id, email, password_hash, full_name FROM users WHERE email = $1 AND is_active = true',
       [email]
     );
     return result.rows[0] || null;
   }

   export async function getTenantByUserId(userId) {
     const result = await pool.query(
       'SELECT id, tenant_name FROM tenants WHERE user_id = $1',
       [userId]
     );
     return result.rows[0] || null;
   }

   export async function verifyPassword(plainPassword, hashedPassword) {
     return bcrypt.compare(plainPassword, hashedPassword);
   }

   export async function createUser(email, password, fullName) {
     const passwordHash = await bcrypt.hash(password, 10);

     const userResult = await pool.query(
       `INSERT INTO users (email, password_hash, full_name, is_active)
        VALUES ($1, $2, $3, true)
        RETURNING id, email, full_name`,
       [email, passwordHash, fullName]
     );

     const user = userResult.rows[0];

     // Create tenant for user
     const tenantResult = await pool.query(
       `INSERT INTO tenants (user_id, tenant_name)
        VALUES ($1, $2)
        RETURNING id, tenant_name`,
       [user.id, `${fullName}'s Organization`]
     );

     const tenant = tenantResult.rows[0];

     return { user, tenant };
   }
   ```

2. **Add login endpoint:**
   ```javascript
   // backend/mcp-client/src/index.js
   import { authenticateToken } from './auth/jwtAuth.js';
   import { getUserByEmail, getTenantByUserId, verifyPassword } from './db/userService.js';
   import jwt from 'jsonwebtoken';

   app.post('/auth/login', async (req, res) => {
     try {
       const { email, password } = req.body;

       if (!email || !password) {
         return res.status(400).json({ error: 'Email and password required' });
       }

       // Get user from database
       const user = await getUserByEmail(email);
       if (!user) {
         return res.status(401).json({ error: 'Invalid credentials' });
       }

       // Verify password
       const valid = await verifyPassword(password, user.password_hash);
       if (!valid) {
         return res.status(401).json({ error: 'Invalid credentials' });
       }

       // Get tenant
       const tenant = await getTenantByUserId(user.id);
       if (!tenant) {
         return res.status(500).json({ error: 'Tenant not found' });
       }

       // Generate JWT token
       const token = jwt.sign(
         {
           userId: user.id,
           tenantId: tenant.id,
           email: user.email
         },
         process.env.JWT_SECRET,
         { expiresIn: '7d' }
       );

       res.json({
         token,
         user: {
           email: user.email,
           fullName: user.full_name,
           tenantId: tenant.id,
           tenantName: tenant.tenant_name
         }
       });
     } catch (error) {
       console.error('[Auth] Login error:', error);
       res.status(500).json({ error: 'Login failed' });
     }
   });

   // Verify token endpoint
   app.get('/auth/verify', authenticateToken, (req, res) => {
     res.json({
       user: {
         email: req.user.email,
         userId: req.user.userId,
         tenantId: req.user.tenantId
       }
     });
   });
   ```

#### Day 4-5: Update All Endpoints

1. **Modify conversation endpoints:**
   ```javascript
   // backend/mcp-client/src/index.js

   // Before: hardcoded 'default'
   app.get('/conversations', async (req, res) => {
     const conversations = await conversationService.getConversations('default', limit);
   });

   // After: use authenticated tenant
   app.get('/conversations', authenticateToken, async (req, res) => {
     const tenantId = req.user.tenantId;
     const limit = parseInt(req.query.limit) || 50;
     const conversations = await conversationService.getConversations(tenantId, limit);
     res.json({ conversations });
   });
   ```

2. **Apply to all endpoints:**
   - GET /conversations
   - GET /conversations/search
   - GET /conversations/:id
   - POST /conversations
   - PATCH /conversations/:id
   - DELETE /conversations/:id
   - POST /chat/quendoo

### Week 2-4: Continue with remaining phases...

---

## Environment Variables Required

Add to `backend/mcp-client/.env`:

```bash
# Existing
ANTHROPIC_API_KEY=<will-be-migrated-to-database>
PORT=8080
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

# New for Multi-Tenant
MCP_DATABASE_URL=postgresql://user:password@host:5432/quendoo_mcp
JWT_SECRET=<generate-random-secret-key>
JWT_PRIVATE_KEY=<same-as-mcp-server-for-encryption>
NODE_ENV=production
```

---

## Testing Checklist

### Authentication Tests

- [ ] Login with valid credentials returns JWT token
- [ ] Login with invalid credentials returns 401
- [ ] JWT token includes userId, tenantId, email
- [ ] Protected endpoints require valid JWT token
- [ ] Invalid/expired tokens return 403
- [ ] Token verification endpoint works

### Multi-Tenant Isolation Tests

- [ ] User A cannot see User B's conversations
- [ ] User A cannot access User B's conversation by ID
- [ ] Search only returns conversations for authenticated tenant
- [ ] API keys are isolated per tenant
- [ ] Creating conversation assigns correct tenantId

### Migration Tests

- [ ] Existing conversations migrated to default tenant
- [ ] Existing API key migrated and encrypted
- [ ] No data loss during migration

---

## Rollback Plan

If multi-tenant implementation fails:

1. **Revert backend changes:**
   ```bash
   git revert <commit-hash>
   ```

2. **Remove authentication middleware:**
   - Comment out `authenticateToken` from routes
   - Revert to hardcoded 'default' userId

3. **Restore environment variables:**
   - Remove MCP_DATABASE_URL
   - Use ANTHROPIC_API_KEY from env

---

## Security Considerations

1. **Password Storage:**
   - Use bcrypt with salt rounds >= 10
   - Never store plaintext passwords

2. **JWT Tokens:**
   - Use strong JWT_SECRET (min 32 characters)
   - Set reasonable expiration (7 days)
   - Store securely on client (httpOnly cookies or localStorage with XSS protection)

3. **API Key Encryption:**
   - Use same encryption as MCP server (Fernet/AES-256-GCM)
   - Encryption key derived from JWT_PRIVATE_KEY via PBKDF2
   - 100,000 iterations for key derivation

4. **Tenant Isolation:**
   - Always filter by tenantId in database queries
   - Never trust client-sent tenantId
   - Use authenticated user's tenantId from JWT

---

## Next Steps

1. **Избери вариант:**
   - Вариант 1: Бърз single-tenant с admin login (2-3 дни)
   - Вариант 2: Full multi-tenant с MCP database (4 седмици)

2. **Вземи PostgreSQL credentials:**
   - Трябва MCP_DATABASE_URL connection string
   - JWT_PRIVATE_KEY за encryption compatibility

3. **Стартирай имплементация:**
   - Започни с Week 1, Day 1
   - Следвай стъпките в документа

Какво предпочиташ? Да започнем с бързия вариант или направо с full multi-tenant?
