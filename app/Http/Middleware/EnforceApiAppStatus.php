<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Maintenance switch and minimum app version for the mobile API (/api/v1/*).
 *
 * - `APP_MAINTENANCE_API=true` → every v1 route answers 503 `{code: maintenance}`;
 * - header `X-App-Version` below `APP_MIN_VERSION` → 426 `{code: update_required}`.
 *
 * `GET /api/v1/konfigurasi` is always exempt (the app reads it to learn exactly
 * this). A missing or unparsable version header is not blocked: browsers, curl
 * and older builds do not send it. Other /api routes (webhooks) are untouched.
 */
class EnforceApiAppStatus
{
    public const string VERSION_HEADER = 'X-App-Version';

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->is('api/v1/*') || $request->routeIs('api.v1.config')) {
            return $next($request);
        }

        if (config()->boolean('api_app.maintenance.active')) {
            return response()->json([
                'code' => 'maintenance',
                'message' => config()->string('api_app.maintenance.message'),
            ], Response::HTTP_SERVICE_UNAVAILABLE, ['Retry-After' => '300']);
        }

        $version = trim((string) $request->header(self::VERSION_HEADER));
        $minimum = config()->string('api_app.min_version');

        if ($version !== '' && self::isVersion($version) && version_compare($version, $minimum, '<')) {
            return response()->json([
                'code' => 'update_required',
                'message' => 'Versi aplikasi Anda sudah tidak didukung. Perbarui RuangKerja ke versi terbaru untuk melanjutkan.',
                'min_app_version' => $minimum,
            ], Response::HTTP_UPGRADE_REQUIRED);
        }

        return $next($request);
    }

    private static function isVersion(string $value): bool
    {
        return preg_match('/^\d+(\.\d+){0,3}([-+][0-9A-Za-z.-]+)?$/', $value) === 1;
    }
}
