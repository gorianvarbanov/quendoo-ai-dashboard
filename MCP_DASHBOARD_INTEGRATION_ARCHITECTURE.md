# Quendoo AI Dashboard + MCP Server: Complete Integration Architecture

## Executive Summary

**Objective:** Integrate the Quendoo AI Dashboard with the existing multi-tenant MCP server to provide hotel managers with a chat interface for managing their properties via natural language.

**Current Status:**
- ✅ MCP Server: **Fully functional** multi-tenant system with all Quendoo PMS API tools
- ✅ Dashboard: **Functional** chat interface with Firestore persistence
- ❌ Integration: **Not connected** - Dashboard doesn't use MCP server's multi-tenant architecture

**Key Insight:** The MCP server already has **everything we need**:
- Multi-tenant authentication (JWT + PostgreSQL)
- Encrypted API key storage per tenant
- All Quendoo PMS tools (property, booking, availability management)
- Production-ready deployment

**Solution:** Connect the Dashboard to the MCP server and adopt its multi-tenant architecture.

---

## Architecture Overview

### Current Architecture (Separate Systems)

```
┌─────────────────────────────────────┐
│    Quendoo AI Dashboard (Vue.js)    │
│                                     │
│  - Frontend: Vue 3 + Vuetify        │
│  - Backend: Node.js/Express         │
│  - Database: Firestore              │
│  - Auth: Basic admin login          │
│  - API Keys: localStorage (❌)       │
│  - Users: Single tenant ('default') │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│     MCP Server (FastMCP/Python)     │
│                                     │
│  - Multi-tenant: ✅                  │
│  - Auth: JWT + PostgreSQL           │
│  - API Keys: Encrypted per tenant   │
│  - Tools: Quendoo PMS API (11+)     │
│  - Deployment: Cloud Run            │
└─────────────────────────────────────┘
```

**Problem:** Two separate systems, no integration!

---

### Target Architecture (Integrated)

```
┌────────────────────────────────────────────────────────────────┐
│                    Quendoo AI Dashboard                         │
│                                                                │
│  Frontend (Vue.js)                                             │
│  ├─ Chat Interface                                             │
│  ├─ Admin Panel (Settings, Analytics, Security)               │
│  └─ Login/Register Pages                                       │
│                                                                │
└─────────────────┬──────────────────────────────────────────────┘
                  │
                  │ HTTP/REST API
                  │
┌─────────────────▼──────────────────────────────────────────────┐
│              Dashboard Backend (Node.js/Express)                │
│                                                                │
│  ├─ Authentication Layer (JWT)                                 │
│  ├─ Conversation Management (Firestore)                        │
│  ├─ Claude API Integration                                     │
│  └─ MCP Server Proxy                                           │
│                                                                │
└─────────────────┬──────────────────────────────────────────────┘
                  │
                  │ MCP Protocol / HTTP
                  │
┌─────────────────▼──────────────────────────────────────────────┐
│                 MCP Server (Multi-Tenant)                       │
│                                                                │
│  ├─ JWT Authentication (Supabase/PostgreSQL)                   │
│  ├─ Tenant Context Management                                  │
│  ├─ API Key Manager (Encrypted per tenant)                     │
│  └─ Quendoo PMS Tools                                          │
│      ├─ Property Settings                                      │
│      ├─ Room Details                                           │
│      ├─ Availability Management                                │
│      ├─ Booking Management                                     │
│      ├─ Booking Offers                                         │
│      └─ External Property Data                                 │
│                                                                │
└─────────────────┬──────────────────────────────────────────────┘
                  │
                  │ HTTPS REST API
                  │
┌─────────────────▼──────────────────────────────────────────────┐
│            Quendoo PMS API (Production)                         │
│                                                                │
│  Base URL: https://www.platform.quendoo.com/api/pms/v1/       │
│  Auth: api_key parameter                                       │
│                                                                │
│  Endpoints:                                                    │
│  ├─ Property/getPropertySettings                               │
│  ├─ Property/getRoomsDetails                                   │
│  ├─ Property/getBookingOffers                                  │
│  ├─ Availability/getAvailability                               │
│  ├─ Availability/updateAvailability                            │
│  ├─ Booking/getBookings                                        │
│  ├─ Booking/ackBooking                                         │
│  └─ Booking/postRoomAssignment                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                  Shared Database (PostgreSQL)                   │
│                                                                │
│  Tables:                                                       │
│  ├─ users          (email, password_hash, full_name)          │
│  ├─ tenants        (user_id, tenant_name)                     │
│  ├─ api_keys       (tenant_id, key_name, encrypted_value)     │
│  ├─ sessions       (JWT token tracking)                        │
│  └─ device_sessions (Claude Desktop authentication)           │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                    Firestore (Conversations)                    │
│                                                                │
│  Collections:                                                  │
│  ├─ conversations  (userId, tenantId, title, createdAt)       │
│  ├─ messages       (conversationId, role, content, metadata)  │
│  └─ auditLogs      (security events)                           │
└────────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenant Data Flow

### User Registration & Authentication

```
1. User visits Dashboard → /register
   ↓
