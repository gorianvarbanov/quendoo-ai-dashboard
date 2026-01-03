# Quendoo AI Dashboard - Backend API

PHP backend API for the Quendoo AI Dashboard. Acts as a proxy between the frontend and MCP servers.

## Technology Stack

- PHP 8.3+
- Slim Framework 4.x (Routing)
- Guzzle 7.8+ (HTTP/SSE client)
- Monolog 3.5+ (Logging)
- Session-based storage

## Project Structure

```
backend/
├── public/
│   └── index.php           # Application entry point
├── src/
│   ├── Controllers/
│   │   ├── ChatController.php       # Chat API endpoints
│   │   ├── ServerController.php     # Server management
│   │   └── HealthController.php     # Health check
│   ├── Middleware/
│   │   └── CorsMiddleware.php       # CORS handling
│   ├── Storage/
│   │   └── SessionStorage.php       # Session management
│   └── bootstrap.php                # App bootstrap & routing
├── storage/
│   ├── logs/
│   ├── sessions/
│   └── cache/
├── vendor/                          # Composer dependencies
├── .env                            # Environment configuration
└── composer.json
```

## Installation

Dependencies are already installed. If you need to reinstall:

```bash
cd backend
composer install
```

## Configuration

Environment variables in `.env`:

```env
APP_ENV=development
APP_DEBUG=true
MCP_SERVER_URL=https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse
CORS_ALLOWED_ORIGINS=http://localhost:3000
STORAGE_PATH=./storage
```

## Running the Server

Start the PHP development server:

```bash
cd backend
php -S localhost:8080 -t public
```

Or using the full PHP path:
```bash
"C:/Users/Gorian/AppData/Local/Microsoft/WinGet/Packages/PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe/php.exe" -S localhost:8080 -t public
```

The API will be available at: http://localhost:8080

## API Endpoints

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-03T15:21:51+00:00",
  "php_version": "8.3.29",
  "environment": "development"
}
```

### Chat Endpoints

#### Send Message
```
POST /chat/send
Content-Type: application/json

{
  "content": "Your message here",
  "conversationId": "optional-conversation-id",
  "serverId": "optional-server-id"
}
```

Response:
```json
{
  "status": "success",
  "conversationId": "conv_123...",
  "response": {
    "role": "assistant",
    "content": "AI response",
    "timestamp": "2026-01-03T15:22:12+00:00"
  }
}
```

#### Get Conversations
```
GET /chat/conversations
```

#### Get Specific Conversation
```
GET /chat/conversation/{id}
```

#### Delete Conversation
```
DELETE /chat/conversation/{id}
```

#### Stream Response (SSE)
```
GET /chat/stream?conversationId={id}
```
*Note: Will be implemented in Phase 4*

### Server Management Endpoints

#### Get All Servers
```
GET /servers
```

Response:
```json
[
  {
    "id": "default_server",
    "name": "Quendoo MCP Server",
    "url": "https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse",
    "description": "Default Quendoo MCP Server",
    "created_at": "2026-01-03T15:21:57+00:00",
    "status": "disconnected"
  }
]
```

#### Add Server
```
POST /servers
Content-Type: application/json

{
  "name": "My MCP Server",
  "url": "https://example.com/mcp",
  "description": "Optional description"
}
```

#### Get Specific Server
```
GET /servers/{id}
```

#### Delete Server
```
DELETE /servers/{id}
```

#### Test Server Connection
```
POST /servers/{id}/test
```

## Testing with cURL

Health check:
```bash
curl http://localhost:8080/health
```

Send a message:
```bash
curl -X POST http://localhost:8080/chat/send \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"Hello!\"}"
```

Get servers:
```bash
curl http://localhost:8080/servers
```

## Current Status

### ✅ Phase 3 Complete
- REST API endpoints functional
- CORS middleware configured
- Session-based storage
- Mock responses for chat

### 🔄 Next Phase
**Phase 4: MCP Server Integration**
- Implement MCPProxyService
- Implement SSEClientService
- Connect to real MCP server
- Streaming responses via SSE

## Error Handling

All endpoints return appropriate HTTP status codes:
- 200: Success
- 201: Created
- 204: No Content (successful deletion)
- 400: Bad Request
- 404: Not Found
- 500: Internal Server Error

Error response format:
```json
{
  "error": "Error message here"
}
```

## CORS

CORS is enabled for origins specified in `CORS_ALLOWED_ORIGINS` environment variable.

Default: `http://localhost:3000`

## Security

- Session cookies are HttpOnly
- CORS restrictions
- Input validation on all endpoints
- Session-based storage (stateless in future)

## Development

The application uses:
- PSR-7 for HTTP messages
- PSR-15 for middleware
- Composer autoloading (PSR-4)

## Logging

Logs will be stored in `storage/logs/` (to be implemented in Phase 4 with Monolog).
