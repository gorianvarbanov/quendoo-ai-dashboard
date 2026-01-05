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
import { getSecret, isSecretConfigured } from './secretManager.js';
import {
  InputValidator,
  OutputFilter,
  ToolValidator,
  SecurityMonitor
} from './security/index.js';
import { initializeFirestore, checkFirestoreHealth } from './db/firestore.js';
import * as conversationService from './db/conversationService.js';
import { logAudit, LOG_TYPES, LOG_ACTIONS } from './db/auditService.js';
import { createHotelId } from './utils/hashUtils.js';

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

// Initialize Claude Integration (using backend API key only)
// API key is stored in Google Cloud Secret Manager for security
let claudeIntegration = null;
let currentApiKey = process.env.ANTHROPIC_API_KEY;

async function initializeClaudeIntegration() {
  try {
    // Try to load from Secret Manager first (for production)
    const secretConfigured = await isSecretConfigured('anthropic-api-key');
    if (secretConfigured) {
      currentApiKey = await getSecret('anthropic-api-key');
      console.log('[Init] Loaded API key from Secret Manager');
    } else {
      // Fallback to environment variable (for local development)
      currentApiKey = process.env.ANTHROPIC_API_KEY;
      console.log('[Init] Using API key from environment variable');
    }

    if (currentApiKey && currentApiKey !== 'your-api-key-here') {
      claudeIntegration = new ClaudeIntegration(currentApiKey, mcpManager);
      console.log('[Init] Claude API integration enabled');
      return true;
    } else {
      claudeIntegration = null;
      console.log('[Init] Claude API key not configured');
      return false;
    }
  } catch (error) {
    // If Secret Manager fails (e.g., local development), use env variable
    console.warn('[Init] Secret Manager not available, using environment variable:', error.message);
    currentApiKey = process.env.ANTHROPIC_API_KEY;

    if (currentApiKey && currentApiKey !== 'your-api-key-here') {
      claudeIntegration = new ClaudeIntegration(currentApiKey, mcpManager);
      console.log('[Init] Claude API integration enabled (env fallback)');
      return true;
    } else {
      claudeIntegration = null;
      console.log('[Init] Claude API key not configured');
      return false;
    }
  }
}

// Export function to reinitialize when API key changes
export async function reinitializeClaudeIntegration() {
  return await initializeClaudeIntegration();
}

// Initialize on startup (async)
initializeClaudeIntegration().catch(err => {
  console.error('[Init] Failed to initialize Claude integration:', err);
});

// Store Quendoo integration instances per conversation
const quendooIntegrations = new Map(); // conversationId -> QuendooClaudeIntegration instance

// Routes

/**
 * Health check
 */
app.get('/health', async (req, res) => {
  try {
    const useFirestore = process.env.USE_FIRESTORE !== 'false';
    let firestoreHealth = { healthy: false, message: 'Disabled in development' };
    
    if (useFirestore) {
      firestoreHealth = await checkFirestoreHealth();
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      connectedServers: mcpManager.getConnectedServers(),
      database: {
        connected: firestoreHealth.healthy,
        message: firestoreHealth.message
      }
    });
  } catch (error) {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      connectedServers: mcpManager.getConnectedServers(),
      database: {
        connected: false,
        message: 'Database check failed'
      }
    });
  }
});

/**
 * Admin Authentication Routes
 */

/**
 * Admin login
 * POST /admin/login
 * Body: { username, password }
 */
