<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Psr\Log\LoggerInterface;

/**
 * Quendoo-specific MCP Server implementation
 *
 * This service handles the Quendoo MCP server's unique flow:
 * 1. Connect to /sse endpoint to get a session ID
 * 2. Use that session ID for all message requests
 */
class QuendooMCPService implements MCPServiceInterface
{
    private Client $httpClient;
    private ?LoggerInterface $logger;
    private string $mcpServerBaseUrl;
    private ?string $currentSessionId = null;

    public function __construct(
        string $mcpServerBaseUrl,
        ?LoggerInterface $logger = null
    ) {
        $this->mcpServerBaseUrl = rtrim($mcpServerBaseUrl, '/sse');
        $this->logger = $logger;

        $clientOptions = [
            'timeout' => 30,
            'headers' => [
                'Accept' => 'application/json, text/event-stream'
            ]
        ];

        // Disable SSL verification in development
        if (($_ENV['APP_ENV'] ?? 'production') === 'development') {
            $clientOptions['verify'] = false;
        }

        $this->httpClient = new Client($clientOptions);
    }

    /**
     * Get or create a session ID from the SSE endpoint
     */
    public function getSessionId(): string
    {
        if ($this->currentSessionId) {
            return $this->currentSessionId;
        }

        try {
            $this->log('info', 'Connecting to SSE endpoint to get session ID', [
                'url' => $this->mcpServerBaseUrl . '/sse'
            ]);

            $response = $this->httpClient->get($this->mcpServerBaseUrl . '/sse', [
                'timeout' => 5,
                'headers' => [
                    'Accept' => 'text/event-stream',
                    'Cache-Control' => 'no-cache'
                ]
            ]);

            $sseData = (string) $response->getBody();

            // Parse session ID from SSE event
            // Format: data: /messages/?session_id=<32-char-hex>
            if (preg_match('/data: \/messages\/\?session_id=([a-f0-9]{32})/', $sseData, $matches)) {
                $this->currentSessionId = $matches[1];

                $this->log('info', 'Session ID obtained from SSE', [
                    'sessionId' => $this->currentSessionId
                ]);

                return $this->currentSessionId;
            }

            throw new \Exception('Could not extract session ID from SSE response');

        } catch (\Exception $e) {
            $this->log('error', 'Failed to get session ID', [
                'error' => $e->getMessage()
            ]);
            throw new \Exception('Failed to initialize Quendoo MCP session: ' . $e->getMessage());
        }
    }

    /**
     * Send message to Quendoo MCP server
     *
     * TODO: Update the message format once the correct schema is known
     * Possible formats to try:
     * - {"message": "..."}
     * - {"content": "..."}
     * - {"text": "..."}
     * - {"query": "..."}
     * - {"messages": [{"role": "user", "content": "..."}]}
     * - {"input": "...", "user_id": "...", "conversation_id": "..."}
     */
    public function sendMessage(string $message, string $conversationId): array
    {
        $sessionId = $this->getSessionId();
        $messagesUrl = $this->mcpServerBaseUrl . "/messages/?session_id={$sessionId}";

        // TODO: Update this payload format based on actual API documentation
        // Currently trying the most common format
        $payload = $this->buildMessagePayload($message, $conversationId);

        try {
            $this->log('info', 'Sending message to Quendoo MCP', [
                'sessionId' => $sessionId,
                'conversationId' => $conversationId,
                'messageLength' => strlen($message)
            ]);

            $response = $this->httpClient->post($messagesUrl, [
                'json' => $payload,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json'
                ]
            ]);

            $body = (string) $response->getBody();
            $data = json_decode($body, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new \Exception('Invalid JSON response: ' . json_last_error_msg());
            }

            $this->log('info', 'Message sent successfully', [
                'sessionId' => $sessionId
            ]);

            return [
                'type' => 'json',
                'data' => $data,
                'sessionId' => $sessionId
            ];

        } catch (RequestException $e) {
            $statusCode = $e->hasResponse() ? $e->getResponse()->getStatusCode() : 0;
            $errorBody = $e->hasResponse() ? (string) $e->getResponse()->getBody() : '';

            $this->log('error', 'Failed to send message to Quendoo MCP', [
                'statusCode' => $statusCode,
                'error' => $errorBody,
                'sessionId' => $sessionId
            ]);

            // If we get "Invalid session ID", clear the cached session
            if (strpos($errorBody, 'Invalid session ID') !== false) {
                $this->currentSessionId = null;
            }

            throw new \Exception('Quendoo MCP error: ' . $errorBody);

        } catch (\Exception $e) {
            $this->log('error', 'Quendoo MCP service error', [
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Build message payload
     *
     * TODO: Update this method with the correct format once API schema is known
     */
    private function buildMessagePayload(string $message, string $conversationId): array
    {
        // Try format 1: Simple message key (most common)
        return [
            'message' => $message
        ];

        // Alternative formats to try (uncomment and test):

        // Format 2: Content key
        // return ['content' => $message];

        // Format 3: With conversation context
        // return [
        //     'message' => $message,
        //     'conversation_id' => $conversationId
        // ];

        // Format 4: OpenAI-style messages array
        // return [
        //     'messages' => [
        //         ['role' => 'user', 'content' => $message]
        //     ]
        // ];

        // Format 5: With additional metadata
        // return [
        //     'input' => $message,
        //     'session_id' => $this->currentSessionId,
        //     'conversation_id' => $conversationId,
        //     'timestamp' => date('c')
        // ];
    }

    /**
     * Test connection to Quendoo MCP server
     */
    public function testConnection(): bool
    {
        try {
            $sessionId = $this->getSessionId();
            return !empty($sessionId);
        } catch (\Exception $e) {
            $this->log('warning', 'Connection test failed', [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Reset the current session (force new session on next request)
     */
    public function resetSession(): void
    {
        $this->currentSessionId = null;
        $this->log('info', 'Session reset');
    }

    /**
     * Get current session ID (if any)
     */
    public function getCurrentSessionId(): ?string
    {
        return $this->currentSessionId;
    }

    /**
     * Log helper
     */
    private function log(string $level, string $message, array $context = []): void
    {
        if ($this->logger) {
            $this->logger->log($level, "[QuendooMCP] $message", $context);
        }
    }
}
