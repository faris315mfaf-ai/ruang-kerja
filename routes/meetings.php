<?php

use App\Domain\Meetings\Guests\Services\GuestLinks;
use App\Http\Controllers\Meetings\CalendarController;
use App\Http\Controllers\Meetings\GuestPortalController;
use App\Http\Controllers\Meetings\LiveKitWebhookController;
use App\Http\Controllers\Meetings\ManagementScheduleController;
use App\Http\Controllers\Meetings\MeetingController;
use App\Http\Controllers\Meetings\MeetingGuestController;
use App\Http\Controllers\Meetings\MeetingRoomController;
use App\Http\Controllers\Meetings\MeetingVideoController;
use App\Http\Controllers\Meetings\MinutesCollabStateController;
use App\Http\Controllers\Meetings\MinutesController;
use App\Http\Middleware\AuthenticateSession;
use App\Http\Middleware\EnsureActiveEmployee;
use App\Http\Middleware\EnsureFeatureEnabled;
use App\Http\Middleware\EnsureFullPageLoad;
use App\Http\Middleware\EnsureTwoFactorForSuperAdmin;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LimitRequestBody;
use App\Http\Middleware\RestrictCredentialRoutes;
use App\Http\Middleware\RestrictKioskDevice;
use App\Http\Middleware\VerifyCollabSecret;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Illuminate\View\Middleware\ShareErrorsFromSession;

/*
 * Rapat, notulen & kalender (Fase 2, F2-3; docs/fitur/rapat-kalender.md).
 * Behind FEATURE_MEETINGS (config/features.php): 404 while off.
 * Authorization: MeetingPolicy (invisible meeting → 404), /manajemen/jadwal =
 * Gate viewManagementDashboard. Google Calendar/Meet sync is on hold.
 * Video RuangKerja (LiveKit, §6a): /gabung (pre-join), /ruang (room), token,
 * moderation, the "Notulen Hidup" room endpoints (notes source, speaking
 * time, attendance, call; docs/fitur/rapat-video-kontrak.md) and the signed
 * LiveKit webhook (no session/CSRF). External guests (docs/sesi/rapat-tamu-eksternal.md):
 * organizer-side list / waiting room below, the public guest page and
 * /api/tamu/{token}/* at the end of the file.
 */
