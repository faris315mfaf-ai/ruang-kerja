<?php

namespace App\Support\Health;

use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Throwable;

/**
 * Probes the services the app cannot work without (PostgreSQL, Redis).
 *
 * The result never contains connection details or exception messages; failures
 * are logged with the exception class only.
 */
class HealthChecker
{
    /**
     * @return array{healthy: bool, checks: array<string, array{status: string, latency_ms: float}>}
     */
    public function run(): array
    {
        $checks = [
            'database' => $this->probe('database', function (): void {
                DB::connection()->select('select 1');
            }),
            'redis' => $this->probe('redis', function (): void {
                Redis::connection()->command('ping');
            }),
        ];

        $healthy = collect($checks)->every(fn (array $check): bool => $check['status'] === 'ok');

        return ['healthy' => $healthy, 'checks' => $checks];
    }

    /**
     * @param  Closure(): void  $check
     * @return array{status: string, latency_ms: float}
     */
    private function probe(string $name, Closure $check): array
    {
        $started = hrtime(true);

        try {
            $check();
            $status = 'ok';
        } catch (Throwable $e) {
            Log::warning("Health check [{$name}] failed.", ['exception' => $e::class]);
            $status = 'fail';
        }

        return [
            'status' => $status,
            'latency_ms' => round((hrtime(true) - $started) / 1_000_000, 1),
        ];
    }
}
