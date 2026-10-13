<?php

namespace App\Http\Controllers\Api\Map;

use App\Http\Controllers\Controller;
use Illuminate\Http\Client\Response as HttpResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * GET /api/v1/peta/{z}/{x}/{y} — OpenStreetMap raster tile proxy for the Absen
 * map card (owner request 14 Oct 2026: "maps di absen adalah maps riil").
 *
 * Why a proxy: the OSM tile usage policy asks for a descriptive User-Agent,
 * caching and no bulk hammering from thousands of handsets. Tiles are fetched
 * once per TTL on the server (private disk), served to the app with a long
 * client cache, and the phone never talks to tile.openstreetmap.org directly
 * (no IP/coordinate leak to a third party). Upstream trouble answers 204 so
 * the app falls back to its sketch map without a red error.
 *
 * Attribution "© OpenStreetMap contributors" is rendered by the app map card.
 */
class TileController extends Controller
{
    public const int MIN_ZOOM = 14;

    public const int MAX_ZOOM = 18;

    private const string PNG_MAGIC = "\x89PNG\r\n\x1a\n";

    /** Client + server cache: 7 days. */
    private const int TTL_SECONDS = 604_800;

    /** After an upstream failure the same tile is not retried for this long. */
    private const int FAILURE_BACKOFF_SECONDS = 60;

    public function __invoke(int $z, int $x, int $y): Response
    {
        $limit = 2 ** $z;

        if ($z < self::MIN_ZOOM || $z > self::MAX_ZOOM || $x < 0 || $y < 0 || $x >= $limit || $y >= $limit) {
            return response()->json([
                'message' => 'Ubin peta di luar jangkauan.',
                'code' => 'invalid_tile',
            ], 422);
        }

        $png = $this->cached($z, $x, $y) ?? $this->fetchAndStore($z, $x, $y);

        if ($png === null) {
            return $this->unavailable();
        }

        return response($png, 200, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'private, max-age='.self::TTL_SECONDS,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function path(int $z, int $x, int $y): string
    {
        return "osm-tiles/$z/$x/$y.png";
    }

    private function cached(int $z, int $x, int $y): ?string
    {
        $disk = Storage::disk('local');
        $path = $this->path($z, $x, $y);

        try {
            if (! $disk->exists($path)) {
                return null;
            }

            if (time() - $disk->lastModified($path) > self::TTL_SECONDS) {
                return null;
            }

            $bytes = $disk->get($path);

            return is_string($bytes) && $this->isPng($bytes) ? $bytes : null;
        } catch (Throwable) {
            return null;
        }
    }

    private function fetchAndStore(int $z, int $x, int $y): ?string
    {
        $backoffKey = "osm-tile-fail:$z/$x/$y";

        if (Cache::has($backoffKey)) {
            return null;
        }

        $template = (string) config('services.osm.tile_url');

        try {
            $response = Http::withUserAgent((string) config('services.osm.user_agent'))
                ->timeout(5)
                ->get(strtr($template, ['{z}' => $z, '{x}' => $x, '{y}' => $y]));
        } catch (Throwable) {
            Cache::put($backoffKey, true, self::FAILURE_BACKOFF_SECONDS);

            return null;
        }

        if (! $this->usable($response)) {
            Cache::put($backoffKey, true, self::FAILURE_BACKOFF_SECONDS);

            return null;
        }

        $bytes = $response->body();

        try {
            Storage::disk('local')->put($this->path($z, $x, $y), $bytes);
        } catch (Throwable) {
            // The tile is still served; the next request simply fetches again.
        }

        return $bytes;
    }

    private function usable(HttpResponse $response): bool
    {
        return $response->successful() && $this->isPng($response->body());
    }

    private function isPng(string $bytes): bool
    {
        return str_starts_with($bytes, self::PNG_MAGIC);
    }

    private function unavailable(): Response
    {
        return response()->noContent(204, ['Cache-Control' => 'no-store']);
    }
}
