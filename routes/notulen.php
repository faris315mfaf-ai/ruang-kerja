<?php

use App\Http\Controllers\Notulen\NotulenController;
use App\Http\Controllers\Notulen\NotulenLiveKitWebhookController;
use App\Http\Controllers\Notulen\TranscriptIngestController;
use App\Http\Middleware\AuthenticateSession;
use App\Http\Middleware\EnsureActiveEmployee;
use App\Http\Middleware\EnsureFeatureEnabled;
use App\Http\Middleware\EnsureTwoFactorForSuperAdmin;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LimitRequestBody;
use App\Http\Middleware\ResolveCompanyContext;
use App\Http\Middleware\RestrictCredentialRoutes;
use App\Http\Middleware\RestrictKioskDevice;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Illuminate\View\Middleware\ShareErrorsFromSession;

/*
 * Notulen otomatis (Video RuangKerja, tahap 1; docs/fitur/notulen-otomatis-kontrak.md).
 * Behind FEATURE_MEETINGS like /rapat. Authorization: MeetingTranscriptPolicy
 * (invisible meeting → 404). Server-to-server: the worker's transcripts
 * (HMAC) and a second LiveKit webhook (JWT) — no session/CSRF.
 */
Route::middleware([EnsureFeatureEnabled::class.':meetings', 'auth', 'verified'])
    ->prefix('rapat/{meeting}/notulen-otomatis')
    ->whereUlid('meeting')
    ->name('meetings.notulen.')
    ->group(function () {
        Route::get('/', [NotulenController::class, 'page'])->name('page');
        Route::get('status', [NotulenController::class, 'status'])->middleware('throttle:api')->name('status');
        Route::get('transkrip', [NotulenController::class, 'transcript'])->middleware('throttle:api')->name('transcript');
        Route::put('pengaturan', [NotulenController::class, 'settings'])->middleware('throttle:api')->name('settings');
        Route::put('persetujuan', [NotulenController::class, 'consent'])->middleware('throttle:api')->name('consent');
        Route::post('masukkan', [NotulenController::class, 'insert'])->middleware('throttle:api')->name('insert');
        Route::delete('draf', [NotulenController::class, 'discard'])->middleware('throttle:api')->name('discard');
        Route::post('ringkas-ulang', [NotulenController::class, 'resummarize'])->middleware('throttle:api')->name('resummarize');
        Route::post('tindak-lanjut/{suggestion}/tugas', [NotulenController::class, 'task'])
            ->where('suggestion', 'tl-[0-9]{1,3}')->middleware('throttle:api')->name('task');
    });

$serverToServer = [
    EncryptCookies::class,
    AddQueuedCookiesToResponse::class,
    StartSession::class,
    ShareErrorsFromSession::class,
    PreventRequestForgery::class,
    'auth.session',
    AuthenticateSession::class,
    EnsureActiveEmployee::class,
    ResolveCompanyContext::class,
    RestrictKioskDevice::class,
    RestrictCredentialRoutes::class,
    EnsureTwoFactorForSuperAdmin::class,
    HandleAppearance::class,
    HandleInertiaRequests::class,
    AddLinkHeadersForPreloadedAssets::class,
];

Route::post('api/notulen/transcript', TranscriptIngestController::class)
    ->middleware([LimitRequestBody::class.':config:notulen.transcriber.max_body_bytes', EnsureFeatureEnabled::class.':meetings', 'throttle:120,1'])
    ->withoutMiddleware($serverToServer)
    ->name('meetings.notulen.ingest');

Route::post('api/notulen/livekit', NotulenLiveKitWebhookController::class)
    ->middleware([LimitRequestBody::class.':'.NotulenLiveKitWebhookController::MAX_BODY_BYTES, EnsureFeatureEnabled::class.':meetings', 'throttle:600,1'])
    ->withoutMiddleware($serverToServer)
    ->name('meetings.notulen.livekit');
