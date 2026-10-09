<?php

namespace App\Http\Controllers\Android;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * Public Digital Asset Links statement (`GET /.well-known/assetlinks.json`).
 * Google Play fetches this to verify the Android app ↔ website link, so it
 * must answer without auth, session or CSRF. While no release certificate
 * fingerprint is configured the endpoint answers `[]` (HTTP 200), keeping
 * local/dev environments free of 404s.
 */
class AssetLinksController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $raw = (string) config('branding.android.cert_sha256', '');

        // Comma-separated values are allowed to cover certificate rotation;
        // uppercased, whitespace-free, `AA:BB:…` (66 chars) per statement spec.
        $fingerprints = array_values(array_map(
            static fn (string $value): string => strtoupper(str_replace(' ', '', trim($value))),
            array_filter(array_map(trim(...), explode(',', $raw))),
        ));

        // A malformed fingerprint silently breaks App Links verification on
        // the Google side; surface it in the log instead of serving it.
        foreach ($fingerprints as $index => $fingerprint) {
            if (preg_match('/^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/', $fingerprint) !== 1) {
                Log::warning('android.assetlinks invalid fingerprint', ['index' => $index + 1]);
                unset($fingerprints[$index]);
            }
        }

        $fingerprints = array_values($fingerprints);

        if ($fingerprints === []) {
            return response()->json([])->header('Cache-Control', 'public, max-age=600');
        }

        return response()
            ->json([
                [
                    'relation' => ['delegate_permission/common.handle_all_urls'],
                    'target' => [
                        'namespace' => 'android_app',
                        'package_name' => (string) config('branding.android.package'),
                        'sha256_cert_fingerprints' => $fingerprints,
                    ],
                ],
            ])
            ->header('Cache-Control', 'public, max-age=600');
    }
}
