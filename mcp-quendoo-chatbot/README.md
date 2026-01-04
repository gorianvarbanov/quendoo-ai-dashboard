# MCP Quendoo Chatbot

Multi-tenant MCP server for Quendoo hotel management system integration with AI chatbots.

## Architecture

```
Dashboard (Vue.js) → Backend (Node.js) → MCP Quendoo Chatbot (Python) → Quendoo API
```

## Features

- **Multi-tenant isolation**: Each hotel has separate tenant_id and encrypted API keys
- **Connection-based context**: connection_id → tenant_id mapping
- **14 Quendoo tools**: Property management, bookings, availability, email, voice calls
- **Encrypted storage**: API keys encrypted with AES-256-GCM (Fernet)
- **FastAPI framework**: Modern, async Python web framework
- **SQLite/PostgreSQL**: Flexible database support

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export ENCRYPTION_KEY="your-fernet-key-here"
export DATABASE_URL="sqlite:///./chatbot.db"
export JWT_SECRET="your-jwt-secret"

# Run locally
python -m uvicorn app.main:app --reload --port 8000

# Test
curl http://localhost:8000/health
```

## Project Structure

```
mcp-quendoo-chatbot/
├── app/
│   ├── main.py                      # FastAPI application
│   ├── config.py                    # Configuration
│   ├── models/
│   │   ├── __init__.py
│   │   └── tenant.py                # Pydantic & SQLAlchemy models
│   ├── database/
│   │   ├── __init__.py
│   │   ├── connection.py            # Database connection
│   │   ├── crud.py                  # CRUD operations
│   │   └── encryption.py            # Fernet encryption
│   ├── mcp/
│   │   ├── __init__.py
│   │   ├── protocol.py              # MultitenantMCPServer class
│   │   ├── tool_registry.py         # Tool registration
│   │   └── tool_executor.py         # Tool execution logic
│   ├── quendoo/
│   │   ├── __init__.py
│   │   ├── client.py                # Quendoo API HTTP client
│   │   └── tools.py                 # 14 Quendoo tool implementations
│   └── api/
│       ├── __init__.py
│       ├── mcp_routes.py            # MCP endpoints
│       └── admin_routes.py          # Admin API key management
├── tests/
│   ├── test_mcp.py
│   ├── test_encryption.py
│   └── test_quendoo_tools.py
├── requirements.txt
├── Dockerfile
├── .env.example
└── README.md
```

## API Endpoints

### MCP Protocol
- `POST /mcp/connect` - Establish connection with tenant context
- `POST /mcp/tools/execute` - Execute tool with connection_id
- `POST /mcp/disconnect` - Disconnect and cleanup
- `GET /mcp/tools/list` - List all available tools

### Admin
- `POST /admin/api-keys` - Save encrypted API key for tenant
- `GET /admin/api-keys/{tenant_id}` - List tenant's API keys (without values)
- `DELETE /admin/api-keys/{tenant_id}/{key_name}` - Delete API key

### Health
- `GET /health` - Health check

## Multi-Tenant Flow

```
1. User opens dashboard → Frontend loads
2. User logs in → Gets tenant_id from auth
3. Frontend sends message → Backend receives with tenant_id
4. Backend calls: POST /mcp/connect { tenant_id, metadata }
5. MCP returns: { connection_id: "conn_abc123" }
6. MCP stores: connections["conn_abc123"] = { tenant_id, api_key, ... }
7. Backend calls: POST /mcp/tools/execute { connection_id, tool_name, args }
8. MCP looks up tenant from connection_id
9. MCP gets tenant's encrypted Quendoo API key
10. MCP calls Quendoo API with tenant's key
11. MCP returns result to backend
12. Backend sends to Claude → Claude responds
13. Backend returns to frontend
```

## Environment Variables

```bash
# Encryption
ENCRYPTION_KEY=your-fernet-encryption-key

# Database
DATABASE_URL=sqlite:///./chatbot.db
# Or for PostgreSQL:
# DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Security
JWT_SECRET=your-jwt-secret-key

# Server
HOST=0.0.0.0
PORT=8000
```

## Deployment (Google Cloud Run)

```bash
# Build and deploy
gcloud run deploy mcp-quendoo-chatbot \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars ENCRYPTION_KEY=$ENCRYPTION_KEY,JWT_SECRET=$JWT_SECRET
```

## Development

```bash
# Install dev dependencies
pip install -r requirements-dev.txt

# Run tests
pytest

# Format code
black app/ tests/

# Lint
flake8 app/ tests/
```

## Security

- All API keys encrypted at rest with Fernet (AES-256-GCM)
- JWT token required for admin endpoints
- Tenant isolation enforced at connection level
- No cross-tenant data leakage
- Encryption key never logged or exposed

## License

MIT