2. Dashboard Backend → PostgreSQL: CREATE users + tenants
   ↓
3. Backend generates JWT token (userId + tenantId)
   ↓
4. Frontend stores JWT in localStorage
   ↓
5. All future requests include JWT in Authorization header
```

### API Key Management

```
1. Admin visits /admin/settings → "Add API Key"
   ↓
2. Dashboard Backend receives: { keyName: 'QUENDOO_API_KEY', keyValue: '...' }
   ↓
3. Backend calls MCP Server: POST /admin/api-keys
   │  Headers: Authorization: Bearer {JWT}
   ↓
4. MCP Server:
   │  - Verifies JWT token
   │  - Extracts tenantId from token
   │  - Encrypts API key (AES-256-GCM)
   │  - Stores in PostgreSQL: api_keys table
   ↓
5. Success response → Dashboard shows "API Key saved"
```

### Chat Message with Quendoo Tools

```
1. User types: "Show me available rooms for March 15-20"
   ↓
2. Frontend → Backend: POST /chat/quendoo
   │  Headers: Authorization: Bearer {JWT}
   │  Body: { message, conversationId, model }
   ↓
3. Dashboard Backend:
   │  - Verifies JWT token → extracts tenantId
   │  - Retrieves conversation from Firestore
   │  - Connects to MCP Server with JWT
   ↓
4. Dashboard Backend → MCP Server: SSE connection
   │  URL: https://mcp-server.run.app/mcp/sse?token={JWT}
   ↓
5. MCP Server:
   │  - Validates JWT token
   │  - Extracts tenantId from token
   │  - Sets tenant context for this request
   │  - Returns available tools for this tenant
   ↓
6. Dashboard Backend → Claude API:
   │  - Sends user message
   │  - Includes MCP tools in request
   │  - Claude decides to use "get_availability" tool
   ↓
7. Claude → MCP Server: Tool execution
   │  Tool: get_availability(date_from="2026-03-15", date_to="2026-03-20", sysres="BOOKING")
   ↓
8. MCP Server:
   │  - get_quendoo_client(ctx) → retrieves encrypted QUENDOO_API_KEY for tenantId
   │  - Decrypts API key
   │  - Creates QuendooClient with tenant's API key
   │  - Calls Quendoo PMS API: GET /Availability/getAvailability?api_key={tenant_key}
   ↓
9. Quendoo PMS API → Returns availability data:
   │  { "data": { "2667": { "2026-03-15": 10, "2026-03-16": 8, ... } } }
   ↓
10. MCP Server → Claude: Tool result
   ↓
11. Claude generates natural language response:
   │  "You have 10 Double Rooms available on March 15th, 8 on March 16th..."
   ↓
12. Dashboard Backend:
   │  - Saves message to Firestore (conversationId, role: 'assistant', content)
   │  - Streams response to Frontend
   ↓
13. Frontend displays AI response in chat UI
```

**Key Security Feature:** Each tenant's QUENDOO_API_KEY is isolated and encrypted. Tenant A cannot access Tenant B's API key or property data.

---

## MCP Server: Existing Multi-Tenant Implementation

### Authentication Flow (Already Implemented!)

The MCP server uses **Supabase JWT tokens** for authentication:

```python
# server_multitenant.py (lines 151-177)

