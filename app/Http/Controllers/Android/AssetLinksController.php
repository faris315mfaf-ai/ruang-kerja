<?php

namespace App\Http\Controllers\Android;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

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

        // Comma-separated values are allowed to cover certificate rotation.
        $fingerprints = array_values(array_filter(array_map(trim(...), explode(',', $raw))));

        if ($fingerprints === []) {
            return response()->json([]);
        }

        return response()->json([
            [
                'relation' => ['delegate_permission/common.handle_all_urls'],
                'target' => [
                    'namespace' => 'android_app',
                    'package_name' => (string) config('branding.android.package'),
                    'sha256_cert_fingerprints' => $fingerprints,
                ],
            ],
        ]);
    }
}
