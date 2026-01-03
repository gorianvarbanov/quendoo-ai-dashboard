<?php

namespace App\Storage;

class SessionStorage
{
    public function __construct()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start([
                'cookie_httponly' => true,
                'cookie_secure' => false, // Set to true in production with HTTPS
                'cookie_samesite' => 'Lax',
                'use_strict_mode' => true,
            ]);
        }
    }

    /**
     * Get a value from session storage
     */
    public function get(string $key, $default = null)
    {
        return $_SESSION[$key] ?? $default;
    }

    /**
     * Set a value in session storage
     */
    public function set(string $key, $value): void
    {
        $_SESSION[$key] = $value;
    }

    /**
     * Check if a key exists in session storage
     */
    public function has(string $key): bool
    {
        return isset($_SESSION[$key]);
    }

    /**
     * Remove a value from session storage
     */
    public function remove(string $key): void
    {
        unset($_SESSION[$key]);
    }

    /**
     * Clear all session data
     */
    public function clear(): void
    {
        session_destroy();
        session_start();
    }

    /**
     * Get all session data
     */
    public function all(): array
    {
        return $_SESSION;
    }

    /**
     * Get session ID
     */
    public function getId(): string
    {
        return session_id();
    }
}
