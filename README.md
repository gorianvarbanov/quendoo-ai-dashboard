# Quendoo AI Dashboard

An AI chatbot dashboard built with Vue 3 + Vuetify frontend and PHP backend that communicates with MCP (Model Context Protocol) servers.

## Project Structure

```
quendoo-ai-dashboard/
├── frontend/          # Vue 3 + Vuetify application
├── backend/           # PHP proxy server
└── docs/             # Documentation
```

## Technology Stack

### Frontend
- Vue 3.4+ (Composition API)
- Vuetify 3.5+ (Material Design)
- Vite 5.0+ (Build tool)
- Pinia 2.1+ (State management)
- Axios 1.6+ (HTTP client)
- EventSource API (SSE client)

### Backend
- PHP 8.2+
- Slim Framework 4.x (Routing)
- Guzzle 7.8+ (HTTP/SSE client)
- Monolog 3.5+ (Logging)

## Prerequisites

### For Frontend Development
- Node.js 18+ and npm
- Modern web browser

### For Backend Development
- PHP 8.1 or higher
- Composer (PHP package manager)
- Apache or Nginx web server (or PHP built-in server for development)

## Installation

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies (already completed):
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at http://localhost:3000

4. Build for production:
   ```bash
   npm run build
   ```

### Backend Setup

1. **Install PHP 8.1+ and Composer** (if not already installed):

   **Windows:**
   - Download PHP from https://windows.php.net/download/
   - Download Composer from https://getcomposer.org/download/

   **macOS (using Homebrew):**
   ```bash
   brew install php@8.2
   brew install composer
   ```

   **Linux (Ubuntu/Debian):**
   ```bash
   sudo apt update
   sudo apt install php8.2 php8.2-cli php8.2-curl php8.2-mbstring php8.2-xml
   curl -sS https://getcomposer.org/installer | php
   sudo mv composer.phar /usr/local/bin/composer
   ```

2. Navigate to the backend directory:
   ```bash
   cd backend
   ```

3. Install PHP dependencies:
   ```bash
   composer install
   ```

4. Configure environment:
   - The `.env` file is already created with default settings
   - Update `MCP_SERVER_URL` if needed (currently set to: https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse)

5. Ensure storage directories are writable:
   ```bash
   chmod -R 755 storage/
   ```

6. Start PHP development server:
   ```bash
   php -S localhost:8080 -t public
   ```
   The backend API will be available at http://localhost:8080

## Development Workflow

1. Start backend server:
   ```bash
   cd backend
   php -S localhost:8080 -t public
   ```

2. In a new terminal, start frontend dev server:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open browser to http://localhost:3000

The Vite dev server automatically proxies API requests from `/api/*` to `http://localhost:8080`.

## Current Status

### ✅ Completed Features
- [x] Full Vue 3 + Vuetify chat interface with custom styling
- [x] Message persistence with localStorage
- [x] Conversation history management
- [x] Real-time streaming responses with typewriter effect
- [x] Multiple Claude model support (Sonnet 4.5, Opus 4.5, Haiku 4)
- [x] Settings page with API key configuration
- [x] MCP Server URL configuration
- [x] Node.js backend with MCP protocol integration
- [x] Direct communication with remote MCP servers via SSE
- [x] Table viewer for markdown tables
- [x] URL link detection and formatting
- [x] Dark/light theme toggle
- [x] Responsive mobile design

### Architecture Update

The project now uses a **Node.js backend** instead of PHP for better MCP protocol support:

```
Frontend (Vue 3 + Vuetify)
    ↓ HTTP + Axios
Node.js MCP Client (Express)
    ↓ JSON-RPC 2.0 over SSE
Quendoo MCP Server
    ↓ Tool execution
Claude API (Anthropic)
```

## Configuration

### Frontend Environment Variables

Located in `frontend/.env.development`:
```
VITE_API_BASE_URL=http://localhost:8080/api
VITE_APP_NAME=Quendoo AI Dashboard
VITE_APP_VERSION=1.0.0
```

### Backend Environment Variables

Located in `backend/.env`:
```
APP_ENV=development
MCP_SERVER_URL=https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse
CORS_ALLOWED_ORIGINS=http://localhost:3000
STORAGE_PATH=./storage
```

## MCP Server

The dashboard connects to the Quendoo MCP server at:
```
https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse
```

## Features (Planned)

- ✅ Chat interface with message history
- ✅ Multi-server management
- ✅ Settings/configuration panel
- 🔄 Real-time SSE streaming for AI responses
- 🔄 Authentication (will integrate with Quendoo auth later)

## Architecture

```
Frontend (Vue 3 + Vuetify)
    ↓ HTTP/SSE
PHP Backend Proxy
    ↓ JSON-RPC + SSE
MCP Server
```

The PHP backend acts as a proxy to:
- Handle CORS
- Manage SSE connections
- Add authentication layer (future)
- Log and monitor requests

## Deployment

### Quick Deployment Options

#### Option 1: All-in-One on Linode VPS ($10/month)
Deploy both frontend and backend on a single server:

1. Create a Linode VPS (Shared CPU 2GB plan)
2. Install Node.js 18+
3. Clone repository and install dependencies
4. Build frontend: `cd frontend && npm run build`
5. Configure Nginx to serve frontend static files and proxy backend
6. Run backend with PM2: `pm2 start backend/mcp-client/src/index.js`

#### Option 2: Vercel (Frontend) + Railway/Render (Backend)
- **Frontend**: Deploy to Vercel (Free tier available)
- **Backend**: Deploy to Railway or Render (Free tier available)
- Update `VITE_API_BASE_URL` in frontend to point to backend URL

#### Option 3: All on Railway.app
Deploy full-stack application with zero configuration:
- Connect GitHub repository
- Railway auto-detects Node.js apps
- Configure environment variables
- Deploy both services automatically

### Environment Variables for Production

**Frontend (.env.production):**
```
VITE_API_BASE_URL=https://your-backend-url.com
```

**Backend (.env):**
```
PORT=3100
ANTHROPIC_API_KEY=your-key-here
QUENDOO_MCP_URL=https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse
CORS_ALLOWED_ORIGINS=https://your-frontend-url.com
```

### Required Settings After Deployment

Users need to configure in Settings page:
1. **Anthropic API Key** - Get from https://console.anthropic.com/
2. **MCP Server URL** - Your remote MCP server endpoint (default provided)
3. **MCP Client URL** - Backend API endpoint (auto-configured)

## Contributing

This project follows the implementation plan in the `.claude/plans` directory.

## License

Proprietary - Quendoo
