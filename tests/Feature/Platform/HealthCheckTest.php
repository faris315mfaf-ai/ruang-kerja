<?php

use Illuminate\Support\Facades\Redis;

it('reports healthy database and redis without starting a session', function () {
    $response = $this->getJson('/health');

    $response->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('status', 'ok')
        ->assertJsonPath('checks.database.status', 'ok')
        ->assertJsonPath('checks.redis.status', 'ok')
        ->assertJsonStructure([
            'status',
            'checks' => ['database' => ['status', 'latency_ms'], 'redis' => ['status', 'latency_ms']],
            'version',
            'time',
        ]);

    expect($response->headers->getCookies())->toBeEmpty();
});

it('returns 503 without connection details when a dependency is down', function () {
    config(['database.redis.default.port' => 1, 'database.redis.default.host' => '127.0.0.1']);
    Redis::purge('default');

    $response = $this->getJson('/health');

    $response->assertServiceUnavailable()
        ->assertJsonPath('status', 'fail')
        ->assertJsonPath('checks.redis.status', 'fail')
        ->assertJsonPath('checks.database.status', 'ok');

    $body = (string) $response->getContent();

    expect($body)->not->toContain((string) config('database.connections.pgsql.password'))
        ->not->toContain((string) config('database.connections.pgsql.username'))
        ->not->toContain('Connection refused');
});

it('keeps the framework /up endpoint', function () {
    $this->get('/up')->assertOk();
});
