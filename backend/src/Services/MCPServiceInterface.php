<?php

namespace App\Services;

/**
 * Interface for MCP (Model Context Protocol) services
 *
 * This interface ensures compatibility between different MCP implementations
 * (generic JSON-RPC and Quendoo-specific)
 */
interface MCPServiceInterface
{
    /**
     * Send a message to the MCP server
     *
     * @param string $message The message content to send
     * @param string $conversationId The conversation identifier
     * @return array Response containing:
     *               - 'type': 'json' or 'stream'
     *               - 'data': The response data (if type is 'json')
     *               - Additional service-specific fields
     * @throws \Exception If the message cannot be sent
     */
    public function sendMessage(string $message, string $conversationId): array;

    /**
     * Test the connection to the MCP server
     *
     * @return bool True if the server is reachable, false otherwise
     */
    public function testConnection(): bool;
}