def get_quendoo_client(ctx: Context) -> QuendooClient:
    """
    Create tenant-specific QuendooClient using encrypted API key from database.
    """
    # 1. Extract tenant_id from JWT token
    tenant_id = get_tenant_id_from_context(ctx)

    # 2. Retrieve encrypted API key from PostgreSQL
    quendoo_api_key = mt_key_manager.get_api_key(tenant_id, "QUENDOO_API_KEY")

    if not quendoo_api_key:
        raise ValueError(
            "QUENDOO_API_KEY not configured for your account. "
            "Please add it via the web portal."
        )

    # 3. Return QuendooClient configured with tenant's API key
    return QuendooClient(api_key=quendoo_api_key)
```

**Flow:**
1. JWT token contains `sub` (user_id from Supabase)
2. MCP server queries PostgreSQL: `SELECT id FROM tenants WHERE user_id = {sub}`
3. Uses `tenant_id` to retrieve encrypted `QUENDOO_API_KEY`
4. Decrypts key and creates `QuendooClient`

### Available Quendoo Tools (Already Implemented!)

The MCP server exposes **11+ tools** to Claude:

#### Property Management Tools

```python
@server.tool()
def get_property_settings(ctx: Context, api_lng: str | None = None, names: str | None = None) -> dict:
    """Get property settings including rooms, rates, services, meals, beds, booking modules."""
    client = get_quendoo_client(ctx)  # Tenant-aware!
    return client.get("/Property/getPropertySettings", params={"api_lng": api_lng, "names": names})

@server.tool()
def get_rooms_details(ctx: Context, api_lng: str | None = None, room_id: int | None = None) -> dict:
    """Get detailed information for rooms."""
    client = get_quendoo_client(ctx)
    return client.get("/Property/getRoomsDetails", params={"api_lng": api_lng, "room_id": room_id})
```

#### Availability Management Tools

```python
@server.tool()
def quendoo_get_availability(ctx: Context, date_from: str, date_to: str, sysres: str) -> dict:
    """Get availability for a date range and system (e.g., 'BOOKING', 'AIRBNB')."""
    client = get_quendoo_client(ctx)
    return client.get("/Availability/getAvailability", params={
        "date_from": date_from,
        "date_to": date_to,
        "sysres": sysres
    })

@server.tool()
def update_availability(ctx: Context, values: list[dict]) -> dict:
    """Update availability values for rooms or external rooms."""
    client = get_quendoo_client(ctx)
    return client.post("/Availability/updateAvailability", json={"values": values})
```

#### Booking Management Tools

```python
@server.tool()
def get_bookings(ctx: Context) -> dict:
    """List all bookings for the property."""
    client = get_quendoo_client(ctx)
    return client.get("/Booking/getBookings")

@server.tool()
def get_booking_offers(
    ctx: Context,
    date_from: str,
    nights: int,
    bm_code: str | None = None,
    api_lng: str | None = None,
    guests: list[dict] | None = None,
    currency: str | None = None
) -> dict:
    """Fetch booking offers for a booking module code and stay dates."""
    client = get_quendoo_client(ctx)
    # Auto-detects first active booking module if bm_code not provided
    if not bm_code:
        settings = client.get("/Property/getPropertySettings", params={"names": "booking_modules"})
        if settings.get("data", {}).get("booking_modules"):
            bm_code = settings["data"]["booking_modules"][0]["code"]

    return client.get("/Property/getBookingOffers", params={
        "bm_code": bm_code,
        "date_from": date_from,
        "nights": nights,
        "api_lng": api_lng,
        "guests": guests,
        "currency": currency
    })

@server.tool()
def ack_booking(ctx: Context, revision_id: int, booking_items: list[dict] | None = None) -> dict:
    """Acknowledge receipt of a booking."""
    client = get_quendoo_client(ctx)
    return client.post("/Booking/ackBooking", json={
        "revision_id": revision_id,
        "booking_items": booking_items
    })

@server.tool()
def post_room_assignment(ctx: Context, items: list[dict]) -> dict:
    """Assign room numbers and self check-in codes to booking items."""
    client = get_quendoo_client(ctx)
    return client.post("/Booking/postRoomAssignment", json={"items": items})
```

#### Email & Automation Tools

```python
@server.tool()
def send_email(ctx: Context, to: str, subject: str, html: str) -> dict:
    """Send HTML email via tenant's email configuration."""
    # Uses tenant-specific email API key from database