app.post('/admin/login', async (req, res) => {
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
      // Log successful login
      logAudit(LOG_TYPES.AUTH, LOG_ACTIONS.LOGIN, {
        username,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      res.json(result);
    } else {
      // Log failed login attempt
      logAudit(LOG_TYPES.AUTH, LOG_ACTIONS.LOGIN_FAILED, {
        username,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        reason: result.error
      });
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
 * Conversation Management API
 */

/**
 * Create a new conversation
 * POST /conversations
 * Body: { conversationId (optional), title (optional) }
 */
app.post('/conversations', async (req, res) => {
  try {
    const { conversationId, title, quendooApiKey } = req.body;

    // Create hotel ID from Quendoo API key, fallback to 'default'
    const hotelId = quendooApiKey ? createHotelId(quendooApiKey) : 'default';

    const conversation = await conversationService.createConversation(hotelId, {
      conversationId,
      title: title || 'New Conversation'
    });

    res.json({ conversation });
  } catch (error) {
    console.error('[Conversations] Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * Get all conversations
 * GET /conversations
 * Query params: limit (optional), quendooApiKey (optional)
 * Headers: x-quendoo-api-key (optional)
 */
app.get('/conversations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    // Get Quendoo API key from query param or header
    const quendooApiKey = req.query.quendooApiKey || req.headers['x-quendoo-api-key'];

    // Create hotel ID from API key, fallback to 'default' (for admin viewing all)
    const hotelId = quendooApiKey ? createHotelId(quendooApiKey) : 'default';

    const conversations = await conversationService.getConversations(hotelId, limit);
    res.json({ conversations });
  } catch (error) {
    console.error('[Conversations] Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * Get ALL conversations (admin only - shows all hotels)
 * GET /conversations/all
 * Requires authentication
 */
app.get('/conversations/all', requireAuth, async (req, res) => {
  try {
    console.log('[Conversations /all] Request received');
    console.log('[Conversations /all] Authorization header:', req.headers.authorization ? 'Present' : 'Missing');
    console.log('[Conversations /all] User:', req.user);

    const limit = parseInt(req.query.limit) || 100;

    // Get ALL conversations across all hotels
    const conversations = await conversationService.getAllConversations(limit);
    console.log(`[Conversations /all] Returning ${conversations.length} conversations`);
    res.json({ conversations });
  } catch (error) {
    console.error('[Conversations] Error fetching all conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * Search conversations
 * GET /conversations/search
 * Query params: q (search term), limit (optional)
 * NOTE: Must come BEFORE /conversations/:id route
 */
app.get('/conversations/search', async (req, res) => {
  try {
    const { q, limit } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Search term required' });
    }

    const searchLimit = parseInt(limit) || 20;
    const results = await conversationService.searchConversations('default', q.trim(), searchLimit);

    res.json({ conversations: results, query: q.trim() });
  } catch (error) {
    console.error('[Conversations] Error searching conversations:', error);
    res.status(500).json({ error: 'Failed to search conversations' });
  }
});

/**
 * Get specific conversation with messages
 * GET /conversations/:id
 */
app.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await conversationService.getConversationWithMessages(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ conversation });
  } catch (error) {
    console.error('[Conversations] Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * Update conversation (e.g., change title)
 * PATCH /conversations/:id
 */
app.patch('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    await conversationService.updateConversation(id, updates);

    res.json({ success: true, message: 'Conversation updated' });
  } catch (error) {
    console.error('[Conversations] Error updating conversation:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

/**
 * Delete a conversation
 * DELETE /conversations/:id
 */
app.delete('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await conversationService.deleteConversation(id);

    // Log audit event
    logAudit(LOG_TYPES.CONVERSATION, LOG_ACTIONS.CONVERSATION_DELETED, {
      conversationId: id
    });

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    console.error('[Conversations] Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
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
 * Admin Analytics Endpoints
 */

/**
 * Get audit statistics
 * GET /admin/analytics/audit-stats
 * Query params: hours (default: 24)
 */
app.get('/admin/analytics/audit-stats', requireAuth, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const { getAuditStats } = await import('./db/auditService.js');
    const stats = await getAuditStats(hours);
    res.json({ stats, timeframe: `${hours} hours` });
  } catch (error) {
    console.error('[Analytics] Error fetching audit stats:', error);
    res.status(500).json({ error: 'Failed to fetch audit statistics' });
  }
});

/**
 * Get conversation statistics
 * GET /admin/analytics/conversation-stats
 */
app.get('/admin/analytics/conversation-stats', requireAuth, async (req, res) => {
  try {
    const conversations = await conversationService.getConversations('default', 1000);

    // Calculate stats
    const stats = {
      totalConversations: conversations.length,
      totalMessages: conversations.reduce((sum, conv) => sum + (conv.messageCount || 0), 0),
      averageMessagesPerConversation: conversations.length > 0
        ? Math.round(conversations.reduce((sum, conv) => sum + (conv.messageCount || 0), 0) / conversations.length * 10) / 10
        : 0,
      conversationsToday: 0,
      conversationsThisWeek: 0,
      conversationsThisMonth: 0
    };

    // Count conversations by timeframe
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    conversations.forEach(conv => {
      const createdTime = conv.createdAt?._seconds
        ? conv.createdAt._seconds * 1000
        : new Date(conv.createdAt).getTime();

      if (createdTime >= oneDayAgo) stats.conversationsToday++;
      if (createdTime >= oneWeekAgo) stats.conversationsThisWeek++;
      if (createdTime >= oneMonthAgo) stats.conversationsThisMonth++;
    });

    res.json({ stats });
  } catch (error) {
    console.error('[Analytics] Error fetching conversation stats:', error);
    res.status(500).json({ error: 'Failed to fetch conversation statistics' });
  }
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

    // Use backend Claude integration only (no client-provided API keys)
    if (claudeIntegration) {
      console.log(`[Chat] Processing with Claude: "${message.substring(0, 50)}..."`);

      const result = await claudeIntegration.processMessage(
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
    const { message, conversationId, model, quendooApiKey } = req.body;
    // NOTE: systemPrompt is NO LONGER accepted from client for security

    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }

    // Validate Quendoo API key is provided by user
    if (!quendooApiKey || quendooApiKey.trim() === '') {
      return res.status(400).json({
        error: 'Quendoo API key required',
        details: 'Please provide your Quendoo API key in Settings to use the chatbot.'
      });
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

    // Use backend API key only (no client-provided keys)
    if (!currentApiKey || currentApiKey === 'your-api-key-here') {
      return res.status(503).json({
        error: 'Anthropic API key not configured on server. Please contact administrator.'
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
      quendooIntegration = new QuendooClaudeIntegration(currentApiKey, quendooUrl);
      quendooIntegrations.set(finalConversationId, quendooIntegration);
    } else {
      console.log(`[Chat/Quendoo] Reusing existing MCP session for conversation: ${finalConversationId}`);
    }

    // Process message with Claude integration
    const result = await quendooIntegration.processMessage(
      message,
      finalConversationId,
      model,
      finalSystemPrompt,
      quendooApiKey  // User-provided Quendoo API key
    );

    // === SECURITY: Log successful request ===
    securityMonitor.logRequestSuccess(finalConversationId);

    // === DATABASE: Persist messages to Firestore ===
    try {
      // Create hotel ID from Quendoo API key
      const hotelId = createHotelId(quendooApiKey);

      // Check if conversation exists, create if not
      const existingConv = await conversationService.getConversation(finalConversationId);
      if (!existingConv) {
        await conversationService.createConversation(hotelId, {
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
          conversationId: finalConversationId
        });
      }

      // Save user message
      await conversationService.addMessage(finalConversationId, 'user', message, {
        model: model || 'claude-sonnet-4-5-20250929'
      });

      // Save assistant response
      await conversationService.addMessage(finalConversationId, 'assistant', result.content, {
        toolsUsed: result.toolsUsed,
        model: model || 'claude-sonnet-4-5-20250929'
      });

      console.log(`[Database] Saved messages to conversation: ${finalConversationId}`);
    } catch (dbError) {
      console.error('[Database] Failed to persist messages:', dbError.message);
      // Don't fail the request if database save fails
    }

    // === AUDIT: Log message sent ===
    logAudit(LOG_TYPES.CONVERSATION, LOG_ACTIONS.MESSAGE_SENT, {
      conversationId: finalConversationId,
      messageLength: message.length,
      model: model || 'claude-sonnet-4-5-20250929'
    });

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

// Initialize Firestore and start server
async function startServer() {
  try {
    // Initialize admin authentication
    console.log('[Init] Initializing admin authentication...');
    await adminAuth.initialize();
    console.log('[Init] Admin authentication initialized successfully');
  } catch (error) {
    console.error('[Init] Failed to initialize admin auth:', error.message);
    console.warn('[Init] Admin authentication may use default credentials');
  }

  // Initialize Firestore only if enabled
  const useFirestore = process.env.USE_FIRESTORE !== 'false';
  if (useFirestore) {
    try {
      // Initialize Firestore
      console.log('[Init] Initializing Firestore...');
      await initializeFirestore();
      const health = await checkFirestoreHealth();
      if (health.healthy) {
        console.log('[Init] Firestore connected successfully');
      } else {
        console.warn('[Init] Firestore health check failed:', health.message);
      }
    } catch (error) {
      console.error('[Init] Failed to initialize Firestore:', error.message);
      console.warn('[Init] Continuing without database - some features may be limited');
    }
  } else {
    console.log('[Init] Firestore disabled (USE_FIRESTORE=false) - using localStorage only');
  }

  // Start server
  app.listen(port, () => {
    console.log(`MCP Client Server listening on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
  });
}

// Start the server
startServer();

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
