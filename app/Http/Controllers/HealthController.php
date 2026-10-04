<?php

namespace App\Http\Controllers;

use App\Support\Health\HealthChecker;
use Illuminate\Http\JsonResponse;

/**
 * Public uptime endpoint (`GET /health`). Registered outside the `web` group:
 * no session, no cookies, no authentication. Returns 503 when a dependency is down.
 */
class HealthController extends Controller
{
    public function __invoke(HealthChecker $checker): JsonResponse
    {
        $result = $checker->run();

        return response()->json([
            'status' => $result['healthy'] ? 'ok' : 'fail',
            'checks' => $result['checks'],
            'version' => config('app.version'),
            'time' => now()->toIso8601String(),
        ], $result['healthy'] ? 200 : 503, [
            'Cache-Control' => 'no-store',
        ]);
    }
}