@server.tool()
def make_call(ctx: Context, phone: str, message: str, language: str = "bg") -> dict:
    """Make automated voice call with Bulgarian language support."""
    # Uses tenant-specific automation API key from database
```

**Total:** 11+ tenant-aware tools ready to use!

---

## Integration Plan

### Phase 1: User Authentication & Multi-Tenant Foundation (Week 1)

**Goal:** Connect Dashboard to MCP's PostgreSQL database for user management.

#### Step 1.1: Add PostgreSQL Connection to Dashboard Backend

```bash
cd backend/mcp-client
npm install pg bcrypt jsonwebtoken
```

**Create:** `backend/mcp-client/src/db/postgresClient.js`

```javascript
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.MCP_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  max: 20,
  idleTimeoutMillis: 30000
});

pool.on('connect', () => {
  console.log('[PostgreSQL] Connected to MCP database');
});

export default pool;
```

**Environment Variable:**
```bash
# backend/mcp-client/.env
MCP_DATABASE_URL=postgresql://user:password@host:5432/quendoo_mcp
JWT_SECRET=<generate-random-secret-32-chars>
```

#### Step 1.2: Create User Service

**Create:** `backend/mcp-client/src/db/userService.js`

```javascript
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create user
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, full_name, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, email, full_name`,
      [email, passwordHash, fullName]
    );

    const user = userResult.rows[0];

    // Create tenant for user
    const tenantResult = await client.query(
      `INSERT INTO tenants (user_id, tenant_name)
       VALUES ($1, $2)
       RETURNING id, tenant_name`,
      [user.id, `${fullName}'s Property`]
    );

    const tenant = tenantResult.rows[0];

    await client.query('COMMIT');

    return { user, tenant };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

#### Step 1.3: Create JWT Authentication Middleware

**Create:** `backend/mcp-client/src/auth/jwtAuth.js`

```javascript
import jwt from 'jsonwebtoken';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

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

#### Step 1.4: Add Login/Register Endpoints

**Modify:** `backend/mcp-client/src/index.js`

```javascript
import { authenticateToken } from './auth/jwtAuth.js';
import { getUserByEmail, getTenantByUserId, verifyPassword, createUser } from './db/userService.js';
import jwt from 'jsonwebtoken';

// Login endpoint
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

// Register endpoint
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, password, and full name required' });
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user and tenant
    const { user, tenant } = await createUser(email, password, fullName);

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
    console.error('[Auth] Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Token verification endpoint
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

#### Step 1.5: Update Conversation Endpoints to Use tenantId

**Modify:** `backend/mcp-client/src/index.js`

```javascript
// Before: hardcoded 'default'
app.get('/conversations', async (req, res) => {
  const conversations = await conversationService.getConversations('default', limit);
});

// After: use authenticated tenant
app.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const limit = parseInt(req.query.limit) || 50;
    const conversations = await conversationService.getConversations(tenantId, limit);
    res.json({ conversations });
  } catch (error) {
    console.error('[Conversations] Error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});
```

**Apply `authenticateToken` to all conversation endpoints:**
- `GET /conversations`
- `GET /conversations/search`
- `GET /conversations/:id`
- `POST /conversations`
- `PATCH /conversations/:id`
- `DELETE /conversations/:id`
- `POST /chat/quendoo`

---

### Phase 2: Frontend Authentication (Week 1-2)

#### Step 2.1: Create Auth Store

**Create:** `frontend/src/stores/authStore.js`

```javascript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('auth-token'));
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));

  const isAuthenticated = computed(() => !!token.value);

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

  async function register(email, password, fullName) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    const response = await axios.post(`${baseUrl}/auth/register`, {
      email,
      password,
      fullName
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

  async function verifyToken() {
    if (!token.value) return false;

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
      await axios.get(`${baseUrl}/auth/verify`, {
        headers: { Authorization: `Bearer ${token.value}` }
      });
      return true;
    } catch (error) {
      // Token invalid, clear auth
      logout();
      return false;
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    login,
    register,
    logout,
    verifyToken
  };
});
```

#### Step 2.2: Update API Service

**Modify:** `frontend/src/services/api.js`

```javascript
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add JWT token to all requests
apiClient.interceptors.request.use(config => {
  const authStore = useAuthStore();
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`;
  }
  return config;
});

