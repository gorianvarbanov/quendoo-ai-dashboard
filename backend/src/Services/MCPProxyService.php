<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Psr\Log\LoggerInterface;

class MCPProxyService implements MCPServiceInterface
{
    private Client $httpClient;
    private ?LoggerInterface $logger;
    private string $mcpServerUrl;

    public function __construct(
        string $mcpServerUrl,
        ?LoggerInterface $logger = null
    ) {
        $this->mcpServerUrl = $mcpServerUrl;
        $this->logger = $logger;

        $clientOptions = [
            'timeout' => 30,
            'headers' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json, text/event-stream'
            ]
        ];

        // Disable SSL verification in development (not recommended for production)
        if (($_ENV['APP_ENV'] ?? 'production') === 'development') {
            $clientOptions['verify'] = false;
        }

        $this->httpClient = new Client($clientOptions);
    }

    /**
     * Send message to MCP server via JSON-RPC 2.0
     */
    public function sendMessage(string $message, string $conversationId): array
    {
        $payload = [
            'jsonrpc' => '2.0',
            'id' => uniqid('req_'),
            'method' => 'chat.sendMessage',
            'params' => [
                'message' => $message,
                'conversationId' => $conversationId
            ]
        ];

        try {
            $this->log('info', 'Sending message to MCP server', [
                'conversationId' => $conversationId,
                'url' => $this->mcpServerUrl
            ]);

            $response = $this->httpClient->post($this->mcpServerUrl, [
                'json' => $payload
            ]);

            $contentType = $response->getHeader('Content-Type')[0] ?? '';
            $statusCode = $response->getStatusCode();

            $this->log('info', 'MCP server response received', [
                'statusCode' => $statusCode,
                'contentType' => $contentType
            ]);

            // Handle JSON response (single response)
            if (str_contains($contentType, 'application/json')) {
                $body = (string) $response->getBody();
                $data = json_decode($body, true);

                if (json_last_error() !== JSON_ERROR_NONE) {
                    throw new \Exception('Invalid JSON response from MCP server: ' . json_last_error_msg());
                }

                return [
                    'type' => 'json',
                    'data' => $data
                ];
            }

            // Handle SSE stream (multiple responses)
            if (str_contains($contentType, 'text/event-stream')) {
                return [
                    'type' => 'stream',
                    'conversationId' => $conversationId
                ];
            }

            throw new \Exception('Unexpected content type from MCP server: ' . $contentType);

        } catch (RequestException $e) {
            $this->log('error', 'Failed to send message to MCP server', [
                'error' => $e->getMessage(),
                'conversationId' => $conversationId
            ]);

            throw new \Exception('MCP server communication error: ' . $e->getMessage());
        } catch (\Exception $e) {
            $this->log('error', 'MCP proxy error', [
                'error' => $e->getMessage()
            ]);

            throw $e;
        }
    }

    /**
     * Initialize connection to MCP server
     */
    public function initializeConnection(): array
    {
        $payload = [
            'jsonrpc' => '2.0',
            'id' => uniqid('init_'),
            'method' => 'initialize',
            'params' => [
                'protocolVersion' => '2024-11-05',
                'capabilities' => [
                    'roots' => ['listChanged' => true]
                ],
                'clientInfo' => [
                    'name' => 'Quendoo AI Dashboard',
                    'version' => '1.0.0'
                ]
            ]
        ];

        try {
            $this->log('info', 'Initializing MCP connection', [
                'url' => $this->mcpServerUrl
            ]);

            $response = $this->httpClient->post($this->mcpServerUrl, [
                'json' => $payload
            ]);

            $body = (string) $response->getBody();
            $data = json_decode($body, true);

            $this->log('info', 'MCP connection initialized successfully');

            return $data;

        } catch (\Exception $e) {
            $this->log('error', 'MCP initialization failed', [
                'error' => $e->getMessage()
            ]);

            throw new \Exception('Failed to initialize MCP connection: ' . $e->getMessage());
        }
    }

    /**
     * Test server connectivity
     */
    public function testConnection(): bool
    {
        try {
            $response = $this->httpClient->get($this->mcpServerUrl, [
                'timeout' => 5,
                'http_errors' => false
            ]);

            $statusCode = $response->getStatusCode();

            $this->log('info', 'MCP server connection test', [
                'statusCode' => $statusCode,
                'url' => $this->mcpServerUrl
            ]);

            // Accept 200 or 405 (Method Not Allowed) as the server is responding
            return in_array($statusCode, [200, 405]);

        } catch (\Exception $e) {
            $this->log('warning', 'MCP server connection test failed', [
                'url' => $this->mcpServerUrl,
                'error' => $e->getMessage()
            ]);

            return false;
        }
    }

    /**
     * Get server capabilities
     */
    public function getCapabilities(): array
    {
        try {
            $initResponse = $this->initializeConnection();
            return $initResponse['result']['capabilities'] ?? [];
        } catch (\Exception $e) {
            $this->log('error', 'Failed to get server capabilities', [
                'error' => $e->getMessage()
            ]);
            return [];
        }
    }

    /**
     * Log helper
     */
    private function log(string $level, string $message, array $context = []): void
    {
        if ($this->logger) {
            $this->logger->log($level, $message, $context);
        }
    }
}
