/**
 * MCP Client Manager
 * Manages connections to multiple MCP servers
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from './sseClientTransport.js';

export class MCPClientManager {
  constructor() {
    this.clients = new Map(); // serverId -> { client, transport, config }
  }

  /**
   * Connect to an MCP server
   * @param {string} serverId - Unique server identifier
   * @param {Object} config - Server configuration
   * @param {string} config.type - Transport type: 'stdio' or 'sse'
   * @param {string} config.url - URL for SSE transport
   * @param {string} config.command - Command to run MCP server (stdio)
   * @param {string[]} config.args - Command arguments (stdio)
   * @param {Object} config.env - Environment variables (stdio)
   */
  async connectServer(serverId, config) {
    if (this.clients.has(serverId)) {
      throw new Error(`Server ${serverId} is already connected`);
    }

    console.log(`Connecting to MCP server: ${serverId}`, config);

    try {
      // Create client
      const client = new Client({
        name: 'quendoo-dashboard-client',
        version: '1.0.0'
      }, {
        capabilities: {
          roots: {
            listChanged: true
          },
          sampling: {}
        }
      });

      // Create transport based on type
      let transport;
      if (config.type === 'sse' && config.url) {
        // SSE transport for remote servers
        transport = new SSEClientTransport(config.url);
      } else {
        // Default to stdio transport for local servers
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: config.env || {}
        });
      }

      // Connect
      await client.connect(transport);

      console.log(`✓ Connected to MCP server: ${serverId}`);

      // Store client info
      this.clients.set(serverId, {
        client,
        transport,
        config,
        connectedAt: new Date().toISOString()
      });

      // Log capabilities (non-fatal if not supported)
      try {
        const tools = await this.listTools(serverId);
        const prompts = await this.listPrompts(serverId).catch(() => []);
        console.log(`  Tools: ${tools.length}, Prompts: ${prompts.length}`);
      } catch (error) {
        console.warn(`  Could not list capabilities: ${error.message}`);
      }

      return { success: true, serverId };
    } catch (error) {
      console.error(`Failed to connect to ${serverId}:`, error);
      // Clean up partial connection
      this.clients.delete(serverId);
      throw new Error(`Failed to connect to MCP server: ${error.message}`);
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnectServer(serverId) {
    const clientInfo = this.clients.get(serverId);

    if (!clientInfo) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    console.log(`Disconnecting from MCP server: ${serverId}`);

    try {
      await clientInfo.client.close();
      this.clients.delete(serverId);
      console.log(`✓ Disconnected from ${serverId}`);
    } catch (error) {
      console.error(`Error disconnecting from ${serverId}:`, error);
      // Remove from map anyway
      this.clients.delete(serverId);
      throw error;
    }
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll() {
    console.log('Disconnecting from all MCP servers...');
    const disconnectPromises = [];

    for (const [serverId] of this.clients) {
      disconnectPromises.push(
        this.disconnectServer(serverId).catch(err =>
          console.error(`Error disconnecting ${serverId}:`, err)
        )
      );
    }

    await Promise.all(disconnectPromises);
    console.log('All servers disconnected');
  }

  /**
   * Get list of connected servers
   */
  getConnectedServers() {
    const servers = [];

    for (const [serverId, info] of this.clients) {
      servers.push({
        id: serverId,
        connectedAt: info.connectedAt,
        config: {
          command: info.config.command,
          args: info.config.args
        }
      });
    }

    return servers;
  }

  /**
   * Get client for a server
   * @private
   */
  _getClient(serverId) {
    const clientInfo = this.clients.get(serverId);

    if (!clientInfo) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    return clientInfo.client;
  }

  /**
   * List available tools from a server
   */
  async listTools(serverId) {
    const client = this._getClient(serverId);

    try {
      const response = await client.listTools();
      return response.tools || [];
    } catch (error) {
      console.error(`Failed to list tools for ${serverId}:`, error);
      throw new Error(`Failed to list tools: ${error.message}`);
    }
  }

  /**
   * List available prompts from a server
   */
  async listPrompts(serverId) {
    const client = this._getClient(serverId);

    try {
      const response = await client.listPrompts();
      return response.prompts || [];
    } catch (error) {
      console.error(`Failed to list prompts for ${serverId}:`, error);
      throw new Error(`Failed to list prompts: ${error.message}`);
    }
  }

  /**
   * List available resources from a server
   */
  async listResources(serverId) {
    const client = this._getClient(serverId);

    try {
      const response = await client.listResources();
      return response.resources || [];
    } catch (error) {
      console.error(`Failed to list resources for ${serverId}:`, error);
      throw new Error(`Failed to list resources: ${error.message}`);
    }
  }

  /**
   * Call a tool
   */
  async callTool(serverId, toolName, toolArguments) {
    const client = this._getClient(serverId);

    console.log(`Calling tool: ${toolName} on ${serverId}`, toolArguments);

    try {
      const response = await client.callTool({
        name: toolName,
        arguments: toolArguments
      });

      console.log(`✓ Tool ${toolName} executed successfully`);
      return response;
    } catch (error) {
      console.error(`Failed to call tool ${toolName}:`, error);
      throw new Error(`Failed to call tool: ${error.message}`);
    }
  }

  /**
   * Get a prompt
   */
  async getPrompt(serverId, promptName, promptArguments) {
    const client = this._getClient(serverId);

    console.log(`Getting prompt: ${promptName} from ${serverId}`, promptArguments);

    try {
      const response = await client.getPrompt({
        name: promptName,
        arguments: promptArguments
      });

      return response;
    } catch (error) {
      console.error(`Failed to get prompt ${promptName}:`, error);
      throw new Error(`Failed to get prompt: ${error.message}`);
    }
  }

  /**
   * Read a resource
   */
  async readResource(serverId, resourceUri) {
    const client = this._getClient(serverId);

    console.log(`Reading resource: ${resourceUri} from ${serverId}`);

    try {
      const response = await client.readResource({
        uri: resourceUri
      });

      return response;
    } catch (error) {
      console.error(`Failed to read resource ${resourceUri}:`, error);
      throw new Error(`Failed to read resource: ${error.message}`);
    }
  }

  /**
   * Check if server is connected
   */
  isConnected(serverId) {
    return this.clients.has(serverId);
  }
}
