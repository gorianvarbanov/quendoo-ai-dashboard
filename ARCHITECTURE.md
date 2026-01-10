# Quendoo AI Dashboard - Architecture Overview

## System Architecture

```
┌─────────────────┐
│                 │
│   User Browser  │
│                 │
└────────┬────────┘
         │
         │ HTTPS
         │
┌────────▼────────────────────────────────────────────────┐
│                                                          │
│  Frontend (Vite + Vue 3)                                │
│  - Local dev: http://localhost:3000-3009                │
│  - Production: https://quendoo-ai-dashboard.web.app     │
│                                                          │
└────────┬─────────────────────────────────────────────────┘
         │
         │ HTTP/SSE
         │
┌────────▼────────────────────────────────────────────────┐
│                                                          │
│  Backend (Node.js + Express)                            │
│  - Local dev: http://localhost:3100                     │
│  - Production: https://quendoo-backend-*.run.app        │
│  - Current revision: quendoo-backend-00113-52h          │
│                                                          │
│  Routes:                                                 │
│  - POST /chat/quendoo - Chat with Claude AI             │
│  - GET/POST /conversations - Conversation management    │
│  - GET/POST /settings - User settings                   │
│                                                          │
└────────┬───────────────────────┬─────────────────────────┘
         │                       │
         │ Anthropic API         │ MCP Protocol (SSE)
         │                       │
┌────────▼────────┐     ┌────────▼──────────────────────────┐
│                 │     │                                    │
│  Claude API     │     │  MCP Quendoo Server (Python)      │
│  (Anthropic)    │     │  - Production only (no local dev) │
│                 │     │  - URL: https://mcp-quendoo-      │
│                 │     │    chatbot-*.run.app/sse          │
└─────────────────┘     │  - Current: 00022-f9w             │
                        │                                    │
                        │  Main file: app/main.py            │
                        │  Uses: app/api/sse_mcp_routes.py  │
                        │  Tools: app/quendoo/tools.py       │
                        │  HTTP client: app/quendoo/client.py│
                        │                                    │
                        └────────┬───────────────────────────┘
                                 │
                                 │ HTTPS/REST API
                                 │
                        ┌────────▼───────────────────────────┐
                        │                                    │
                        │  Quendoo Platform API              │
                        │  https://www.platform.quendoo.com  │
                        │                                    │
                        │  Endpoints used:                   │
                        │  - /api/pms/v1/Availability/...    │
                        │  - /api/pms/v1/Property/...        │
                        │  - /api/pms/v1/Booking/...         │
                        │                                    │
                        └────────────────────────────────────┘
```

## Active Servers

### 1. Frontend (Vue 3 + Vite)
**Location:** `frontend/`
**Main file:** `frontend/src/main.js`
**Tech stack:** Vue 3, Vuetify, Pinia, Vite

**Local development:**
```bash
cd frontend
npm run dev
# Starts on http://localhost:3000 (or 3001, 3007, 3009 if port is taken)
```

**Production deployment:**
```bash
cd frontend
npm run build
firebase deploy --only hosting
# Deploys to: https://quendoo-ai-dashboard.web.app
```

**Key features:**
- Chat interface with AI assistant
- Availability table visualization
- Availability calendar panel
- Settings management
- Conversation history

---

### 2. Backend (Node.js + Express)
**Location:** `backend/mcp-client/`
**Main file:** `backend/mcp-client/src/index.js`
**Tech stack:** Node.js, Express, Firestore, Anthropic SDK, EventSource (for SSE)

**Local development:**
```bash
cd backend/mcp-client
npm start
# Starts on http://localhost:3100
```

**Production deployment:**
```bash
cd backend/mcp-client
gcloud run deploy quendoo-backend --source . --region us-central1 --project quendoo-ai-dashboard
# Current revision: quendoo-backend-00067-q24
```

**Environment variables (.env):**
```
PORT=3100
ANTHROPIC_API_KEY=<your-key>
CORS_ALLOWED_ORIGINS=https://quendoo-ai-dashboard.web.app,http://localhost:3000,...
MCP_SERVER_URL=https://mcp-quendoo-chatbot-222402522800.us-central1.run.app
QUENDOO_SYSTEM_PROMPT_VERSION=2.1
```

