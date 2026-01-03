/**
 * Quendoo Claude Integration with Remote MCP Server
 *
 * Direct communication with Quendoo MCP server without SDK
 * Retrieves tools and sends them to Claude
 */

import Anthropic from '@anthropic-ai/sdk';
import { EventSource } from 'eventsource';
import fetch from 'node-fetch';

export class QuendooClaudeIntegration {
  constructor(apiKey, quendooServerUrl) {
    this.anthropic = new Anthropic({ apiKey });
    this.quendooServerUrl = quendooServerUrl;
    this.conversationHistories = new Map(); // conversationId -> messages array
    this.sessionId = null;
    this.postUrl = null;
    this.availableTools = [];
    this.eventSource = null;
    this.requestId = 0;
    this.pendingRequests = new Map(); // requestId -> { resolve, reject }
  }

  /**
   * Connect to the Quendoo MCP server and get tools
   */
  async connectToMCPServer() {
    if (this.sessionId) {
      return; // Already connected
    }

    console.log(`[Quendoo] Connecting to MCP server at ${this.quendooServerUrl}`);

    // Connect to SSE endpoint to get session ID
    await new Promise((resolve, reject) => {
      this.eventSource = new EventSource(this.quendooServerUrl);

      this.eventSource.addEventListener('endpoint', (event) => {
        console.log('[Quendoo] Received endpoint:', event.data);
        const match = event.data.match(/session_id=([^&]+)/);
        if (match) {
          this.sessionId = match[1];
          const baseUrl = new URL(this.quendooServerUrl);
          this.postUrl = `${baseUrl.protocol}//${baseUrl.host}${event.data}`;
          console.log('[Quendoo] POST endpoint:', this.postUrl);
          resolve();
        }
      });

      // Listen for 'message' events containing JSON-RPC responses
      this.eventSource.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[Quendoo] Received SSE message:', JSON.stringify(data, null, 2));

          // Match response to pending request by ID
          if (data.id !== undefined && this.pendingRequests.has(data.id)) {
            const { resolve, reject } = this.pendingRequests.get(data.id);
            this.pendingRequests.delete(data.id);

            if (data.error) {
              reject(new Error(data.error.message || JSON.stringify(data.error)));
            } else {
              resolve(data);
            }
          }
        } catch (error) {
          console.error('[Quendoo] Failed to parse SSE message:', error);
        }
      });