Route::middleware([EnsureFeatureEnabled::class.':meetings', 'auth', 'verified'])->group(function () {
    Route::prefix('rapat')->name('meetings.')->group(function () {
        Route::get('/', [MeetingController::class, 'index'])->name('index');
        Route::get('baru', [MeetingController::class, 'create'])->name('create');
        Route::post('/', [MeetingController::class, 'store'])->middleware('throttle:api')->name('store');
        Route::get('bentrok', [MeetingController::class, 'conflicts'])->middleware('throttle:api')->name('conflicts');

        Route::get('{meeting}', [MeetingController::class, 'show'])->whereUlid('meeting')->name('show');
        Route::get('{meeting}/ubah', [MeetingController::class, 'edit'])->whereUlid('meeting')->name('edit');
        Route::patch('{meeting}', [MeetingController::class, 'update'])->whereUlid('meeting')->middleware('throttle:api')->name('update');
        Route::delete('{meeting}', [MeetingController::class, 'destroy'])->whereUlid('meeting')->middleware('throttle:api')->name('cancel');
        Route::post('{meeting}/kehadiran', [MeetingController::class, 'rsvp'])->whereUlid('meeting')->middleware('throttle:api')->name('rsvp');

        Route::get('{meeting}/notulen', [MinutesController::class, 'show'])->whereUlid('meeting')->name('minutes.show');
        Route::get('{meeting}/notulen/data', [MinutesController::class, 'data'])->whereUlid('meeting')->middleware('throttle:api')->name('minutes.data');
        Route::get('{meeting}/notulen/kolaborasi', [MinutesController::class, 'collabToken'])->whereUlid('meeting')->middleware('throttle:60,1')->name('minutes.collab');
        Route::post('{meeting}/notulen/menyunting', [MinutesController::class, 'editing'])->whereUlid('meeting')->middleware('throttle:api')->name('minutes.editing');
        Route::put('{meeting}/notulen', [MinutesController::class, 'save'])->whereUlid('meeting')->middleware('throttle:api')->name('minutes.save');
        Route::post('{meeting}/notulen/final', [MinutesController::class, 'finalize'])->whereUlid('meeting')->middleware('throttle:api')->name('minutes.finalize');
        Route::post('{meeting}/notulen/buka', [MinutesController::class, 'reopen'])->whereUlid('meeting')->middleware('throttle:api')->name('minutes.reopen');
        Route::post('{meeting}/notulen/tugas', [MinutesController::class, 'convert'])->whereUlid('meeting')->middleware('throttle:api')->name('minutes.tasks');
        Route::post('{meeting}/notulen/ingatkan', [MinutesController::class, 'remind'])->whereUlid('meeting')->middleware('throttle:api')->name('minutes.remind');

        Route::post('{meeting}/tindak-lanjut', [MinutesController::class, 'storeItem'])->whereUlid('meeting')->middleware('throttle:api')->name('items.store');
        Route::patch('{meeting}/tindak-lanjut/{item}', [MinutesController::class, 'updateItem'])->whereUlid(['meeting', 'item'])->middleware('throttle:api')->name('items.update');
        Route::delete('{meeting}/tindak-lanjut/{item}', [MinutesController::class, 'destroyItem'])->whereUlid(['meeting', 'item'])->middleware('throttle:api')->name('items.destroy');

        // Audit R-14: the video documents carry the microphone/screen capture
        // grants, so an Inertia navigation into them must be a full load
        // (EnsureFullPageLoad → X-Inertia-Location) to pick the header up.
        Route::get('{meeting}/gabung', [MeetingVideoController::class, 'join'])->whereUlid('meeting')->middleware(EnsureFullPageLoad::class)->name('video.join');
        Route::get('{meeting}/ruang', [MeetingVideoController::class, 'room'])->whereUlid('meeting')->middleware(EnsureFullPageLoad::class)->name('video.room');
        Route::post('{meeting}/video/token', [MeetingVideoController::class, 'token'])->whereUlid('meeting')->middleware('throttle:30,1')->name('video.token');
        Route::post('{meeting}/video/peserta/{identity}/bisukan', [MeetingVideoController::class, 'mute'])->whereUlid('meeting')->where('identity', '[0-9A-Za-z]{26}|guest:[0-9A-Za-z]{26}')->middleware('throttle:api')->name('video.mute');
        Route::delete('{meeting}/video/peserta/{identity}', [MeetingVideoController::class, 'remove'])->whereUlid('meeting')->where('identity', '[0-9A-Za-z]{26}|guest:[0-9A-Za-z]{26}')->middleware('throttle:api')->name('video.remove');
        Route::delete('{meeting}/video/peserta/{identity}/larangan', [MeetingVideoController::class, 'readmit'])->whereUlid(['meeting', 'identity'])->middleware('throttle:api')->name('video.readmit');
        Route::post('{meeting}/video/tangan', [MeetingVideoController::class, 'hand'])->whereUlid('meeting')->middleware('throttle:30,1')->name('video.hand');
        Route::post('{meeting}/video/atribut', [MeetingVideoController::class, 'attributes'])->whereUlid('meeting')->middleware('throttle:60,1')->name('video.attributes');

        // Ruang "Notulen Hidup" (docs/fitur/rapat-video-kontrak.md): notes source, speaking time, Kehadiran, Panggil.
        Route::post('{meeting}/video/sumber-notulen', [MeetingRoomController::class, 'notesSource'])->whereUlid('meeting')->middleware('throttle:api')->name('video.notes-source');
        Route::get('{meeting}/video/bicara', [MeetingRoomController::class, 'speaking'])->whereUlid('meeting')->middleware('throttle:api')->name('video.speaking');
        Route::post('{meeting}/video/bicara', [MeetingRoomController::class, 'reportSpeaking'])->whereUlid('meeting')->middleware('throttle:20,1')->name('video.speaking.report');
        Route::get('{meeting}/video/kehadiran', [MeetingRoomController::class, 'attendance'])->whereUlid('meeting')->middleware('throttle:api')->name('video.attendance');
        // External guests (organizer: list with links, add, rotate, revoke) and the waiting room.
        Route::get('{meeting}/tamu', [MeetingGuestController::class, 'index'])->whereUlid('meeting')->middleware('throttle:api')->name('guests.index');
        Route::post('{meeting}/tamu', [MeetingGuestController::class, 'store'])->whereUlid('meeting')->middleware('throttle:30,1')->name('guests.store');
        Route::post('{meeting}/tamu/{participant}/putar', [MeetingGuestController::class, 'rotate'])->whereUlid(['meeting', 'participant'])->middleware('throttle:30,1')->name('guests.rotate');
        Route::delete('{meeting}/tamu/{participant}', [MeetingGuestController::class, 'destroy'])->whereUlid(['meeting', 'participant'])->middleware('throttle:30,1')->name('guests.destroy');
        Route::get('{meeting}/video/ruang-tunggu', [MeetingGuestController::class, 'lobby'])->whereUlid('meeting')->middleware('throttle:api')->name('video.lobby');
        Route::post('{meeting}/video/ruang-tunggu/{participant}/izinkan', [MeetingGuestController::class, 'admit'])->whereUlid(['meeting', 'participant'])->middleware('throttle:api')->name('video.lobby.admit');
        Route::post('{meeting}/video/ruang-tunggu/{participant}/tolak', [MeetingGuestController::class, 'deny'])->whereUlid(['meeting', 'participant'])->middleware('throttle:api')->name('video.lobby.deny');

        Route::post('{meeting}/video/panggil/{target}', [MeetingRoomController::class, 'call'])->whereUlid(['meeting', 'target'])->middleware('throttle:api')->name('video.call');
    });

    Route::get('kalender', CalendarController::class)->name('calendar');
    Route::get('manajemen/jadwal', ManagementScheduleController::class)->name('management.schedule');
});