**Key features:**
- Routes Claude API requests with streaming support
- Manages MCP server connections via SSE
- Handles tool execution coordination
- Conversation storage in Firestore
- System prompt management (server-controlled, immutable)

**Important files:**
- `src/index.js` - Main Express server, routes
- `src/quendooClaudeIntegration.js` - MCP client, tool execution, streaming
- `src/systemPrompts.js` - System prompts (v2.1 - relaxed injection defense)

---

### 3. MCP Quendoo Server (Python + FastAPI)
**Location:** `mcp-quendoo-chatbot/`
**Main file:** `mcp-quendoo-chatbot/app/main.py`
**Tech stack:** Python 3.11, FastAPI, httpx, uvicorn

**NO LOCAL DEVELOPMENT** - Only deployed to Cloud Run

**Production deployment:**
```bash
cd mcp-quendoo-chatbot
gcloud run deploy mcp-quendoo-chatbot --source . --region us-central1 --project quendoo-ai-dashboard --allow-unauthenticated --set-secrets=ENCRYPTION_KEY=ENCRYPTION_KEY:latest,JWT_SECRET=JWT_SECRET:latest,QUENDOO_AUTOMATION_BEARER=QUENDOO_AUTOMATION_BEARER:latest,EMAIL_API_KEY=EMAIL_API_KEY:latest --set-env-vars=GOOGLE_CLOUD_PROJECT=quendoo-ai-dashboard
# Current revision: mcp-quendoo-chatbot-00022-f9w
```

**Dockerfile entry point:**
```dockerfile
CMD python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

**Architecture:**
- `app/main.py` - FastAPI application
- `app/api/sse_mcp_routes.py` - SSE endpoint (/sse) and messages endpoint (/messages/)
- `app/quendoo/tools.py` - Tool definitions and `execute_quendoo_tool()` function
- `app/quendoo/client.py` - Quendoo API HTTP client (60s timeout)

**Key features:**
- MCP protocol implementation over SSE
- Per-session API key management
- Quendoo API integration (13 tools including document RAG)
- Data transformation (Quendoo format → Frontend format)

**Available tools:**
1. `get_property_settings` - Hotel settings, rooms, rates
2. `get_rooms_details` - Room type details
3. `get_availability` - Room availability (with data transformation)
4. `update_availability` - Update availability
5. `get_bookings` - List bookings
6. `get_booking_offers` - Get booking prices
7. `ack_booking` - Acknowledge booking
8. `post_room_assignment` - Assign rooms
9. `post_external_property_data` - External property data
10. `make_call` - Voice call automation
11. `send_quendoo_email` - Send email
12. `search_hotel_documents` - Semantic search in uploaded hotel documents (RAG)
13. `list_hotel_documents` - List all uploaded documents for the hotel

---

## Request Flow Example: "дай наличности за февруари"

1. **User → Frontend:** User types message in chat
2. **Frontend → Backend:** POST `/chat/quendoo` with message
3. **Backend → Claude API:** Sends message with system prompt and available MCP tools
4. **Claude API → Backend:** Returns response with tool_use block (get_availability)
5. **Backend → MCP Server:** POST `/messages/?session_id=xxx` with tool call
6. **MCP Server → Quendoo API:** GET `/api/pms/v1/Availability/getAvailability`
7. **Quendoo API → MCP Server:** Returns `{"data": {"44": {"2026-02-01": 10, ...}}}`
8. **MCP Server (transformation):** Converts to `{"availability": [{"room_id": 44, "date": "2026-02-01", "qty": 10}, ...]}`
9. **MCP Server → Backend:** Returns transformed data
10. **Backend → Claude API:** Sends tool_result to Claude
11. **Claude API → Backend:** Returns final text response
12. **Backend → Frontend (SSE):** Streams message chunks + tool metadata
13. **Frontend:** Displays AI message + availability table + "View Calendar" button

---

## Data Flow: Availability Data

### Original Quendoo API Format:
```json
{
  "data": {
    "44": {
      "2026-02-01": 10,
      "2026-02-02": 10,
      "2026-02-03": 10
    },
    "45": {
      "2026-02-01": 10,
      "2026-02-02": 10,
      "2026-02-03": 10
    }
  }
}
```

### Transformed Format (by MCP Server):
```json
{
  "date_from": "2026-02-01",
  "date_to": "2026-02-03",
  "availability": [
    {
      "room_id": 44,
      "room_name": "Room 44",
      "date": "2026-02-01",
      "qty": 10,
      "is_opened": true
    },
    {
      "room_id": 44,
      "room_name": "Room 44",
      "date": "2026-02-02",
      "qty": 10,
      "is_opened": true
    },
    ...
  ]
}
```

### Frontend Processing:
- `ChatMessage.vue` (lines 768-815): Groups consecutive dates with same qty into date ranges
- Displays as table with rows for date ranges, columns for rooms
- Color codes: green (≥3), yellow (<3), gray (0)
- "View Calendar" button opens `AvailabilityPanel.vue` with full calendar view

---

## Development Workflow

### Working on Frontend:
```bash
# Terminal 1 - Backend
cd backend/mcp-client
npm start

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Working on Backend:
```bash
# Terminal 1 - Backend (with auto-reload)
cd backend/mcp-client
npm start

# Terminal 2 - Frontend (pointing to local backend)
cd frontend
npm run dev
# Make sure frontend/.env has: VITE_API_BASE_URL=http://localhost:3100
```

