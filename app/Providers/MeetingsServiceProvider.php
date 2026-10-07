<?php

namespace App\Providers;

use Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull;
use Illuminate\Foundation\Http\Middleware\TrimStrings;
use Illuminate\Http\Request;
use Illuminate\Support\ServiceProvider;

/**
 * Rapat (meetings) module wiring. The machine endpoints (LiveKit webhooks,
 * transcription worker callback) are signed over the raw body and size
 * limited on the route (LimitRequestBody): the global input-cleaning
 * middleware must not json-decode those bodies before the limit is checked
 * (audit R-07, B-05), and nothing reads cleaned input there anyway.
 */
final class MeetingsServiceProvider extends ServiceProvider
{
    /** Unauthenticated, signed, body-limited routes (routes/meetings.php, routes/notulen.php). */
    public const array MACHINE_PATHS = ['api/livekit/webhook', 'api/notulen/livekit', 'api/notulen/transcript'];

    public function boot(): void
    {
        $skip = fn (Request $request): bool => $request->is(...self::MACHINE_PATHS);

        TrimStrings::skipWhen($skip);
        ConvertEmptyStringsToNull::skipWhen($skip);
    }
}
