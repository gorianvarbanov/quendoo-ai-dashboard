/**
 * Quendoo Claude Integration with Remote MCP Server
 *
 * Direct communication with Quendoo MCP server without SDK
 * Retrieves tools and sends them to Claude
 */

import Anthropic from '@anthropic-ai/sdk';
import { EventSource } from 'eventsource';
import fetch from 'node-fetch';
import { OutputFilter } from './security/outputFilter.js';

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
    this.outputFilter = new OutputFilter(); // Security: filter responses
  }

  /**
   * Connect to the Quendoo MCP server and get tools
   */
  async connectToMCPServer() {
    if (this.sessionId) {
      console.log('[Quendoo] Already connected with session:', this.sessionId);
      return; // Already connected, reuse session
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
    // Check if EventSource is still connected, reconnect if not
    if (!this.eventSource || this.eventSource.readyState !== 1) {
      console.log('[Quendoo] EventSource disconnected, reconnecting...');
      this.sessionId = null;
      this.postUrl = null;
      await this.connectToMCPServer();
    }

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
      const headers = {
        'Content-Type': 'application/json'
      };

      // Add Quendoo API key if provided
      if (this.currentQuendooApiKey) {
        headers['X-Quendoo-Api-Key'] = this.currentQuendooApiKey;
      }

      const response = await fetch(this.postUrl, {
        method: 'POST',
        headers: headers,
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
  async processMessage(message, conversationId, model = 'claude-sonnet-4-20250514', systemPrompt = null, quendooApiKey = null) {
    // Store the Quendoo API key for this request
    this.currentQuendooApiKey = quendooApiKey;

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
        system: systemPrompt || 'You are a helpful AI assistant for Quendoo business operations. You have access to tools for checking availability, managing bookings, and other business operations. Use these tools when users ask about scheduling, appointments, or business data.',
        messages: history,
        tools: claudeTools
      });

      console.log(`[Quendoo Claude] Response received, stop_reason: ${response.stop_reason}`);

      // Handle tool use
      if (response.stop_reason === 'tool_use') {
        return await this.handleToolUse(response, conversationId, systemPrompt);
      }

      // Extract content from response
      const rawContent = this.extractContent(response);

      // === SECURITY: Output Filtering ===
      const filterResult = this.outputFilter.filter(rawContent, message);
      const content = filterResult.content;

      if (filterResult.filtered) {
        console.log(`[Security] Response replaced: ${filterResult.reason}`);
      }
      if (filterResult.wasRedacted) {
        console.log('[Security] Sensitive data redacted from response');
      }

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
  async handleToolUse(response, conversationId, systemPrompt = null) {
    const history = this.conversationHistories.get(conversationId);

    // Add Claude's tool use to history
    history.push({
      role: 'assistant',
      content: response.content
    });

    // Track tools used for frontend display
    const toolsUsedInfo = [];

    // Execute all tool calls via Quendoo server
    const toolResults = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        console.log(`[Quendoo] Executing tool: ${block.name} with args:`, block.input);

        const startTime = Date.now();

        try {
          const result = await this.sendRequest({
            method: 'tools/call',
            params: {
              name: block.name,
              arguments: block.input
            }
          });

          const duration = Date.now() - startTime;

          if (result.error) {
            throw new Error(result.error.message);
          }

          // Track tool usage
          toolsUsedInfo.push({
            name: block.name,
            params: block.input,
            duration: duration,
            success: true
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result.result)
          });
        } catch (error) {
          console.error(`[Quendoo] Tool execution failed:`, error);

          const duration = Date.now() - startTime;

          // Track failed tool usage
          toolsUsedInfo.push({
            name: block.name,
            params: block.input,
            duration: duration,
            success: false,
            error: error.message
          });

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

    // Continue calling Claude until it stops requesting tools (multi-tool execution loop)
    let finalResponse;
    let loopCount = 0;
    const maxLoops = 10; // Prevent infinite loops

    while (loopCount < maxLoops) {
      loopCount++;
      console.log(`[Quendoo] Multi-tool loop iteration ${loopCount}`);

      // Get Claude's response
      finalResponse = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        system: systemPrompt || 'You are a helpful AI assistant for Quendoo business operations.',
        messages: history,
        tools: this.availableTools.map(tool => ({
          name: tool.name,
          description: tool.description || '',
          input_schema: tool.inputSchema || { type: 'object', properties: {} }
        }))
      });

      // Add response to history
      history.push({
        role: 'assistant',
        content: finalResponse.content
      });

      // Check if Claude wants to use more tools
      if (finalResponse.stop_reason === 'tool_use') {
        console.log('[Quendoo] Claude requested more tools, continuing loop...');

        // Execute the additional tools
        const additionalToolResults = [];
        for (const block of finalResponse.content) {
          if (block.type === 'tool_use') {
            console.log(`[Quendoo] Executing additional tool: ${block.name}`);

            const startTime = Date.now();

            try {
              const result = await this.sendRequest({
                method: 'tools/call',
                params: {
                  name: block.name,
                  arguments: block.input
                }
              });

              const duration = Date.now() - startTime;

              if (result.error) {
                throw new Error(result.error.message);
              }

              // Track additional tool usage
              toolsUsedInfo.push({
                name: block.name,
                params: block.input,
                duration: duration,
                success: true
              });

              additionalToolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result.result)
              });
            } catch (error) {
              console.error(`[Quendoo] Additional tool execution failed:`, error);

              const duration = Date.now() - startTime;

              toolsUsedInfo.push({
                name: block.name,
                params: block.input,
                duration: duration,
                success: false,
                error: error.message
              });

              additionalToolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify({ error: error.message }),
                is_error: true
              });
            }
          }
        }

        // Add additional tool results to history
        history.push({
          role: 'user',
          content: additionalToolResults
        });

        // Continue the loop
        continue;
      }

      // No more tools requested, break the loop
      console.log(`[Quendoo] Multi-tool execution complete after ${loopCount} iteration(s)`);
      break;
    }

    if (loopCount >= maxLoops) {
      console.warn('[Quendoo] Multi-tool loop reached maximum iterations');
    }

    // Keep history manageable
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    // Extract and filter the final response
    const rawContent = this.extractContent(finalResponse);

    // === SECURITY: Output Filtering (for tool use responses too) ===
    const filterResult = this.outputFilter.filter(rawContent, '');
    const content = filterResult.content;

    if (filterResult.filtered) {
      console.log(`[Security] Tool response replaced: ${filterResult.reason}`);
    }
    if (filterResult.wasRedacted) {
      console.log('[Security] Sensitive data redacted from tool response');
    }

    return {
      content,
      // Don't show tools used if response was filtered (out of scope)
      toolsUsed: filterResult.filtered ? false : toolsUsedInfo
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
