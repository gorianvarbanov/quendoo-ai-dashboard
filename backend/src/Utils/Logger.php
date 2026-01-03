<?php

namespace App\Utils;

use Monolog\Logger as MonologLogger;
use Monolog\Handler\StreamHandler;
use Monolog\Handler\RotatingFileHandler;
use Monolog\Formatter\LineFormatter;
use Psr\Log\LoggerInterface;

class Logger
{
    private static ?LoggerInterface $instance = null;

    /**
     * Get logger instance (singleton)
     */
    public static function getInstance(): LoggerInterface
    {
        if (self::$instance === null) {
            self::$instance = self::createLogger();
        }

        return self::$instance;
    }

    /**
     * Create and configure Monolog logger
     */
    private static function createLogger(): LoggerInterface
    {
        $logLevel = $_ENV['LOG_LEVEL'] ?? 'debug';
        $logFile = $_ENV['LOG_FILE'] ?? __DIR__ . '/../../storage/logs/app.log';
        $logPath = dirname($logFile);

        // Ensure log directory exists
        if (!is_dir($logPath)) {
            mkdir($logPath, 0755, true);
        }

        $logger = new MonologLogger('quendoo-ai-dashboard');

        // File handler with rotation (keep 7 days)
        $fileHandler = new RotatingFileHandler(
            $logFile,
            7,
            self::getMonologLevel($logLevel)
        );

        // Custom format
        $formatter = new LineFormatter(
            "[%datetime%] %channel%.%level_name%: %message% %context% %extra%\n",
            'Y-m-d H:i:s',
            true,
            true
        );
        $fileHandler->setFormatter($formatter);

        $logger->pushHandler($fileHandler);

        // Console handler in development
        if (($_ENV['APP_ENV'] ?? 'production') === 'development') {
            $consoleHandler = new StreamHandler('php://stderr', self::getMonologLevel($logLevel));
            $consoleHandler->setFormatter($formatter);
            $logger->pushHandler($consoleHandler);
        }

        return $logger;
    }

    /**
     * Convert log level string to Monolog level
     */
    private static function getMonologLevel(string $level): int
    {
        return match (strtolower($level)) {
            'debug' => MonologLogger::DEBUG,
            'info' => MonologLogger::INFO,
            'notice' => MonologLogger::NOTICE,
            'warning' => MonologLogger::WARNING,
            'error' => MonologLogger::ERROR,
            'critical' => MonologLogger::CRITICAL,
            'alert' => MonologLogger::ALERT,
            'emergency' => MonologLogger::EMERGENCY,
            default => MonologLogger::INFO,
        };
    }
}
