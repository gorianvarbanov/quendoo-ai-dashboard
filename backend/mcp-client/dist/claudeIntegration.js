/**
 * Claude API Integration for MCP Tool Orchestration
 *
 * This service uses Claude to:
 * 1. Understand user queries
 * 2. Decide which MCP tools to call
 * 3. Execute tools automatically
 * 4. Generate intelligent responses with tool results
 */

import Anthropic from '@anthropic-ai/sdk';

export class ClaudeIntegration {
  constructor(apiKey, mcpManager) {
    this.anthropic = new Anthropic({ apiKey });
    this.mcpManager = mcpManager;
    this.conversationHistories = new Map(); // conversationId -> messages array
  }

  /**
   * Process a chat message with Claude and MCP tools
   */
  async processMessage(message, conversationId, serverId = null) {
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
      // Get available tools from connected servers
      const tools = await this.getAvailableTools(serverId);

      console.log(`[Claude] Processing message with ${tools.length} available tools`);

      // Call Claude with tool use
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        system: 'You are a helpful AI assistant with access to filesystem tools. When users ask about files, directories, or file operations, you MUST use the available tools to get real, accurate information. Always use tools when they can help answer the user\'s question.',
        tools: tools,
        messages: history
      });

      // Process Claude's response and handle tool calls
      const result = await this.handleClaudeResponse(response, conversationId, serverId);

      // Add assistant's final response to history
      history.push({
        role: 'assistant',
        content: result.content
      });

      // Keep history manageable (last 20 messages)
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }

      return result;

    } catch (error) {
      console.error('[Claude] Error processing message:', error);
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  /**
   * Handle Claude's response and execute any tool calls
   */
  async handleClaudeResponse(response, conversationId, serverId) {
    const { content, stop_reason } = response;

    // Check if Claude wants to use tools
    if (stop_reason === 'tool_use') {
      console.log('[Claude] Tool use requested');

      // Extract tool calls and text content
      const toolCalls = [];
      const textContent = [];

      for (const block of content) {
        if (block.type === 'tool_use') {
          toolCalls.push(block);
        } else if (block.type === 'text') {
          textContent.push(block.text);
        }
      }

      // Execute tool calls
      const toolResults = [];
      for (const toolCall of toolCalls) {
        console.log(`[Claude] Executing tool: ${toolCall.name}`);

        try {
          const result = await this.executeTool(
            serverId,
            toolCall.name,
            toolCall.input
          );

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: JSON.stringify(result)
          });

          console.log(`[Claude] Tool ${toolCall.name} executed successfully`);
        } catch (error) {
          console.error(`[Claude] Tool ${toolCall.name} failed:`, error);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: JSON.stringify({ error: error.message }),
            is_error: true
          });
        }
      }

      // Get conversation history
      const history = this.conversationHistories.get(conversationId);

      // Add assistant's tool use to history
      history.push({
        role: 'assistant',
        content: content
      });

      // Add tool results to history
      history.push({
        role: 'user',
        content: toolResults
      });

      // Call Claude again with tool results to get final response
      const followUpResponse = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        system: 'You are a helpful AI assistant with access to filesystem tools. When users ask about files, directories, or file operations, you MUST use the available tools to get real, accurate information. Always use tools when they can help answer the user\'s question.',
        tools: await this.getAvailableTools(serverId),
        messages: history
      });

      // Recursively handle the follow-up response (in case more tools needed)
      return await this.handleClaudeResponse(followUpResponse, conversationId, serverId);

    } else {
      // No tool use - return the text response
      const textContent = content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      return {
        content: textContent,
        toolsUsed: false
      };
    }
  }

  /**
   * Execute a tool via MCP
   */
  async executeTool(serverId, toolName, toolInput) {
    // If no server specified, try to find the tool in any connected server
    if (!serverId) {
      const servers = this.mcpManager.getConnectedServers();

      for (const server of servers) {
        const tools = await this.mcpManager.listTools(server.id).catch(() => []);
        const hasTool = tools.some(t => t.name === toolName);

        if (hasTool) {
          serverId = server.id;
          break;
        }
      }

      if (!serverId) {
        throw new Error(`Tool ${toolName} not found in any connected server`);
      }
    }

    // Execute the tool
    const result = await this.mcpManager.callTool(serverId, toolName, toolInput);
    return result;
  }

  /**
   * Get available tools from connected servers in Claude tool format
   */
  async getAvailableTools(serverId = null) {
    const tools = [];

    // Get servers to query
    const servers = serverId
      ? [{ id: serverId }]
      : this.mcpManager.getConnectedServers();

    for (const server of servers) {
      try {
        const serverTools = await this.mcpManager.listTools(server.id);

        for (const tool of serverTools) {
          // Convert MCP tool format to Claude tool format
          tools.push({
            name: tool.name,
            description: tool.description || `Tool: ${tool.name}`,
            input_schema: tool.inputSchema || {
              type: 'object',
              properties: {},
              required: []
            }
          });
        }
      } catch (error) {
        console.warn(`[Claude] Could not list tools for ${server.id}:`, error.message);
      }
    }

    return tools;
  }

  /**
   * Clear conversation history
   */
  clearHistory(conversationId) {
    this.conversationHistories.delete(conversationId);
  }

  /**
   * Get conversation history
   */
  getHistory(conversationId) {
    return this.conversationHistories.get(conversationId) || [];
  }
}
