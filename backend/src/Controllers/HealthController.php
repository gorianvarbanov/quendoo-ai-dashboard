<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class HealthController
{
    /**
     * GET /health - Health check endpoint
     */
    public function check(
        ServerRequestInterface $request,
        ResponseInterface $response
    ): ResponseInterface {
        $health = [
            'status' => 'healthy',
            'timestamp' => date('c'),
            'php_version' => PHP_VERSION,
            'environment' => $_ENV['APP_ENV'] ?? 'unknown'
        ];

        $response->getBody()->write(json_encode($health));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
