<?php

namespace App\Providers;

use Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull;
use Illuminate\Foundation\Http\Middleware\TrimStrings;
use Illuminate\Http\Request;
use Illuminate\Support\ServiceProvider;

/**
 * Rapat (meetings) module wiring. The LiveKit webhook is signed over the raw
 * body and limited to 64 KB (LimitRequestBody on the route): the global
 * input-cleaning middleware must not json-decode that body before the limit
 * is checked (audit R-07), and nothing reads cleaned input there anyway.
 */
final class MeetingsServiceProvider extends ServiceProvider
{
    public const string WEBHOOK_PATH = 'api/livekit/webhook';

    public function boot(): void
    {
        $skip = fn (Request $request): bool => $request->is(self::WEBHOOK_PATH);

        TrimStrings::skipWhen($skip);
        ConvertEmptyStringsToNull::skipWhen($skip);
    }
}