// Collab server → app: state of the collaborative room minutes (document
// "meeting-minutes.{id}", MinutesCollab). Outside the web group like the
// notes endpoints (no session/CSRF); VerifyCollabSecret checks the secret.
Route::withoutMiddleware('web')
    ->middleware([EnsureFeatureEnabled::class.':meetings', EnsureFeatureEnabled::class.':notes', VerifyCollabSecret::class, 'throttle:600,1'])
    ->prefix('internal/rapat/notulen')
    ->name('meetings.minutes.internal.')
    ->group(function () {
        Route::get('{minutes}/state', [MinutesCollabStateController::class, 'show'])->whereUlid('minutes')->name('state.show');
        Route::post('{minutes}/state', [MinutesCollabStateController::class, 'store'])->whereUlid('minutes')->name('state.store');
    });

// LiveKit → app webhook (attendance): signed with the API key pair instead
// of a session, so no cookies/CSRF/Inertia; rate limited per IP.
Route::post('api/livekit/webhook', LiveKitWebhookController::class)
    ->middleware([LimitRequestBody::class.':'.LiveKitWebhookController::MAX_BODY_BYTES, EnsureFeatureEnabled::class.':meetings', 'throttle:600,1'])
    ->withoutMiddleware([
        EncryptCookies::class,
        AddQueuedCookiesToResponse::class,
        StartSession::class,
        ShareErrorsFromSession::class,
        PreventRequestForgery::class,
        'auth.session',
        AuthenticateSession::class,
        EnsureActiveEmployee::class,
        RestrictKioskDevice::class,
        RestrictCredentialRoutes::class,
        EnsureTwoFactorForSuperAdmin::class,
        HandleAppearance::class,
        HandleInertiaRequests::class,
        AddLinkHeadersForPreloadedAssets::class,
    ])
    ->name('meetings.video.webhook');

// External guests, public side: the personal link page and its JSON endpoints.
// The page keeps the web stack (session, Inertia shell, no `auth`); the JSON
// endpoints answer without cookies / CSRF / Inertia and are throttled per IP
// and per link (AppServiceProvider `guest-*` limiters).
Route::middleware([EnsureFeatureEnabled::class.':meetings'])->group(function () {
    Route::get('tamu/{token}', [GuestPortalController::class, 'page'])
        ->where('token', GuestLinks::PATTERN)
        ->middleware([EnsureFullPageLoad::class, 'throttle:guest-info'])
        ->name('meetings.guest.page');

    Route::prefix('api/tamu/{token}')
        ->where(['token' => GuestLinks::PATTERN])
        ->name('meetings.guest.')
        ->withoutMiddleware([
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            ShareErrorsFromSession::class,
            PreventRequestForgery::class,
            'auth.session',
            AuthenticateSession::class,
            EnsureActiveEmployee::class,
            RestrictKioskDevice::class,
            RestrictCredentialRoutes::class,
            EnsureTwoFactorForSuperAdmin::class,
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ])
        ->group(function () {
            Route::get('info', [GuestPortalController::class, 'info'])->middleware('throttle:guest-info')->name('info');
            Route::post('minta-masuk', [GuestPortalController::class, 'admission'])->middleware('throttle:guest-request')->name('request');
            Route::get('status', [GuestPortalController::class, 'status'])->middleware('throttle:guest-status')->name('status');
            Route::post('token', [GuestPortalController::class, 'token'])->middleware('throttle:guest-token')->name('token');
        });
});
