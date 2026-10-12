<?php

namespace App\Http\Controllers\Api\Config;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * GET /api/v1/konfigurasi — public (no token). The app reads it on launch:
 * minimum / latest supported version, maintenance switch and the server clock
 * (for skew checks). Values come from config/api_app.php.
 */
class AppConfigController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'min_app_version' => config()->string('api_app.min_version'),
            'latest_app_version' => config()->string('api_app.latest_version'),
            'maintenance' => [
                'active' => config()->boolean('api_app.maintenance.active'),
                'message' => config()->string('api_app.maintenance.message'),
            ],
            'server_time' => now()->toIso8601String(),
        ]);
    }
}
