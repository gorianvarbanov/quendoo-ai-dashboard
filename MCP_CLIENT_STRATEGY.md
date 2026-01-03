# MCP Client Implementation Strategy

## Current Situation

We've built a dashboard that can communicate with MCP servers, but we've encountered an issue:

**Quendoo MCP Server** appears to use a **custom/simplified protocol** rather than the standard MCP specification:
- ✅ Custom SSE session initialization (GET /sse → session_id)
- ❌ Non-standard message format (returns 400 errors for all tested formats)
- ❌ No JSON-RPC 2.0 handshake
- ❌ No capability discovery (tools, prompts, resources)

## Two Implementation Paths

### Path A: Continue with Quendoo-Specific Implementation ⚠️

**Status**: Currently blocked - need message format from Quendoo team

**What we have:**
- `QuendooMCPService.php` - handles custom SSE session flow
- `buildMessagePayload()` method ready for configuration
- Test script to validate formats

**What we need:**
1. Correct JSON message format from Quendoo documentation
2. Update `buildMessagePayload()` in `backend/src/Services/QuendooMCPService.php`
3. Test and validate responses

**Pros:**
- ✅ Quick implementation once format is known
- ✅ Works with existing Quendoo infrastructure
- ✅ Already partially implemented

**Cons:**
- ❌ Blocked until we get API documentation
- ❌ Proprietary format - not compatible with other MCP servers
- ❌ Limited to Quendoo's specific features
- ❌ Cannot leverage standard MCP ecosystem

### Path B: Build Standard MCP Client 🌟 RECOMMENDED

**Status**: Not started - requires new architecture

**What this means:**
- Implement proper MCP protocol following the specification
- Use MCP SDK (Python or TypeScript/Node.js)
- Support standard MCP servers (file system, GitHub, databases, etc.)
- Full capability discovery (tools, prompts, resources)
- Can still support Quendoo if they provide standard MCP interface

**Architecture:**

```
Frontend (Vue + Vuetify)
        ↓
Backend PHP Proxy
        ↓
Node.js/Python MCP Client Process
        ↓
Standard MCP Servers (stdio/HTTP transport)
```

**Implementation Steps:**

#### Phase 1: Choose MCP SDK and Transport
- **Option 1**: TypeScript SDK (`@modelcontextprotocol/sdk`)
  - Best integration with JavaScript ecosystem
  - Can run Node.js process from PHP
  - Official SDK with full features

- **Option 2**: Python SDK (`mcp`)
  - Article example uses Python
  - More examples available
  - Can run Python process from PHP

#### Phase 2: Create MCP Client Service
Create a separate Node.js/Python service that:
1. Connects to multiple MCP servers
2. Performs initialization handshake
3. Discovers tools, prompts, resources
4. Maintains session mappings
5. Routes tool calls to correct server
6. Integrates with Claude API for LLM reasoning

#### Phase 3: PHP Backend Integration
Update PHP backend to:
1. Launch and manage MCP client process
2. Send user queries to MCP client
3. Receive responses and forward to frontend
4. Handle process lifecycle

#### Phase 4: Frontend Updates
Update Vue frontend to:
1. Display available tools/prompts from MCP servers
2. Show tool execution results
3. Handle streaming responses from Claude

**Pros:**
- ✅ Standard MCP protocol - works with any MCP server
- ✅ Access to growing MCP ecosystem
- ✅ Proper capability discovery
- ✅ Future-proof and maintainable
- ✅ Can integrate Claude API for smart tool usage
- ✅ Not blocked by Quendoo documentation

**Cons:**
- ❌ More complex architecture (PHP + Node.js/Python)
- ❌ Additional dependencies
- ❌ Requires Claude API key for LLM features
- ❌ More development time

## Recommendation

**Pursue Path B (Standard MCP Client)** for the following reasons:

1. **Not Blocked**: Can continue development without waiting for Quendoo
2. **Future-Proof**: Standard protocol means long-term compatibility
3. **Ecosystem Access**: Can connect to any standard MCP server
4. **Better Features**: Full capability discovery and tool orchestration
5. **Professional**: Follows industry standards and best practices

**Fallback**: Keep Path A code in place - if Quendoo provides the message format later, we can add it as an alternate transport to the standard MCP client.

## Next Steps

If proceeding with Path B:

### 1. Choose SDK: TypeScript (Recommended)
- **Install**: `npm install @modelcontextprotocol/sdk`
- **Create**: `backend/mcp-client/` directory with Node.js project
- **Reference**: https://github.com/modelcontextprotocol/typescript-sdk

### 2. Implement MCP Client
Create `backend/mcp-client/src/client.js`:
- Initialize MCP client with stdio transport
- Connect to configured MCP servers
- Expose HTTP/WebSocket API for PHP backend
- Integrate Claude API for tool reasoning

### 3. Update PHP Backend
Create `backend/src/Services/MCPClientProxyService.php`:
- Launch Node.js MCP client process
- Send HTTP requests to MCP client
- Handle responses and forward to frontend

### 4. Add Server Configuration
Allow users to configure MCP servers in settings:
- Server type (filesystem, GitHub, database, etc.)
- Transport (stdio, HTTP)
- Configuration parameters

### 5. Update Frontend
Enhance UI to show:
- Available MCP servers and their status
- Discovered tools and prompts
- Tool execution results in chat

## Example: Standard MCP Implementation

```typescript
// backend/mcp-client/src/client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({
  name: 'quendoo-dashboard',
  version: '1.0.0'
});

// Connect to MCP server
const transport = new StdioClientTransport({
  command: 'mcp-server-filesystem',
  args: ['--root', '/path/to/data']
});

await client.connect(transport);

// List available tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool({
  name: 'read_file',
  arguments: { path: 'data.txt' }
});
```

## Resources

- MCP Specification: https://modelcontextprotocol.io/docs
- TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Python SDK: https://github.com/modelcontextprotocol/python-sdk
- Example Servers: https://github.com/modelcontextprotocol/servers
- Building Custom Client: https://towardsdatascience.com/building-a-сustom-mcp-chatbot/

## Timeline Estimate

**Path A (Quendoo-specific)**:
- Once format received: 1-2 hours to implement and test

**Path B (Standard MCP)**:
- Phase 1-2 (MCP Client): 4-6 hours
- Phase 3 (PHP Integration): 2-3 hours
- Phase 4 (Frontend Updates): 2-3 hours
- **Total**: 8-12 hours

## Decision Point

**Question for you**: Which path would you like to pursue?

1. **Wait for Quendoo format** (Path A) - Quick but blocked
2. **Build standard MCP client** (Path B) - More work but immediately actionable and future-proof
3. **Hybrid approach** - Start Path B, add Quendoo support later if format provided

I recommend **Option 3 (Hybrid)** - build the standard MCP client now so we're not blocked, and we can always add Quendoo's custom format later as an additional transport option.
