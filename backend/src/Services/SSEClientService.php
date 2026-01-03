<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Psr\Log\LoggerInterface;

class SSEClientService
{
    private Client $httpClient;
    private ?LoggerInterface $logger;
    private array $activeConnections = [];

    public function __construct(?LoggerInterface $logger = null)
    {
        $this->logger = $logger;

        $this->httpClient = new Client([
            'timeout' => 0,  // No timeout for SSE
            'stream' => true,
            'headers' => [
                'Accept' => 'text/event-stream',
                'Cache-Control' => 'no-cache',
            ]
        ]);
    }

    /**
     * Connect to MCP SSE endpoint and stream responses
     */
    public function connectToMCPServer(string $serverUrl, string $conversationId, callable $onMessage): void
    {
        try {
            $this->log('info', 'Connecting to MCP SSE endpoint', [
                'url' => $serverUrl,
                'conversationId' => $conversationId
            ]);

            $response = $this->httpClient->get($serverUrl, [
                'stream' => true
            ]);

            $body = $response->getBody();
            $buffer = '';

            // Read stream line by line
            while (!$body->eof()) {
                $chunk = $body->read(1024);
                $buffer .= $chunk;

                // Process complete SSE events (delimited by double newline)
                while (($pos = strpos($buffer, "\n\n")) !== false) {
                    $eventData = substr($buffer, 0, $pos);
                    $buffer = substr($buffer, $pos + 2);

                    $event = $this->processSSEEvent($eventData);
                    if ($event && !empty($event['data'])) {
                        // Call the callback with the event
                        $onMessage($event);
                    }
                }
            }

            $this->log('info', 'SSE connection closed', [
                'conversationId' => $conversationId
            ]);

        } catch (RequestException $e) {
            $this->log('error', 'SSE connection failed', [
                'url' => $serverUrl,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Parse and process SSE event format
     */
    private function processSSEEvent(string $eventData): ?array
    {
        $lines = explode("\n", $eventData);
        $event = [
            'event' => 'message',
            'data' => '',
            'id' => null,
            'retry' => null
        ];

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || str_starts_with($line, ':')) {
                // Comment line, skip
                continue;
            }

            if (str_starts_with($line, 'event:')) {
                $event['event'] = trim(substr($line, 6));
            } elseif (str_starts_with($line, 'data:')) {
                $data = trim(substr($line, 5));
                $event['data'] .= $data;
            } elseif (str_starts_with($line, 'id:')) {
                $event['id'] = trim(substr($line, 3));
            } elseif (str_starts_with($line, 'retry:')) {
                $event['retry'] = (int)trim(substr($line, 6));
            }
        }

        return !empty($event['data']) ? $event : null;
    }

    /**
     * Stream SSE events to frontend
     */
    public function streamToFrontend(string $conversationId, array $events): void
    {
        // Set SSE headers
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no');

        // Disable output buffering
        if (ob_get_level()) {
            ob_end_clean();
        }

        foreach ($events as $event) {
            $this->sendSSEEvent($event);
        }

        // Send completion event
        $this->sendSSEEvent([
            'event' => 'end',
            'data' => json_encode(['status' => 'complete'])
        ]);

        flush();
    }

    /**
     * Send a single SSE event
     */
    private function sendSSEEvent(array $event): void
    {
        if (isset($event['event'])) {
            echo "event: {$event['event']}\n";
        }

        if (isset($event['id'])) {
            echo "id: {$event['id']}\n";
        }

        if (isset($event['data'])) {
            $data = is_string($event['data']) ? $event['data'] : json_encode($event['data']);
            echo "data: {$data}\n";
        }

        echo "\n";
        flush();
    }

    /**
     * Check if connection is alive
     */
    public function isConnectionAlive(): bool
    {
        return connection_status() === CONNECTION_NORMAL;
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
