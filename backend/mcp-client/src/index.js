/**
 * MCP Client Server
 * Provides HTTP API for PHP backend to interact with MCP servers
 */

import dotenv from 'dotenv';
// Load environment variables FIRST before any other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import { MCPClientManager } from './mcpClientManager.js';
import { ClaudeIntegration } from './claudeIntegration.js';
import { QuendooClaudeIntegration } from './quendooClaudeIntegration.js';
import adminAuth from './auth/adminAuth.js';
import { requireAuth } from './auth/authMiddleware.js';
import { getSystemPrompt } from './systemPrompts.js';
import {
  InputValidator,
  OutputFilter,
  ToolValidator,
  SecurityMonitor
} from './security/index.js';

const app = express();
const port = process.env.PORT || 3100;

// Initialize security components
const inputValidator = new InputValidator();
const outputFilter = new OutputFilter();
const toolValidator = new ToolValidator();
const securityMonitor = new SecurityMonitor();
console.log('[Security] All security modules initialized');
console.log('[Security] - Input Validator: Active');
console.log('[Security] - Output Filter: Active');
console.log('[Security] - Tool Validator: Active');
console.log('[Security] - Security Monitor: Active');

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

// Store Quendoo integration instances per conversation
const quendooIntegrations = new Map(); // conversationId -> QuendooClaudeIntegration instance

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
 * Admin Authentication Routes
 */

/**
 * Admin login
 * POST /admin/login
 * Body: { username, password }
 */
app.post('/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    const result = adminAuth.login(username, password);

    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    console.error('[Admin Login] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Verify admin authentication status
 * GET /admin/verify
 * Headers: Authorization: Bearer <token>
 */
app.get('/admin/verify', requireAuth, (req, res) => {
  // If middleware passes, user is authenticated
  res.json({
    authenticated: true,
    user: req.user
  });
});

/**
 * Get security statistics (admin only)
 * GET /admin/security/stats
 * Headers: Authorization: Bearer <token>
 */
app.get('/admin/security/stats', requireAuth, (req, res) => {
  try {
    const stats = {
      monitor: securityMonitor.getStats(),
      inputValidator: inputValidator.getStats(),
      outputFilter: outputFilter.getStats(),
      toolValidator: toolValidator.getStats()
    };
    res.json(stats);
  } catch (error) {
    console.error('[Admin Security] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch security statistics' });
  }
});

/**
 * Get recent security events (admin only)
 * GET /admin/security/events
 * Query params: ?limit=50&type=input_blocked
 * Headers: Authorization: Bearer <token>
 */
app.get('/admin/security/events', requireAuth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const type = req.query.type || null;
    const events = securityMonitor.getRecentEvents(limit, type);
    res.json({ events });
  } catch (error) {
    console.error('[Admin Security] Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

// Import and use admin configuration routes
import adminRoutes from './api/adminRoutes.js';
app.use('/admin', requireAuth, adminRoutes);

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
    // NOTE: systemPrompt is NO LONGER accepted from client for security

    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }

    const finalConversationId = conversationId || `conv_${Date.now()}`;

    // === SECURITY: Rate Limiting ===
    if (!securityMonitor.checkConversationRateLimit(finalConversationId, 20)) {
      return res.status(429).json({
        error: 'Too many requests',
        details: 'Please wait a moment before sending another message.'
      });
    }

    // === SECURITY: Input Validation ===
    const validationResult = inputValidator.validate(message);
    if (validationResult.blocked) {
      securityMonitor.logInputBlocked(
        finalConversationId,
        message,
        validationResult.reason,
        validationResult.pattern
      );
      // Return generic error (don't reveal security details to potential attackers)
      return res.status(400).json({
        error: 'Cannot process request',
        details: 'Your message could not be processed. Please ensure your question is related to hotel operations.'
      });
    }

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

    // === SECURITY: Use Immutable Server-Side System Prompt ===
    const finalSystemPrompt = getSystemPrompt();

    console.log(`[Chat/Quendoo] Processing conversation: ${finalConversationId}`);
    console.log(`[Chat/Quendoo] Using model: ${model || 'default'}`);
    console.log(`[Chat/Quendoo] System prompt: SERVER-CONTROLLED (v1.0)`);

    // Get or create Quendoo integration for this conversation
    let quendooIntegration = quendooIntegrations.get(finalConversationId);

    if (!quendooIntegration) {
      console.log(`[Chat/Quendoo] Creating new MCP session for conversation: ${finalConversationId}`);
      quendooIntegration = new QuendooClaudeIntegration(requestApiKey, quendooUrl);
      quendooIntegrations.set(finalConversationId, quendooIntegration);
    } else {
      console.log(`[Chat/Quendoo] Reusing existing MCP session for conversation: ${finalConversationId}`);
    }

    const result = await quendooIntegration.processMessage(message, finalConversationId, model, finalSystemPrompt);

    // === SECURITY: Log successful request ===
    securityMonitor.logRequestSuccess(finalConversationId);

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
    // If there's an error, remove the integration so next attempt creates fresh one
    const { conversationId } = req.body;
    const convId = conversationId || `conv_${Date.now()}`;
    quendooIntegrations.delete(convId);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export security instances for admin routes
export { inputValidator, outputFilter, toolValidator, securityMonitor };

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
