<?php

use Dotenv\Dotenv;
use Slim\Factory\AppFactory;
use App\Storage\SessionStorage;
use App\Middleware\CorsMiddleware;
use App\Controllers\ChatController;
use App\Controllers\ServerController;
use App\Controllers\HealthController;
use App\Services\MessageService;
use App\Services\MCPProxyService;
use App\Services\QuendooMCPService;
use App\Services\StandardMCPService;
use App\Services\SSEClientService;
use App\Utils\Logger;

// Load Composer autoloader
require __DIR__ . '/../vendor/autoload.php';

// Load environment variables
$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

// Create Slim app
$app = AppFactory::create();

// Add error middleware
$app->addErrorMiddleware(
    displayErrorDetails: $_ENV['APP_DEBUG'] === 'true',
    logErrors: true,
    logErrorDetails: true
);

// Add routing middleware
$app->addRoutingMiddleware();

// Add body parsing middleware
$app->addBodyParsingMiddleware();

// Create dependency container
$container = $app->getContainer();

// Register dependencies
$logger = Logger::getInstance();
$storage = new SessionStorage();
$messageService = new MessageService($storage);

// Determine which MCP implementation to use
$mcpMode = $_ENV['MCP_MODE'] ?? 'standard'; // standard, quendoo, or json-rpc

switch ($mcpMode) {
    case 'standard':
    case 'quendoo':
        // Standard MCP Client (Node.js) - routes to appropriate endpoint based on MCP_MODE
        $mcpClientUrl = $_ENV['MCP_CLIENT_URL'] ?? 'http://localhost:3100';
        $mcpProxy = new StandardMCPService($mcpClientUrl, $logger);
        if ($mcpMode === 'quendoo') {
            $logger->info('Using Standard MCP Client with Quendoo endpoint', ['url' => $mcpClientUrl]);
        } else {
            $logger->info('Using Standard MCP Client', ['url' => $mcpClientUrl]);
        }
        break;

    case 'json-rpc':
        // Generic JSON-RPC 2.0 MCP implementation
        $mcpServerUrl = $_ENV['MCP_SERVER_URL'] ?? 'http://localhost:8000';
        $mcpProxy = new MCPProxyService($mcpServerUrl, $logger);
        $logger->info('Using JSON-RPC MCP Service', ['url' => $mcpServerUrl]);
        break;

    default:
        throw new \Exception("Invalid MCP_MODE: {$mcpMode}. Must be 'standard', 'quendoo', or 'json-rpc'");
}

$sseClient = new SSEClientService($logger);

$chatController = new ChatController($messageService, $mcpProxy, $logger);
$serverController = new ServerController($storage);
$healthController = new HealthController();

// Add CORS middleware
$allowedOrigins = explode(',', $_ENV['CORS_ALLOWED_ORIGINS'] ?? 'http://localhost:3000');
$app->add(new CorsMiddleware($allowedOrigins));

// Define routes

// Health check
$app->get('/health', [$healthController, 'check']);

// Chat routes
$app->post('/chat/send', [$chatController, 'sendMessage']);
$app->get('/chat/stream', [$chatController, 'streamResponse']);
$app->get('/chat/conversations', [$chatController, 'getConversations']);
$app->get('/chat/conversation/{id}', [$chatController, 'getConversation']);
$app->delete('/chat/conversation/{id}', [$chatController, 'deleteConversation']);

// Server routes
$app->get('/servers', [$serverController, 'getServers']);
$app->post('/servers', [$serverController, 'addServer']);
$app->get('/servers/{id}', [$serverController, 'getServer']);
$app->delete('/servers/{id}', [$serverController, 'removeServer']);
$app->post('/servers/{id}/test', [$serverController, 'testConnection']);

// Handle OPTIONS requests for CORS preflight
$app->options('/{routes:.+}', function ($request, $response) {
    return $response;
});

return $app;
