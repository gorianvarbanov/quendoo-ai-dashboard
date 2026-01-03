<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use App\Services\MessageService;
use App\Services\MCPServiceInterface;
use Psr\Log\LoggerInterface;

class ChatController
{
    private MessageService $messageService;
    private MCPServiceInterface $mcpProxy;
    private LoggerInterface $logger;

    public function __construct(
        MessageService $messageService,
        MCPServiceInterface $mcpProxy,
        LoggerInterface $logger
    ) {
        $this->messageService = $messageService;
        $this->mcpProxy = $mcpProxy;
        $this->logger = $logger;
    }

    /**
     * POST /chat/send - Send message to MCP server
     */
    public function sendMessage(
        ServerRequestInterface $request,
        ResponseInterface $response
    ): ResponseInterface {
        $data = $request->getParsedBody();

        $serverId = $data['serverId'] ?? null;
        $content = $data['content'] ?? null;
        $conversationId = $data['conversationId'] ?? $this->generateId('conv_');

        if (!$content) {
            $response->getBody()->write(json_encode([
                'error' => 'Message content is required'
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        try {
            $this->logger->info('Sending message', [
                'conversationId' => $conversationId,
                'contentLength' => strlen($content)
            ]);

            // Save user message
            $this->messageService->saveMessage($conversationId, 'user', $content);

            // Send to MCP server
            $mcpResponse = $this->mcpProxy->sendMessage($content, $conversationId);

            if ($mcpResponse['type'] === 'json') {
                // Direct JSON response
                $aiContent = $this->extractContentFromMCPResponse($mcpResponse['data']);

                // Save AI response
                $this->messageService->saveMessage($conversationId, 'assistant', $aiContent);

                $response->getBody()->write(json_encode([
                    'status' => 'success',
                    'conversationId' => $conversationId,
                    'response' => [
                        'role' => 'assistant',
                        'content' => $aiContent,
                        'timestamp' => date('c')
                    ]
                ]));

                return $response->withHeader('Content-Type', 'application/json');

            } elseif ($mcpResponse['type'] === 'stream') {
                // SSE streaming response
                $response->getBody()->write(json_encode([
                    'status' => 'streaming',
                    'conversationId' => $conversationId,
                    'streamUrl' => "/chat/stream?conversationId={$conversationId}"
                ]));

                return $response->withHeader('Content-Type', 'application/json');
            }

            throw new \Exception('Unexpected response type from MCP server');

        } catch (\Exception $e) {
            $this->logger->error('Failed to send message', [
                'error' => $e->getMessage(),
                'conversationId' => $conversationId
            ]);

            $response->getBody()->write(json_encode([
                'error' => $e->getMessage()
            ]));
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    }

    /**
     * GET /chat/conversations - Get all conversations
     */
    public function getConversations(
        ServerRequestInterface $request,
        ResponseInterface $response
    ): ResponseInterface {
        $conversations = $this->messageService->getConversations();

        $response->getBody()->write(json_encode($conversations));
        return $response->withHeader('Content-Type', 'application/json');
    }

    /**
     * GET /chat/conversation/{id} - Get specific conversation
     */
    public function getConversation(
        ServerRequestInterface $request,
        ResponseInterface $response,
        array $args
    ): ResponseInterface {
        $conversationId = $args['id'];
        $messages = $this->messageService->getConversationMessages($conversationId);

        $response->getBody()->write(json_encode([
            'conversationId' => $conversationId,
            'messages' => $messages
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    /**
     * GET /chat/stream - Stream SSE responses from MCP server
     */
    public function streamResponse(
        ServerRequestInterface $request,
        ResponseInterface $response
    ): ResponseInterface {
        $conversationId = $request->getQueryParams()['conversationId'] ?? null;

        if (!$conversationId) {
            $response->getBody()->write(json_encode(['error' => 'conversationId is required']));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        // TODO: Implement SSE streaming with SSEClientService
        // For now, return placeholder
        $response->getBody()->write(json_encode([
            'message' => 'SSE streaming endpoint - to be implemented with SSEClientService'
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    /**
     * DELETE /chat/conversation/{id} - Delete conversation
     */
    public function deleteConversation(
        ServerRequestInterface $request,
        ResponseInterface $response,
        array $args
    ): ResponseInterface {
        $conversationId = $args['id'];

        try {
            $this->messageService->deleteConversation($conversationId);
            return $response->withStatus(204);
        } catch (\Exception $e) {
            $response->getBody()->write(json_encode([
                'error' => 'Conversation not found'
            ]));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }
    }

    /**
     * Helper: Extract content from MCP JSON-RPC response
     */
    private function extractContentFromMCPResponse(array $mcpData): string
    {
        // Handle JSON-RPC 2.0 response format
        if (isset($mcpData['result'])) {
            $result = $mcpData['result'];

            // Check various possible content locations
            if (is_string($result)) {
                return $result;
            }

            if (isset($result['content'])) {
                return is_string($result['content']) ? $result['content'] : json_encode($result['content']);
            }

            if (isset($result['message'])) {
                return $result['message'];
            }

            return json_encode($result);
        }

        // Handle error responses
        if (isset($mcpData['error'])) {
            throw new \Exception('MCP server error: ' . ($mcpData['error']['message'] ?? 'Unknown error'));
        }

        // Fallback
        return json_encode($mcpData);
    }

    /**
     * Helper: Generate unique ID
     */
    private function generateId(string $prefix = ''): string
    {
        return $prefix . time() . '_' . bin2hex(random_bytes(8));
    }
}
