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
import { searchHotelDocumentsTool, searchHotelDocuments, listHotelDocumentsTool, listHotelDocuments } from './tools/documentTools.js';

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
    this.currentHotelId = null; // Store current hotel ID for local tool execution
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
   * @param {Function} onToolProgress - Optional callback for tool execution progress
   */
  async processMessage(message, conversationId, model = 'claude-3-5-haiku-20241022', systemPrompt = null, quendooApiKey = null, hotelId = null, onToolProgress = null) {
    // Store the Quendoo API key and hotel ID for this request
    this.currentQuendooApiKey = quendooApiKey;
    this.currentHotelId = hotelId;

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

      // Detect task complexity
      const complexity = this.detectTaskComplexity(message);
      console.log(`[Quendoo] Task complexity: ${complexity}`);

      // Convert MCP tools to Claude format
      const claudeTools = this.availableTools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        input_schema: tool.inputSchema || { type: 'object', properties: {} }
      }));

      // Add local backend tools (document search and list)
      claudeTools.push({
        name: searchHotelDocumentsTool.name,
        description: searchHotelDocumentsTool.description,
        input_schema: searchHotelDocumentsTool.inputSchema
      });

      claudeTools.push({
        name: listHotelDocumentsTool.name,
        description: listHotelDocumentsTool.description,
        input_schema: listHotelDocumentsTool.inputSchema
      });

      // Build request parameters
      const requestParams = {
        model: model,
        max_tokens: 4096,
        system: systemPrompt || 'You are a helpful AI assistant for Quendoo business operations. You have access to tools for checking availability, managing bookings, and other business operations. Use these tools when users ask about scheduling, appointments, or business data.',
        messages: history,
        tools: claudeTools
      };

      // For simple tasks, force immediate tool use
      if (complexity === 'simple' && claudeTools.length > 0) {
        requestParams.tool_choice = { type: "any" };
        console.log('[Quendoo] Simple task: forcing tool_choice = any');
      }

      // Call Claude with tools
      const response = await this.anthropic.messages.create(requestParams);

      console.log(`[Quendoo Claude] Response received, stop_reason: ${response.stop_reason}`);

      // Handle tool use
      if (response.stop_reason === 'tool_use') {
        return await this.handleToolUse(response, conversationId, systemPrompt, model, onToolProgress);
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
   * Detect task complexity based on user message
   * Returns: 'simple' or 'complex'
   */
  detectTaskComplexity(message) {
    // Complex task indicators
    const complexIndicators = [
      /изпрати.*и.*изпрати/i, // "send ... and send" (multiple emails)
      /изпрати.*и.*обади/i,    // "send ... and call"
      /намери.*и.*изпрати.*и/i, // "find ... and send ... and"
      /(\d+)\s*(email|имейл|мейл)/i, // Multiple emails mentioned
      /отчет/i,                 // "report" (usually needs extra step)
      /и.*и/,                   // Multiple "and" conjunctions
    ];

    // Check for complex indicators
    for (const pattern of complexIndicators) {
      if (pattern.test(message)) {
        console.log('[Quendoo] Complex task detected:', message.substring(0, 100));
        return 'complex';
      }
    }

    // Simple task (default)
    console.log('[Quendoo] Simple task detected');
    return 'simple';
  }

  /**
   * Handle tool use from Claude
   * @param {Function} onToolProgress - Optional callback for tool execution progress: (tool) => void
   */
  async handleToolUse(response, conversationId, systemPrompt = null, model = 'claude-3-5-haiku-20241022', onToolProgress = null) {
    const history = this.conversationHistories.get(conversationId);

    // Add Claude's tool use to history
    history.push({
      role: 'assistant',
      content: response.content
    });

    // Track tools used for frontend display
    const toolsUsedInfo = [];

    console.log(`[Quendoo] Initial response has ${response.content.filter(b => b.type === 'tool_use').length} tool(s) to execute`);

    // Execute all tool calls via Quendoo server
    const toolResults = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        console.log(`[Quendoo] Executing tool: ${block.name} with args:`, block.input);

        const startTime = Date.now();

        try {
          let result;

          // Check if this is a local tool (document search or list)
          if (block.name === 'search_hotel_documents') {
            console.log('[Quendoo] Executing local tool: search_hotel_documents');

            // Execute local tool
            const localResult = await searchHotelDocuments(block.input, this.currentHotelId);

            result = {
              result: localResult
            };
          } else if (block.name === 'list_hotel_documents') {
            console.log('[Quendoo] Executing local tool: list_hotel_documents');

            // Execute local tool
            const localResult = await listHotelDocuments(block.input, this.currentHotelId);

            result = {
              result: localResult
            };
          } else {
            // Execute remote Quendoo tool
            result = await this.sendRequest({
              method: 'tools/call',
              params: {
                name: block.name,
                arguments: block.input
              }
            });
          }

          const duration = Date.now() - startTime;

          if (result.error) {
            throw new Error(result.error.message);
          }

          // Track tool usage with result data
          const toolInfo = {
            name: block.name,
            params: block.input,
            duration: duration,
            success: true,
            result: result.result // Add the actual result data for frontend
          };
          toolsUsedInfo.push(toolInfo);

          // Emit progress event if callback provided
          if (onToolProgress) {
            onToolProgress(toolInfo);
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result.result)
          });
        } catch (error) {
          console.error(`[Quendoo] Tool execution failed:`, error);

          const duration = Date.now() - startTime;

          // Track failed tool usage
          const toolInfo = {
            name: block.name,
            params: block.input,
            duration: duration,
            success: false,
            error: error.message
          };
          toolsUsedInfo.push(toolInfo);

          // Emit progress event if callback provided
          if (onToolProgress) {
            onToolProgress(toolInfo);
          }

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
      // On first iteration, force Claude to use tools (tool_choice: "any")
      // On subsequent iterations, let Claude decide (tool_choice: "auto")
      const requestParams = {
        model: model,
        max_tokens: 8192, // Increased from 4096 to prevent premature stopping
        system: systemPrompt || 'You are a helpful AI assistant for Quendoo business operations.',
        messages: history,
        tools: this.availableTools.map(tool => ({
          name: tool.name,
          description: tool.description || '',
          input_schema: tool.inputSchema || { type: 'object', properties: {} }
        }))
      };

      // Always use auto tool choice in the multi-tool loop
      // Let Claude decide whether more tools are needed based on system prompt
      requestParams.tool_choice = { type: "auto" };
      console.log(`[Quendoo] Iteration ${loopCount}: using tool_choice = auto (let Claude decide)`);

      finalResponse = await this.anthropic.messages.create(requestParams);

      // Enhanced logging for debugging
      console.log(`[Quendoo] ========== Loop iteration ${loopCount}/${maxLoops} ==========`);
      console.log(`[Quendoo] stop_reason: ${finalResponse.stop_reason}`);
      console.log(`[Quendoo] Content blocks:`, JSON.stringify(finalResponse.content.map(b => ({
        type: b.type,
        ...(b.type === 'tool_use' ? { tool_name: b.name, tool_id: b.id } : {}),
        ...(b.type === 'text' ? { text_preview: b.text.substring(0, 100) + '...' } : {})
      })), null, 2));
      console.log(`[Quendoo] History length: ${history.length} messages`);
      console.log(`[Quendoo] Tools executed so far: ${toolsUsedInfo.length}`);

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

              // Track additional tool usage with result data
              const toolInfo = {
                name: block.name,
                params: block.input,
                duration: duration,
                success: true,
                result: result.result // Add the actual result data for frontend
              };
              toolsUsedInfo.push(toolInfo);

              // Emit progress event if callback provided
              if (onToolProgress) {
                onToolProgress(toolInfo);
              }

              additionalToolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result.result)
              });
            } catch (error) {
              console.error(`[Quendoo] Additional tool execution failed:`, error);

              const duration = Date.now() - startTime;

              const toolInfo = {
                name: block.name,
                params: block.input,
                duration: duration,
                success: false,
                error: error.message
              };
              toolsUsedInfo.push(toolInfo);

              // Emit progress event if callback provided
              if (onToolProgress) {
                onToolProgress(toolInfo);
              }

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

      // Check if Claude stopped but hasn't completed all expected tasks
      if (finalResponse.stop_reason === 'end_turn') {
        // Check if there's text content
        const textContent = finalResponse.content.find(b => b.type === 'text');
        const hasTextContent = !!textContent;

        console.log(`[Quendoo] Claude stopped with end_turn, tools executed: ${toolsUsedInfo.length}`);

        // Only attempt to continue if:
        // 1. Very few tools were executed (< 2) AND
        // 2. Text content suggests incompletion (doesn't contain final indicators)
        // 3. We haven't looped too many times
        if (hasTextContent && toolsUsedInfo.length < 2 && loopCount < 3) {
          const text = textContent.text.toLowerCase();

          // Check if text indicates completion (contains completion phrases)
          const completionIndicators = [
            'complete', 'done', 'finished', 'all tasks', 'successfully',
            'завърши', 'готово', 'изпълни', 'изпрати'
          ];
          const indicatesCompletion = completionIndicators.some(indicator =>
            text.includes(indicator)
          );

          if (!indicatesCompletion) {
            console.log('[Quendoo] Attempting to continue execution (incomplete task detected)...');

            // Add continuation prompt
            history.push({
              role: 'user',
              content: [{
                type: 'text',
                text: 'Continue with the remaining tasks. Call all necessary tools to complete the request.'
              }]
            });

            // Continue loop
            continue;
          } else {
            console.log('[Quendoo] Task appears complete, not continuing loop');
          }
        }
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

    console.log(`[Quendoo] Returning ${toolsUsedInfo.length} tool(s) in response`);
    console.log(`[Quendoo] Tools:`, toolsUsedInfo.map(t => t.name));

    return {
      content,
      // Don't show tools used if response was filtered (out of scope)
      toolsUsed: filterResult.filtered ? false : toolsUsedInfo
    };
  }

  /**
   * Process message with real-time streaming callbacks for tool execution
   * @param {Object} callbacks - { onToolStart, onToolComplete, onThinking }
   */
  async processMessageWithStreaming(message, conversationId, model, systemPrompt, quendooApiKey, hotelId, callbacks = {}) {
    // Store the Quendoo API key and hotel ID for this request
    this.currentQuendooApiKey = quendooApiKey;
    this.currentHotelId = hotelId;

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
      console.log(`[Quendoo Claude] Processing message with streaming callbacks`);

      // Detect task complexity
      const complexity = this.detectTaskComplexity(message);
      console.log(`[Quendoo] Task complexity: ${complexity}`);

      // Convert MCP tools to Claude format
      const claudeTools = this.availableTools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        input_schema: tool.inputSchema || { type: 'object', properties: {} }
      }));

      // Add local backend tools (document search and list)
      claudeTools.push({
        name: searchHotelDocumentsTool.name,
        description: searchHotelDocumentsTool.description,
        input_schema: searchHotelDocumentsTool.inputSchema
      });

      claudeTools.push({
        name: listHotelDocumentsTool.name,
        description: listHotelDocumentsTool.description,
        input_schema: listHotelDocumentsTool.inputSchema
      });

      // Build request parameters
      const requestParams = {
        model: model,
        max_tokens: 4096,
        system: systemPrompt || 'You are a helpful AI assistant for Quendoo business operations.',
        messages: history,
        tools: claudeTools,
        tool_choice: { type: "auto" } // Always use auto, let system prompt guide tool selection
      };

      // REMOVED: Forced tool_choice = "any" was causing Claude to call too many tools
      // System prompt now guides tool selection with clear instructions

      // Emit thinking callback
      if (callbacks.onThinking) {
        callbacks.onThinking();
      }

      // Track tools used for frontend display
      const toolsUsedInfo = [];

      // Multi-tool execution loop
      const maxLoops = 10;
      let loopCount = 0;
      let finalResponse = null;

      while (loopCount < maxLoops) {
        loopCount++;
        console.log(`[Quendoo Streaming] Loop iteration ${loopCount}/${maxLoops}, tools executed so far: ${toolsUsedInfo.length}`);

        // Call Claude with tools
        const response = await this.anthropic.messages.create(requestParams);
        finalResponse = response;

        console.log(`[Quendoo Streaming] Response stop_reason: ${response.stop_reason}, content blocks: ${response.content.length}`);

        // Add Claude's response to history
        history.push({
          role: 'assistant',
          content: response.content
        });

        // Check if Claude wants to use tools
        if (response.stop_reason === 'tool_use') {
          // Execute all tool calls
          const toolResults = [];
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              console.log(`[Quendoo Streaming] Executing tool: ${block.name}`);

              // Emit tool start callback
              if (callbacks.onToolStart) {
                callbacks.onToolStart(block.name, block.input);
              }

              const startTime = Date.now();

              try {
                let result;

                // Check if this is a local tool (document search or list)
                if (block.name === 'search_hotel_documents') {
                  console.log('[Quendoo Streaming] Executing local tool: search_hotel_documents');
                  const localResult = await searchHotelDocuments(block.input, this.currentHotelId);
                  result = { result: localResult };
                } else if (block.name === 'list_hotel_documents') {
                  console.log('[Quendoo Streaming] Executing local tool: list_hotel_documents');
                  const localResult = await listHotelDocuments(block.input, this.currentHotelId);
                  result = { result: localResult };
                } else {
                  // Execute remote Quendoo tool
                  result = await this.sendRequest({
                    method: 'tools/call',
                    params: {
                      name: block.name,
                      arguments: block.input
                    }
                  });
                }

                const duration = Date.now() - startTime;

                if (result.error) {
                  throw new Error(result.error.message);
                }

                // Track tool usage with result data
                const toolInfo = {
                  name: block.name,
                  params: block.input,
                  duration: duration,
                  success: true,
                  result: result.result // Always include result for frontend visualization
                };

                toolsUsedInfo.push(toolInfo);

                // Emit tool complete callback with result
                if (callbacks.onToolComplete) {
                  callbacks.onToolComplete(block.name, block.input, duration, result.result);
                }

                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify(result.result)
                });
              } catch (error) {
                console.error(`[Quendoo Streaming] Tool execution failed:`, error);

                const duration = Date.now() - startTime;

                const toolInfo = {
                  name: block.name,
                  params: block.input,
                  duration: duration,
                  success: false,
                  error: error.message
                };
                toolsUsedInfo.push(toolInfo);

                // Still emit complete callback with error
                if (callbacks.onToolComplete) {
                  callbacks.onToolComplete(block.name, block.input, duration, error.message);
                }

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

          // Update request params to continue conversation with tool results
          requestParams.messages = history;

          // Continue loop to let Claude process tool results
          continue;
        }

        // Check if Claude stopped but hasn't completed all expected tasks
        if (finalResponse.stop_reason === 'end_turn') {
          console.log(`[Quendoo] Claude stopped with end_turn, tools executed: ${toolsUsedInfo.length}`);
          // Trust Claude and system prompt - do not force continuation
          // System prompt v3.2 explicitly guides tool selection and formatting
        }

        // No more tools to execute, exit loop
        break;
      }

      // Check if we hit max loops
      if (loopCount >= maxLoops) {
        console.warn(`[Quendoo Streaming] WARNING: Reached maximum loop count (${maxLoops}). Forcing completion.`);
      }

      // Extract final content
      const rawContent = this.extractContent(finalResponse);

      // === SECURITY: Output Filtering ===
      const filterResult = this.outputFilter.filter(rawContent, message);
      const content = filterResult.content;

      if (filterResult.filtered) {
        console.log(`[Security] Response replaced: ${filterResult.reason}`);
      }

      // Keep history manageable
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }

      console.log(`[Quendoo Streaming] Completed with ${toolsUsedInfo.length} tool(s)`);
      console.log(`[Quendoo Streaming] toolsUsedInfo length:`, toolsUsedInfo.length);
      console.log(`[Quendoo Streaming] First tool:`, toolsUsedInfo[0]);
      console.log(`[Quendoo Streaming] First tool has result:`, !!toolsUsedInfo[0]?.result);
      console.log(`[Quendoo Streaming] filterResult.filtered:`, filterResult.filtered);

      return {
        content,
        toolsUsed: filterResult.filtered ? false : toolsUsedInfo
      };

    } catch (error) {
      console.error('[Quendoo Streaming] Error processing message:', error);
      throw new Error(`Claude API error: ${error.status} ${JSON.stringify(error.error || error.message)}`);
    }
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
