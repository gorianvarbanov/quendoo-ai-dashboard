/**
 * MCP Client Server
 * Provides HTTP API for PHP backend to interact with MCP servers
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MCPClientManager } from './mcpClientManager.js';
import { ClaudeIntegration } from './claudeIntegration.js';
import { QuendooClaudeIntegration } from './quendooClaudeIntegration.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3100;

// Configure CORS
const corsOptions = {
  origin: process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : '*',
  credentials: true,
  optionsSuccessStatus: 200
};

console.log('CORS configuration:', corsOptions);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Initialize MCP Client Manager
const mcpManager = new MCPClientManager();

// Initialize Claude Integration (if API key provided)
// Note: API key can also come from request headers for user-specific keys
let claudeIntegration = null;
const envApiKey = process.env.ANTHROPIC_API_KEY;

if (envApiKey && envApiKey !== 'your-api-key-here') {
  claudeIntegration = new ClaudeIntegration(envApiKey, mcpManager);
  console.log('Claude API integration enabled (from .env)');
} else {
  console.log('Claude API will use keys from request headers');
}

// Routes

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connectedServers: mcpManager.getConnectedServers()
  });
});

/**
 * List all connected MCP servers
 */
app.get('/servers', (req, res) => {
  try {
    const servers = mcpManager.getConnectedServers();
    res.json({ servers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Connect to a new MCP server
 * POST /servers/connect
 * Body: { serverId, serverConfig: { command, args, env } }
 */
app.post('/servers/connect', async (req, res) => {
  try {
    const { serverId, serverConfig } = req.body;

    if (!serverId || !serverConfig) {
      return res.status(400).json({ error: 'serverId and serverConfig required' });
    }

    await mcpManager.connectServer(serverId, serverConfig);

    res.json({
      success: true,
      serverId,
      message: 'Server connected successfully'
    });
  } catch (error) {
    console.error('Failed to connect server:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Disconnect from an MCP server
 * DELETE /servers/:serverId
 */
app.delete('/servers/:serverId', async (req, res) => {
  try {
    const { serverId } = req.params;
    await mcpManager.disconnectServer(serverId);

    res.json({
      success: true,
      message: 'Server disconnected successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * List available tools from a server
 * GET /servers/:serverId/tools
 */
app.get('/servers/:serverId/tools', async (req, res) => {
  try {
    const { serverId } = req.params;
    const tools = await mcpManager.listTools(serverId);

    res.json({ tools });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * List available prompts from a server
 * GET /servers/:serverId/prompts
 */
app.get('/servers/:serverId/prompts', async (req, res) => {
  try {
    const { serverId } = req.params;
    const prompts = await mcpManager.listPrompts(serverId);

    res.json({ prompts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Call a tool
 * POST /tools/call
 * Body: { serverId, toolName, arguments }
 */
app.post('/tools/call', async (req, res) => {
  try {
    const { serverId, toolName, arguments: toolArgs } = req.body;

    if (!serverId || !toolName) {
      return res.status(400).json({ error: 'serverId and toolName required' });
    }

    const result = await mcpManager.callTool(serverId, toolName, toolArgs || {});

    res.json({ result });
  } catch (error) {
    console.error('Tool call failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a prompt
 * POST /prompts/get
 * Body: { serverId, promptName, arguments }
 */
app.post('/prompts/get', async (req, res) => {
  try {
    const { serverId, promptName, arguments: promptArgs } = req.body;

    if (!serverId || !promptName) {
      return res.status(400).json({ error: 'serverId and promptName required' });
    }

    const prompt = await mcpManager.getPrompt(serverId, promptName, promptArgs || {});

    res.json({ prompt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process a chat message
 * POST /chat
 * Body: { message, conversationId, serverId? }
 *
 * Uses Claude API to:
 * 1. Analyze user message
 * 2. Determine which tools to call
 * 3. Execute tools automatically
 * 4. Generate intelligent response
 */
app.post('/chat', async (req, res) => {
  try {
    const { message, conversationId, serverId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }

    const finalConversationId = conversationId || `conv_${Date.now()}`;

    // Get API key from header (user-specific) or use default from env
    const requestApiKey = req.headers['x-anthropic-api-key'];
    let activeClaudeIntegration = claudeIntegration;

    // If request has API key, create temporary Claude integration for this request
    if (requestApiKey && requestApiKey !== 'your-api-key-here') {
      console.log('[Chat] Using API key from request header');
      activeClaudeIntegration = new ClaudeIntegration(requestApiKey, mcpManager);
    }

    // Use Claude if available
    if (activeClaudeIntegration) {
      console.log(`[Chat] Processing with Claude: "${message.substring(0, 50)}..."`);

      const result = await activeClaudeIntegration.processMessage(
        message,
        finalConversationId,
        serverId
      );

      res.json({
        conversationId: finalConversationId,
        response: {
          role: 'assistant',
          content: result.content,
          timestamp: new Date().toISOString(),
          toolsUsed: result.toolsUsed || false
        }
      });
    } else {
      // Fallback without Claude
      res.json({
        conversationId: finalConversationId,
        response: {
          role: 'assistant',
          content: 'Claude API key not configured. Please add your Anthropic API key in Settings.',
          timestamp: new Date().toISOString()
        },
        toolsAvailable: serverId ? await mcpManager.listTools(serverId).catch(() => []) : []
      });
    }
  } catch (error) {
    console.error('Chat processing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process a chat message with Quendoo Remote MCP Server
 * POST /chat/quendoo
 * Body: { message, conversationId }
 *
 * Uses Claude's MCP Connector to connect to remote HTTP/SSE MCP server
 */
app.post('/chat/quendoo', async (req, res) => {
  try {
    const { message, conversationId, model } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }

    const finalConversationId = conversationId || `conv_${Date.now()}`;

    // Get API key from header
    const requestApiKey = req.headers['x-anthropic-api-key'];

    if (!requestApiKey || requestApiKey === 'your-api-key-here') {
      return res.status(400).json({
        error: 'Anthropic API key required. Please configure your API key in Settings.'
      });
    }

    // Get Quendoo MCP server URL from header, fallback to environment, then to default
    const quendooUrl = req.headers['x-mcp-server-url']
      || process.env.QUENDOO_MCP_URL
      || 'https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse';

    console.log(`[Chat/Quendoo] Processing with remote MCP server: ${quendooUrl}`);
    console.log(`[Chat/Quendoo] Using model: ${model || 'default'}`);

    // Create Quendoo integration with user's API key
    const quendooIntegration = new QuendooClaudeIntegration(requestApiKey, quendooUrl);

    const result = await quendooIntegration.processMessage(message, finalConversationId, model);

    res.json({
      conversationId: finalConversationId,
      response: {
        role: 'assistant',
        content: result.content,
        timestamp: new Date().toISOString(),
        toolsUsed: result.toolsUsed
      }
    });

  } catch (error) {
    console.error('Quendoo chat processing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`MCP Client Server listening on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await mcpManager.disconnectAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await mcpManager.disconnectAll();
  process.exit(0);
});
