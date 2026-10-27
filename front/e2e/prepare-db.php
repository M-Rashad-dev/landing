<?php

declare(strict_types=1);

// Run from back/: php ../front/e2e/prepare-db.php <database>
// Creates the E2E database (connection settings from back/.env) if it does not exist yet.

require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$database = $argv[1] ?? '';
if (preg_match('/^[a-z0-9_]{1,64}$/', $database) !== 1) {
    fwrite(STDERR, "Invalid database name\n");
    exit(1);
}

$c = config('database.connections.mysql');
$pdo = new PDO("mysql:host={$c['host']};port={$c['port']}", (string) $c['username'], (string) $c['password']);
$pdo->exec("CREATE DATABASE IF NOT EXISTS `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
echo "database {$database} ready\n";
