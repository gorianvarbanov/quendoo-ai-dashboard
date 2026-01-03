# MCP Client Server

Node.js HTTP server that manages connections to MCP servers and provides an API for the PHP backend.

## Architecture

```
PHP Backend → HTTP → MCP Client Server → stdio → MCP Servers
```

The MCP Client Server:
- Manages multiple MCP server connections
- Exposes REST API for PHP backend
- Handles stdio transport to MCP servers
- Discovers and caches capabilities (tools, prompts, resources)

## Installation

```bash
cd backend/mcp-client
npm install
```

## Usage

### Start the server

```bash
npm run dev
```

Server will start on port 3100 (configurable via PORT environment variable).

### Health Check

```bash
curl http://localhost:3100/health
```

## API Endpoints

### Server Management

**List Connected Servers**
```bash
GET /servers
```

**Connect to MCP Server**
```bash
POST /servers/connect
Content-Type: application/json

{
  "serverId": "filesystem",
  "serverConfig": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/data"],
    "env": {}
  }
}
```

**Disconnect from Server**
```bash
DELETE /servers/:serverId
```

### Capabilities Discovery

**List Tools**
```bash
GET /servers/:serverId/tools
```

**List Prompts**
```bash
GET /servers/:serverId/prompts
```

### Tool Execution

**Call a Tool**
```bash
POST /tools/call
Content-Type: application/json

{
  "serverId": "filesystem",
  "toolName": "read_file",
  "arguments": {
    "path": "example.txt"
  }
}
```

**Get a Prompt**
```bash
POST /prompts/get
Content-Type: application/json

{
  "serverId": "myserver",
  "promptName": "example_prompt",
  "arguments": {
    "query": "test"
  }
}
```

### Chat Interface

**Send Chat Message**
```bash
POST /chat
Content-Type: application/json

{
  "message": "Read the file example.txt",
  "conversationId": "conv_123",
  "serverId": "filesystem"
}
```

## MCP Server Examples

### Filesystem Server

```bash
POST /servers/connect
{
  "serverId": "filesystem",
  "serverConfig": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:\\data"],
    "env": {}
  }
}
```

### GitHub Server

```bash
POST /servers/connect
{
  "serverId": "github",
  "serverConfig": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_TOKEN": "your-github-token"
    }
  }
}
```

### Memory Server

```bash
POST /servers/connect
{
  "serverId": "memory",
  "serverConfig": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-memory"],
    "env": {}
  }
}
```

## Available MCP Servers

Official MCP servers you can connect to:
- `@modelcontextprotocol/server-filesystem` - File system operations
- `@modelcontextprotocol/server-github` - GitHub repository access
- `@modelcontextprotocol/server-memory` - Persistent memory/storage
- `@modelcontextprotocol/server-postgres` - PostgreSQL database
- `@modelcontextprotocol/server-sqlite` - SQLite database
- `@modelcontextprotocol/server-brave-search` - Web search
- `@modelcontextprotocol/server-google-maps` - Google Maps integration

See https://github.com/modelcontextprotocol/servers for full list.

## Integration with PHP Backend

The PHP backend should:

1. Start this MCP client server as a background process
2. Make HTTP requests to connect MCP servers
3. Forward user queries to `/chat` endpoint
4. Display tool results in the chat interface

Example PHP integration (pseudo-code):

```php
// Start MCP client
$process = proc_open('node mcp-client/src/index.js', ...);

// Connect to filesystem server
$response = $httpClient->post('http://localhost:3100/servers/connect', [
  'json' => [
    'serverId' => 'filesystem',
    'serverConfig' => [
      'command' => 'npx',
      'args' => ['-y', '@modelcontextprotocol/server-filesystem', '/data']
    ]
  ]
]);

// Send chat message
$response = $httpClient->post('http://localhost:3100/chat', [
  'json' => [
    'message' => $userMessage,
    'conversationId' => $conversationId
  ]
]);
```

## Development

### Project Structure

```
mcp-client/
├── src/
│   ├── index.js              # Express server & API routes
│   └── mcpClientManager.js   # MCP connection manager
├── package.json
├── .env
└── README.md
```

### Adding New Features

- **New endpoints**: Add to `src/index.js`
- **MCP operations**: Add to `src/mcpClientManager.js`
- **Claude integration**: Create `src/claudeIntegration.js` for LLM-powered tool selection

## Troubleshooting

**Connection errors**: Make sure the MCP server command is installed
```bash
npx -y @modelcontextprotocol/server-filesystem --help
```

**Port already in use**: Change PORT in `.env`

**Tool call failures**: Check the tool arguments match the server's expected schema

## Next Steps

1. Integrate Claude API for intelligent tool selection
2. Add conversation history management
3. Implement tool result caching
4. Add WebSocket support for streaming responses
5. Create server configuration presets