// Handle 401 errors (expired token)
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore();
      authStore.logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default {
  // Conversations (now authenticated)
  async getConversations(limit = 50) {
    const response = await apiClient.get('/conversations', {
      params: { limit }
    });
    return response.data;
  },

  // ... rest of methods
};
```

#### Step 2.3: Create Login/Register Pages

**Create:** `frontend/src/views/LoginView.vue`

```vue
<template>
  <v-container class="fill-height" fluid>
    <v-row justify="center" align="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark flat>
            <v-toolbar-title>Login to Quendoo AI</v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <v-form @submit.prevent="handleLogin">
              <v-text-field
                v-model="email"
                label="Email"
                type="email"
                prepend-icon="mdi-email"
                required
                :error-messages="emailErrors"
              />
              <v-text-field
                v-model="password"
                label="Password"
                type="password"
                prepend-icon="mdi-lock"
                required
                :error-messages="passwordErrors"
              />
              <v-alert v-if="error" type="error" class="mt-3">
                {{ error }}
              </v-alert>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn text @click="$router.push('/register')">
              Register
            </v-btn>
            <v-btn color="primary" @click="handleLogin" :loading="loading">
              Login
            </v-btn>
          </v-card-actions>
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
const emailErrors = ref([]);
const passwordErrors = ref([]);
const error = ref(null);
const loading = ref(false);

const handleLogin = async () => {
  emailErrors.value = [];
  passwordErrors.value = [];
  error.value = null;

  if (!email.value) {
    emailErrors.value.push('Email is required');
    return;
  }

  if (!password.value) {
    passwordErrors.value.push('Password is required');
    return;
  }

  loading.value = true;

  try {
    await authStore.login(email.value, password.value);
    router.push('/');
  } catch (err) {
    error.value = err.response?.data?.error || 'Login failed';
  } finally {
    loading.value = false;
  }
};
</script>
```

#### Step 2.4: Add Route Guards

**Modify:** `frontend/src/router/index.js`

```javascript
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import ChatView from '../views/ChatView.vue';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';

const routes = [
  {
    path: '/',
    name: 'chat',
    component: ChatView,
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/admin/AdminDashboard.vue'),
    meta: { requiresAuth: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth) {
    // Verify token is still valid
    const isValid = await authStore.verifyToken();

    if (!isValid) {
      next('/login');
    } else {
      next();
    }
  } else {
    next();
  }
});

export default router;
```

---

### Phase 3: MCP Server Integration (Week 2-3)

**Goal:** Connect Dashboard backend to MCP server for Quendoo tools.

#### Step 3.1: Update Chat Endpoint to Use MCP Server

**Modify:** `backend/mcp-client/src/index.js` - `/chat/quendoo` endpoint

```javascript
import { QuendooClaudeIntegration } from './quendooClaudeIntegration.js';

