<?php

namespace App\Services;

use GuzzleHttp\Client;
use Psr\Log\LoggerInterface;

/**
 * Standard MCP Service
 *
 * Communicates with the Node.js MCP Client Server
 * which manages connections to standard MCP servers
 */
class StandardMCPService implements MCPServiceInterface
{
    private Client $httpClient;
    private ?LoggerInterface $logger;
    private string $mcpClientUrl;
    private bool $isClientRunning = false;

    public function __construct(
        string $mcpClientUrl,
        ?LoggerInterface $logger = null
    ) {
        $this->mcpClientUrl = rtrim($mcpClientUrl, '/');
        $this->logger = $logger;

        $clientOptions = [
            'timeout' => 30,
            'connect_timeout' => 5,
            'http_errors' => false,
        ];

        // Disable SSL verification in development
        if (($_ENV['APP_ENV'] ?? 'production') === 'development') {
            $clientOptions['verify'] = false;
        }

        $this->httpClient = new Client($clientOptions);

        // Check if MCP client is running
        $this->checkClientHealth();
    }

    /**
     * Check if MCP client server is running
     */
    private function checkClientHealth(): bool
    {
        try {
            $response = $this->httpClient->get("{$this->mcpClientUrl}/health");
            $this->isClientRunning = ($response->getStatusCode() === 200);

            if ($this->isClientRunning) {
                $data = json_decode($response->getBody()->getContents(), true);
                $this->logger?->info('MCP Client is healthy', ['data' => $data]);
            }

            return $this->isClientRunning;
        } catch (\Exception $e) {
            $this->logger?->warning('MCP Client health check failed', [
                'error' => $e->getMessage()
            ]);
            $this->isClientRunning = false;
            return false;
        }
    }

    /**
     * Send a message through MCP
     *
     * @param string $message User message
     * @param string $conversationId Conversation ID
     * @return array Response data
     */
    public function sendMessage(string $message, string $conversationId): array
    {
        if (!$this->isClientRunning && !$this->checkClientHealth()) {
            throw new \Exception('MCP Client server is not running. Start it with: cd backend/mcp-client && npm run dev');
        }

        $this->logger?->info('Sending message to MCP Client', [
            'conversationId' => $conversationId,
            'messageLength' => strlen($message)
        ]);

        try {
            // Get API key from request headers if provided
            $apiKey = $_SERVER['HTTP_X_ANTHROPIC_API_KEY'] ?? null;

            $headers = [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ];

            // Forward API key to MCP client if provided
            if ($apiKey) {
                $headers['X-Anthropic-API-Key'] = $apiKey;
            }

            // Determine endpoint based on MCP mode
            $endpoint = ($_ENV['MCP_MODE'] ?? 'standard') === 'quendoo'
                ? "{$this->mcpClientUrl}/chat/quendoo"
                : "{$this->mcpClientUrl}/chat";

            $response = $this->httpClient->post($endpoint, [
                'json' => [
                    'message' => $message,
                    'conversationId' => $conversationId
                ],
                'headers' => $headers
            ]);

            $statusCode = $response->getStatusCode();
            $body = $response->getBody()->getContents();

            $this->logger?->debug('MCP Client response', [
                'statusCode' => $statusCode,
                'body' => substr($body, 0, 500)
            ]);

            if ($statusCode !== 200) {
                throw new \Exception("MCP Client returned status {$statusCode}: {$body}");
            }

            $data = json_decode($body, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new \Exception('Invalid JSON response from MCP Client');
            }

            // Return in format expected by ChatController
            return [
                'type' => 'json',
                'data' => [
                    'result' => $data['response'] ?? $data
                ]
            ];

        } catch (\Exception $e) {
            $this->logger?->error('MCP Client request failed', [
                'error' => $e->getMessage(),
                'conversationId' => $conversationId
            ]);

            throw new \Exception("Failed to communicate with MCP Client: " . $e->getMessage());
        }
    }

    /**
     * Test connection to MCP Client
     */
    public function testConnection(): bool
    {
        return $this->checkClientHealth();
    }

    /**
     * Connect to an MCP server
     *
     * @param string $serverId Server identifier
     * @param array $serverConfig Server configuration (command, args, env)
     * @return array Connection result
     */
    public function connectServer(string $serverId, array $serverConfig): array
    {
        if (!$this->isClientRunning && !$this->checkClientHealth()) {
            throw new \Exception('MCP Client server is not running');
        }

        $this->logger?->info('Connecting to MCP server', [
            'serverId' => $serverId,
            'command' => $serverConfig['command'] ?? null
        ]);

        try {
            $response = $this->httpClient->post("{$this->mcpClientUrl}/servers/connect", [
                'json' => [
                    'serverId' => $serverId,
                    'serverConfig' => $serverConfig
                ]
            ]);

            $statusCode = $response->getStatusCode();
            $body = json_decode($response->getBody()->getContents(), true);

            if ($statusCode !== 200) {
                throw new \Exception($body['error'] ?? 'Connection failed');
            }

            $this->logger?->info('Successfully connected to MCP server', ['serverId' => $serverId]);

            return $body;

        } catch (\Exception $e) {
            $this->logger?->error('Failed to connect MCP server', [
                'serverId' => $serverId,
                'error' => $e->getMessage()
            ]);

            throw new \Exception("Failed to connect MCP server: " . $e->getMessage());
        }
    }

    /**
     * Disconnect from an MCP server
     */
    public function disconnectServer(string $serverId): bool
    {
        try {
            $response = $this->httpClient->delete("{$this->mcpClientUrl}/servers/{$serverId}");
            return $response->getStatusCode() === 200;
        } catch (\Exception $e) {
            $this->logger?->error('Failed to disconnect MCP server', [
                'serverId' => $serverId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * List connected MCP servers
     */
    public function listServers(): array
    {
        try {
            $response = $this->httpClient->get("{$this->mcpClientUrl}/servers");
            $body = json_decode($response->getBody()->getContents(), true);
            return $body['servers'] ?? [];
        } catch (\Exception $e) {
            $this->logger?->error('Failed to list MCP servers', ['error' => $e->getMessage()]);
            return [];
        }
    }

    /**
     * List tools from a server
     */
    public function listTools(string $serverId): array
    {
        try {
            $response = $this->httpClient->get("{$this->mcpClientUrl}/servers/{$serverId}/tools");
            $body = json_decode($response->getBody()->getContents(), true);
            return $body['tools'] ?? [];
        } catch (\Exception $e) {
            $this->logger?->error('Failed to list tools', [
                'serverId' => $serverId,
                'error' => $e->getMessage()
            ]);
            return [];
        }
    }

    /**
     * Call a tool
     */
    public function callTool(string $serverId, string $toolName, array $arguments): array
    {
        $this->logger?->info('Calling tool', [
            'serverId' => $serverId,
            'toolName' => $toolName
        ]);

        try {
            $response = $this->httpClient->post("{$this->mcpClientUrl}/tools/call", [
                'json' => [
                    'serverId' => $serverId,
                    'toolName' => $toolName,
                    'arguments' => $arguments
                ]
            ]);

            $body = json_decode($response->getBody()->getContents(), true);

            if ($response->getStatusCode() !== 200) {
                throw new \Exception($body['error'] ?? 'Tool call failed');
            }

            return $body['result'] ?? [];

        } catch (\Exception $e) {
            $this->logger?->error('Tool call failed', [
                'serverId' => $serverId,
                'toolName' => $toolName,
                'error' => $e->getMessage()
            ]);

            throw new \Exception("Tool call failed: " . $e->getMessage());
        }
    }
}
