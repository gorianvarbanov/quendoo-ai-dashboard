<?php

/**
 * Quendoo AI Dashboard - Backend Entry Point
 *
 * This file is the entry point for all API requests.
 * It bootstraps the Slim application and handles incoming requests.
 */

// Bootstrap the application
$app = require __DIR__ . '/../src/bootstrap.php';

// Run the application
$app->run();