      this.eventSource.onerror = (error) => {
        console.error('[Quendoo] SSE error:', error);
        reject(error);
      };
    });

    // Initialize MCP protocol first
    console.log('[Quendoo] Initializing MCP protocol');
    const initResponse = await this.sendRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'quendoo-ai-dashboard',
          version: '1.0.0'
        }
      }
    });

    if (initResponse.error) {
      throw new Error(`Failed to initialize: ${JSON.stringify(initResponse.error)}`);
    }

    console.log('[Quendoo] MCP protocol initialized');

    // Get tools list
    console.log('[Quendoo] Requesting tools list');
    const toolsResponse = await this.sendRequest({
      method: 'tools/list'
    });

    if (toolsResponse.error) {
      throw new Error(`Failed to get tools: ${JSON.stringify(toolsResponse.error)}`);
    }

    this.availableTools = toolsResponse.result?.tools || [];
    console.log(`[Quendoo] Found ${this.availableTools.length} tools:`,
                this.availableTools.map(t => t.name).join(', '));
  }

  /**
   * Send a JSON-RPC request to Quendoo server
   * Returns response via SSE stream (async processing)
   */
  async sendRequest(request) {
    const message = {
      jsonrpc: '2.0',
      id: this.requestId++,
      ...request
    };

    console.log('[Quendoo] Sending request:', JSON.stringify(message, null, 2));

    // Create promise that will be resolved by SSE message handler
    const responsePromise = new Promise((resolve, reject) => {
      this.pendingRequests.set(message.id, { resolve, reject });

      // Set timeout in case server doesn't respond
      setTimeout(() => {
        if (this.pendingRequests.has(message.id)) {
          this.pendingRequests.delete(message.id);
          reject(new Error(`Request ${message.id} timed out after 30 seconds`));
        }
      }, 30000);
    });

    // Send POST request
    try {
      const response = await fetch(this.postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      // Check status
      if (response.status === 202) {
        console.log('[Quendoo] Request accepted, waiting for SSE response...');
        // Response will come via SSE - wait for promise to resolve
        return await responsePromise;
      } else if (response.ok) {
        // Immediate JSON response
        const result = await response.json();
        console.log('[Quendoo] Received immediate response:', JSON.stringify(result, null, 2));
        // Clean up pending request
        this.pendingRequests.delete(message.id);
        return result;
      } else {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      // Clean up pending request on error
      this.pendingRequests.delete(message.id);
      throw error;
    }
  }

  /**
   * Process a chat message with Claude using remote MCP server
   */
  async processMessage(message, conversationId, model = 'claude-3-5-sonnet-20241022') {
    // Connect to MCP server if not already connected
    await this.connectToMCPServer();

    // Get or create conversation history
    if (!this.conversationHistories.has(conversationId)) {
      this.conversationHistories.set(conversationId, []);
    }
    const history = this.conversationHistories.get(conversationId);

    // Add user message to history
    history.push({
      role: 'user',
      content: message
    });

    try {
      console.log(`[Quendoo Claude] Processing message with Quendoo MCP tools`);

      // Convert MCP tools to Claude format
      const claudeTools = this.availableTools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        input_schema: tool.inputSchema || { type: 'object', properties: {} }
      }));

      // Call Claude with tools
      const response = await this.anthropic.messages.create({
        model: model,
        max_tokens: 4096,
        system: 'You are a helpful AI assistant for Quendoo business operations. You have access to tools for checking availability, managing bookings, and other business operations. Use these tools when users ask about scheduling, appointments, or business data.',
        messages: history,
        tools: claudeTools
      });

      console.log(`[Quendoo Claude] Response received, stop_reason: ${response.stop_reason}`);

      // Handle tool use
      if (response.stop_reason === 'tool_use') {
        return await this.handleToolUse(response, conversationId);
      }

      // Extract content from response
      const content = this.extractContent(response);

      // Add assistant's response to history
      history.push({
        role: 'assistant',
        content: response.content
      });

      // Keep history manageable (last 20 messages)
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }

      return {
        content,
        toolsUsed: false
      };

    } catch (error) {
      console.error('[Quendoo Claude] Error processing message:', error);
      throw new Error(`Claude API error: ${error.status} ${JSON.stringify(error.error || error.message)}`);
    }
  }

  /**
   * Handle tool use from Claude
   */
  async handleToolUse(response, conversationId) {
    const history = this.conversationHistories.get(conversationId);

    // Add Claude's tool use to history
    history.push({
      role: 'assistant',
      content: response.content
    });

    // Execute all tool calls via Quendoo server
    const toolResults = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        console.log(`[Quendoo] Executing tool: ${block.name} with args:`, block.input);

        try {
          const result = await this.sendRequest({
            method: 'tools/call',
            params: {
              name: block.name,
              arguments: block.input
            }
          });

          if (result.error) {
            throw new Error(result.error.message);
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result.result)
          });
        } catch (error) {
          console.error(`[Quendoo] Tool execution failed:`, error);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({ error: error.message }),
            is_error: true
          });
        }
      }
    }

    // Add tool results to history
    history.push({
      role: 'user',
      content: toolResults
    });

    // Get Claude's final response
    const finalResponse = await this.anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 4096,
      system: 'You are a helpful AI assistant for Quendoo business operations.',
      messages: history
    });

    // Add final response to history
    history.push({
      role: 'assistant',
      content: finalResponse.content
    });

    // Keep history manageable
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    return {
      content: this.extractContent(finalResponse),
      toolsUsed: true
    };
  }

  /**
   * Extract text content from Claude response
   */
  extractContent(response) {
    const textBlocks = response.content.filter(block => block.type === 'text');
    return textBlocks.map(block => block.text).join('\n');
  }

  /**
   * Clear conversation history
   */
  clearHistory(conversationId) {
    this.conversationHistories.delete(conversationId);
  }
}