### Deploying to Production:
```bash
# 1. Deploy MCP server (if changed)
cd mcp-quendoo-chatbot
gcloud run deploy mcp-quendoo-chatbot --source . --region us-central1 --project quendoo-ai-dashboard --allow-unauthenticated

# 2. Deploy backend (if changed)
cd backend/mcp-client
gcloud run deploy quendoo-backend --source . --region us-central1 --project quendoo-ai-dashboard

# 3. Deploy frontend
cd frontend
npm run build
firebase deploy --only hosting
```

---

## Important Configuration Files

### Frontend:
- `frontend/.env.development` - Local dev API URL
- `frontend/.env.production` - Production API URL
- `frontend/vite.config.js` - Vite configuration

### Backend:
- `backend/mcp-client/.env` - Environment variables (API keys, CORS, MCP URL)
- `backend/mcp-client/src/systemPrompts.js` - System prompt v2.1

### MCP Server:
- `mcp-quendoo-chatbot/.env.production` - Production environment variables
- `mcp-quendoo-chatbot/env.yaml` - Cloud Run environment variables (NOTE: Don't use with deployment, causes ENCRYPTION_KEY conflict)
- `mcp-quendoo-chatbot/Dockerfile` - Container definition

---

## Unused Files (Can be deleted)

The following files are NOT used in the current architecture:

### In `mcp-quendoo-chatbot/`:
- `fastmcp_server.py` - Standalone FastMCP server (not used, we use app/main.py)
- `hybrid_server.py` - Old hybrid server (not used)

These files have duplicate tool definitions but are not loaded by the Dockerfile.

---

## System Prompt Version History

**v2.1 (Current)** - 2026-01-06
- Relaxed injection defense to allow typos and normal queries
- Whitelists availability queries: "дай наличности", "покажи налични стаи"
- Only blocks clear injection attempts
- Removed "remaining tasks" messaging

**v2.0** - 2026-01-06
- Added explicit examples for availability queries
- Improved tool usage instructions

**v1.9** - Earlier version
- Stricter injection defense (caused false positives)

---

## Recent Issues Fixed

1. **HTTP 522 Timeout** - Increased HTTP client timeout from 30s to 60s in `app/quendoo/client.py`
2. **Data Format Mismatch** - Added transformation in `app/quendoo/tools.py` to convert Quendoo API format to frontend format
3. **Injection Defense Too Strict** - Relaxed to whitelist normal queries (system prompt v2.1)
4. **MCP Server URL** - Fixed to use `mcp-quendoo-chatbot` instead of wrong server name

---

## Monitoring & Logs

### Frontend logs:
```bash
# Browser console (F12)
```

### Backend logs:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=quendoo-backend" --limit 50 --project quendoo-ai-dashboard
```

### MCP Server logs:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=mcp-quendoo-chatbot" --limit 50 --project quendoo-ai-dashboard
```

---

## Contact & Support

- GitHub: https://github.com/gorianvarbanov/quendoo-ai-dashboard
- Issues: Report at GitHub Issues
- Production URL: https://quendoo-ai-dashboard.web.app