app.post('/chat/quendoo', authenticateToken, async (req, res) => {
  try {
    const { message, conversationId, model } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    // Validate input
    const validation = inputValidator.validateInput(message);
    if (validation.blocked) {
      securityMonitor.logSecurityEvent({
        type: 'INPUT_VALIDATION_BLOCKED',
        userId,
        tenantId,
        conversationId,
        reason: validation.reason
      });
      return res.status(400).json({ error: 'Invalid input' });
    }

    // Get MCP server URL (could be from env or database)
    const mcpServerUrl = process.env.MCP_SERVER_URL || 'https://mcp-server.run.app/mcp/sse';

    // Generate JWT token for MCP server
    // MCP server expects same JWT format with userId/tenantId
    const mcpToken = jwt.sign(
      {
        userId: req.user.userId,
        tenantId: req.user.tenantId,
        email: req.user.email
      },
      process.env.JWT_SECRET, // Same secret as MCP server
      { expiresIn: '1h' }
    );

    // Connect to MCP server with JWT token
    const integration = new QuendooClaudeIntegration(
      process.env.ANTHROPIC_API_KEY,
      `${mcpServerUrl}?token=${mcpToken}` // Pass JWT as query parameter
    );

    // Send message to Claude with MCP tools
    const response = await integration.sendMessageWithTools(
      message,
      conversationId,
      model || 'claude-3-5-sonnet-20241022'
    );

    // Filter output
    const filtered = outputFilter.filterResponse(response.content);

    // Save to Firestore
    await conversationService.addMessage(conversationId, {
      role: 'assistant',
      content: filtered.content,
      metadata: {
        model,
        toolsUsed: response.toolsUsed || []
      }
    });

    res.json({
      status: 'success',
      response: {
        content: filtered.content,
        toolsUsed: response.toolsUsed
      }
    });
  } catch (error) {
    console.error('[Chat] Error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});
```

#### Step 3.2: Update QuendooClaudeIntegration Class

**Modify:** `backend/mcp-client/src/quendooClaudeIntegration.js`

The existing class should handle JWT authentication properly. Key changes:

```javascript
async connectToMCPServer() {
  if (this.sessionId) {
    console.log('[Quendoo] Already connected with session:', this.sessionId);
    return;
  }

  console.log(`[Quendoo] Connecting to MCP server at ${this.quendooServerUrl}`);

  // Connect to SSE endpoint with JWT token
  // Token is already in URL: https://mcp-server.run.app/mcp/sse?token=JWT
  await new Promise((resolve, reject) => {
    this.eventSource = new EventSource(this.quendooServerUrl);

    this.eventSource.addEventListener('endpoint', (event) => {
      // MCP server sends session endpoint
      const match = event.data.match(/session_id=([^&]+)/);
      if (match) {
        this.sessionId = match[1];
        const baseUrl = new URL(this.quendooServerUrl);
        this.postUrl = `${baseUrl.protocol}//${baseUrl.host}${event.data}`;
        console.log('[Quendoo] POST endpoint:', this.postUrl);
        resolve();
      }
    });

    this.eventSource.addEventListener('error', (error) => {
      console.error('[Quendoo] SSE error:', error);
      reject(error);
    });

    setTimeout(() => reject(new Error('MCP connection timeout')), 30000);
  });

  // Initialize MCP session
  await this.sendMCPRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'quendoo-dashboard',
      version: '1.0.0'
    }
  });

  // List available tools
  const toolsResponse = await this.sendMCPRequest('tools/list', {});
  this.availableTools = toolsResponse.tools || [];
  console.log(`[Quendoo] Loaded ${this.availableTools.length} MCP tools`);
}
```

---

### Phase 4: API Key Management UI (Week 3-4)

#### Step 4.1: Add API Key Management Endpoints

**Create:** `backend/mcp-client/src/db/apiKeyManager.js`

```javascript
import pool from './postgresClient.js';
import { encryptionManager } from '../security/encryption.js';

export async function saveApiKey(tenantId, keyName, keyValue) {
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

export async function getApiKey(tenantId, keyName) {
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

export async function listApiKeys(tenantId) {
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

export async function deleteApiKey(tenantId, keyName) {
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
```

**Add Endpoints:** `backend/mcp-client/src/index.js`

```javascript
import * as apiKeyManager from './db/apiKeyManager.js';

// Get all API keys for current tenant
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

// Save/update API key
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

// Delete API key
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

#### Step 4.2: Create Admin API Keys UI

**Create:** `frontend/src/views/admin/AdminApiKeys.vue`

```vue
<template>
  <admin-layout>
    <div class="admin-api-keys">
      <h2 class="mb-4">API Key Management</h2>

      <!-- List existing keys -->
      <v-card class="mb-4">
        <v-card-title>Your API Keys</v-card-title>
        <v-card-text>
          <v-list v-if="apiKeys.length > 0">
            <v-list-item v-for="key in apiKeys" :key="key.id">
              <template v-slot:prepend>
                <v-icon>mdi-key</v-icon>
              </template>
              <v-list-item-title>{{ key.keyName }}</v-list-item-title>
              <v-list-item-subtitle>
                Created: {{ formatDate(key.createdAt) }} |
                Updated: {{ formatDate(key.updatedAt) }}
              </v-list-item-subtitle>
              <template v-slot:append>
                <v-btn
                  icon="mdi-delete"
                  size="small"
                  color="error"
                  @click="confirmDelete(key.keyName)"
                />
              </template>
            </v-list-item>
          </v-list>
          <v-alert v-else type="info" variant="tonal">
            No API keys configured yet. Add one below to get started.
          </v-alert>
        </v-card-text>
      </v-card>

      <!-- Add new key form -->
      <v-card>
        <v-card-title>Add/Update API Key</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="saveKey">
            <v-select
              v-model="newKey.keyName"
              :items="availableKeyTypes"
              label="Key Type"
              required
            />
            <v-text-field
              v-model="newKey.keyValue"
              label="API Key Value"
              type="password"
              :hint="getKeyHint(newKey.keyName)"
              persistent-hint
              required
            />
            <v-alert v-if="error" type="error" class="mt-3" dismissible @click:close="error = null">
              {{ error }}
            </v-alert>
            <v-alert v-if="success" type="success" class="mt-3" dismissible @click:close="success = null">
              {{ success }}
            </v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" @click="saveKey" :loading="loading">
            Save API Key
          </v-btn>
        </v-card-actions>
      </v-card>
    </div>
  </admin-layout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import AdminLayout from './AdminLayout.vue';

const authStore = useAuthStore();
const apiKeys = ref([]);
const newKey = ref({ keyName: '', keyValue: '' });
const error = ref(null);
const success = ref(null);
const loading = ref(false);

const availableKeyTypes = [
  'QUENDOO_API_KEY',
  'ANTHROPIC_API_KEY',
  'EMAIL_API_KEY',
  'AUTOMATION_API_KEY'
];

const loadApiKeys = async () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  const response = await axios.get(`${baseUrl}/admin/api-keys`, {
    headers: { 'Authorization': `Bearer ${authStore.token}` }
  });
  apiKeys.value = response.data.keys;
};

const saveKey = async () => {
  error.value = null;
  success.value = null;

  if (!newKey.value.keyName || !newKey.value.keyValue) {
    error.value = 'Please fill in all fields';
    return;
  }

  loading.value = true;

  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    await axios.post(`${baseUrl}/admin/api-keys`, newKey.value, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    });

    success.value = 'API key saved successfully';
    newKey.value = { keyName: '', keyValue: '' };
    await loadApiKeys();
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to save API key';
  } finally {
    loading.value = false;
  }
};

const confirmDelete = async (keyName) => {
  if (!confirm(`Are you sure you want to delete ${keyName}?`)) {
    return;
  }

  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    await axios.delete(`${baseUrl}/admin/api-keys/${keyName}`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    });

    success.value = 'API key deleted successfully';
    await loadApiKeys();
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to delete API key';
  }
};

const getKeyHint = (keyName) => {
  const hints = {
    'QUENDOO_API_KEY': 'Your Quendoo PMS API key from platform.quendoo.com',
    'ANTHROPIC_API_KEY': 'Format: sk-ant-api03-...',
    'EMAIL_API_KEY': 'Email service API key',
    'AUTOMATION_API_KEY': 'Automation service API key'
  };
  return hints[keyName] || '';
};

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleString();
};

onMounted(loadApiKeys);
</script>

<style scoped>
.admin-api-keys {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}
</style>
```

---

## Summary: What Gets Built

### Backend (Node.js/Express)

**New Files:**
- `src/db/postgresClient.js` - PostgreSQL connection
- `src/db/userService.js` - User/tenant management
- `src/db/apiKeyManager.js` - API key CRUD operations
- `src/auth/jwtAuth.js` - JWT authentication middleware
- `src/security/encryption.js` - AES-256 encryption (Fernet equivalent)

**Modified Files:**
- `src/index.js` - Add auth endpoints, protect routes with `authenticateToken`
- `src/quendooClaudeIntegration.js` - Connect to MCP server with JWT token
- `src/db/conversationService.js` - Use tenantId instead of 'default'

### Frontend (Vue.js)

**New Files:**
- `src/stores/authStore.js` - Authentication state management
- `src/views/LoginView.vue` - Login page
- `src/views/RegisterView.vue` - Registration page
- `src/views/admin/AdminApiKeys.vue` - API key management UI

**Modified Files:**
- `src/router/index.js` - Add route guards for authentication
- `src/services/api.js` - Add JWT token to all requests
- `src/App.vue` - Add logout button, show user info

### Database

**PostgreSQL (Shared with MCP):**
- `users` - User accounts
- `tenants` - One tenant per user
- `api_keys` - Encrypted API keys per tenant
- `sessions` - JWT token tracking

**Firestore (Dashboard-specific):**
- `conversations` - Now includes tenantId field
- `messages` - Chat messages
- `auditLogs` - Security events

---

## Environment Variables

### Backend (.env)

```bash
# Existing
ANTHROPIC_API_KEY=<claude-api-key>
PORT=8080
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

# New for Multi-Tenant
MCP_DATABASE_URL=postgresql://user:password@host:5432/quendoo_mcp
JWT_SECRET=<generate-random-secret-key-32-chars>
JWT_PRIVATE_KEY=<same-as-mcp-server-for-encryption>
MCP_SERVER_URL=https://quendoo-mcp-multitenant-851052272168.us-central1.run.app/mcp/sse

# Optional
NODE_ENV=production
```

### Frontend (.env)

```bash
VITE_API_BASE_URL=http://localhost:8080
```

---

## Testing Checklist

### Phase 1: Authentication

- [ ] User can register with email/password
- [ ] User can login with credentials
- [ ] JWT token is generated with userId/tenantId
- [ ] Protected endpoints require valid JWT
- [ ] Invalid/expired tokens return 401
- [ ] Multiple users have separate tenants

### Phase 2: Multi-Tenant Isolation

- [ ] User A cannot see User B's conversations
- [ ] User A cannot access User B's conversation by ID
- [ ] Search only returns conversations for authenticated tenant
- [ ] Creating conversation assigns correct tenantId

### Phase 3: MCP Integration

- [ ] Dashboard connects to MCP server with JWT
- [ ] MCP server validates JWT and extracts tenantId
- [ ] Claude can use Quendoo tools (get_property_settings, etc.)
- [ ] Quendoo tools use tenant's encrypted API key
- [ ] Tool responses appear in chat

### Phase 4: API Key Management

- [ ] Admin can add QUENDOO_API_KEY
- [ ] API key is encrypted before storage
- [ ] API key is decrypted when MCP server uses it
- [ ] Admin can list API keys (without seeing values)
- [ ] Admin can delete API keys
- [ ] Tenant A cannot access Tenant B's API keys

---

## Security Considerations

1. **JWT Tokens:**
   - Use strong JWT_SECRET (min 32 characters)
   - Set reasonable expiration (7 days)
   - Verify token on every protected request

2. **API Key Encryption:**
   - Use AES-256-GCM (Fernet)
   - Derive key from JWT_PRIVATE_KEY via PBKDF2
   - 100,000 iterations for key derivation
   - Never expose decrypted keys to frontend

3. **Tenant Isolation:**
   - Always filter by tenantId in database queries
   - Never trust client-sent tenantId
   - Use authenticated user's tenantId from JWT

4. **Password Storage:**
   - Use bcrypt with salt rounds >= 10
   - Never store plaintext passwords

---

## Next Steps (After Research Phase)

1. **Get PostgreSQL Credentials:**
   - Need MCP_DATABASE_URL connection string
   - JWT_PRIVATE_KEY for encryption compatibility

2. **Start Phase 1:**
   - Install dependencies (pg, bcrypt, jsonwebtoken)
   - Create PostgreSQL connection
   - Implement authentication endpoints

3. **Test Integration:**
   - Verify Dashboard can authenticate with MCP database
   - Test conversation isolation per tenant
   - Test MCP server connection with JWT

4. **Deploy:**
   - Deploy backend to Cloud Run
   - Deploy frontend to Firebase Hosting
   - Test end-to-end in production

---

## Conclusion

**The MCP server already has everything we need for multi-tenant Quendoo integration!**

- ✅ Multi-tenant authentication (JWT + PostgreSQL)
- ✅ Encrypted API key storage per tenant
- ✅ All Quendoo PMS tools (property, booking, availability)
- ✅ Production-ready deployment

**Dashboard just needs to:**
1. Adopt MCP's authentication system (JWT)
2. Use tenantId for conversation isolation
3. Connect chat to MCP server (already has tools)
4. Add UI for API key management

**Estimated Timeline:**
- **Phase 1:** User Auth (1 week)
- **Phase 2:** Frontend Auth (1 week)
- **Phase 3:** MCP Integration (1 week)
- **Phase 4:** API Key UI (1 week)

**Total: 4 weeks** to full multi-tenant integration with Quendoo tools! 🚀
