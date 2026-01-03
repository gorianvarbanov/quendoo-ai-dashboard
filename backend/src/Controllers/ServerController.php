<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use App\Storage\SessionStorage;

class ServerController
{
    private SessionStorage $storage;

    public function __construct(SessionStorage $storage)
    {
        $this->storage = $storage;
    }

    /**
     * GET /servers - Get all configured servers
     */
    public function getServers(
        ServerRequestInterface $request,
        ResponseInterface $response
    ): ResponseInterface {
        $servers = $this->storage->get('servers', []);

        // Ensure default MCP server exists
        if (empty($servers)) {
            $servers = $this->initializeDefaultServer();
        }

        $response->getBody()->write(json_encode(array_values($servers)));
        return $response->withHeader('Content-Type', 'application/json');
    }

    /**
     * POST /servers - Add new server
     */
    public function addServer(
        ServerRequestInterface $request,
        ResponseInterface $response
    ): ResponseInterface {
        $data = $request->getParsedBody();

        if (!isset($data['url'])) {
            $response->getBody()->write(json_encode([
                'error' => 'Server URL is required'
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $server = [
            'id' => $this->generateId('server_'),
            'name' => $data['name'] ?? 'Unnamed Server',
            'url' => $data['url'],
            'description' => $data['description'] ?? '',
            'created_at' => date('c'),
            'status' => 'disconnected'
        ];

        $servers = $this->storage->get('servers', []);
        $servers[$server['id']] = $server;
        $this->storage->set('servers', $servers);

        $response->getBody()->write(json_encode($server));
        return $response->withStatus(201)->withHeader('Content-Type', 'application/json');
    }

    /**
     * DELETE /servers/{id} - Remove server
     */
    public function removeServer(
        ServerRequestInterface $request,
        ResponseInterface $response,
        array $args
    ): ResponseInterface {
        $serverId = $args['id'];

        $servers = $this->storage->get('servers', []);
        if (isset($servers[$serverId])) {
            unset($servers[$serverId]);
            $this->storage->set('servers', $servers);

            return $response->withStatus(204);
        }

        $response->getBody()->write(json_encode([
            'error' => 'Server not found'
        ]));
        return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
    }

    /**
     * POST /servers/{id}/test - Test server connection
     */
    public function testConnection(
        ServerRequestInterface $request,
        ResponseInterface $response,
        array $args
    ): ResponseInterface {
        $serverId = $args['id'];

        $servers = $this->storage->get('servers', []);
        if (!isset($servers[$serverId])) {
            $response->getBody()->write(json_encode([
                'error' => 'Server not found'
            ]));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }

        $server = $servers[$serverId];

        // TODO: Phase 4 - Implement actual connection test
        // For now, return mock response
        $isConnected = $this->testServerConnection($server['url']);

        $response->getBody()->write(json_encode([
            'serverId' => $serverId,
            'connected' => $isConnected,
            'message' => $isConnected ? 'Connection successful' : 'Connection failed (mock test)'
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    /**
     * GET /servers/{id} - Get specific server
     */
    public function getServer(
        ServerRequestInterface $request,
        ResponseInterface $response,
        array $args
    ): ResponseInterface {
        $serverId = $args['id'];

        $servers = $this->storage->get('servers', []);
        if (!isset($servers[$serverId])) {
            $response->getBody()->write(json_encode([
                'error' => 'Server not found'
            ]));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write(json_encode($servers[$serverId]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    /**
     * Helper: Initialize default MCP server from .env
     */
    private function initializeDefaultServer(): array
    {
        $defaultUrl = $_ENV['MCP_SERVER_URL'] ?? 'https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse';

        $defaultServer = [
            'id' => 'default_server',
            'name' => 'Quendoo MCP Server',
            'url' => $defaultUrl,
            'description' => 'Default Quendoo MCP Server',
            'created_at' => date('c'),
            'status' => 'disconnected'
        ];

        $servers = [$defaultServer['id'] => $defaultServer];
        $this->storage->set('servers', $servers);

        return $servers;
    }

    /**
     * Helper: Test server connection (mock for now)
     */
    private function testServerConnection(string $url): bool
    {
        // TODO: Phase 4 - Implement actual connection test using Guzzle
        // For now, return true for mock
        return true;
    }

    /**
     * Helper: Generate unique ID
     */
    private function generateId(string $prefix = ''): string
    {
        return $prefix . time() . '_' . bin2hex(random_bytes(8));
    }
}
