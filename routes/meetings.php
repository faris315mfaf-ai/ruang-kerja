<?php

use App\Http\Controllers\Meetings\CalendarController;
use App\Http\Controllers\Meetings\LiveKitWebhookController;
use App\Http\Controllers\Meetings\ManagementScheduleController;
use App\Http\Controllers\Meetings\MeetingController;
use App\Http\Controllers\Meetings\MeetingRoomController;
use App\Http\Controllers\Meetings\MeetingVideoController;
use App\Http\Controllers\Meetings\MinutesController;
use App\Http\Middleware\AuthenticateSession;
use App\Http\Middleware\EnsureActiveEmployee;
use App\Http\Middleware\EnsureFeatureEnabled;
use App\Http\Middleware\EnsureTwoFactorForSuperAdmin;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
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
 * Rapat, notulen & kalender (Fase 2, F2-3; docs/fitur/rapat-kalender.md).
 * Behind FEATURE_MEETINGS (config/features.php): 404 while off.
 * Authorization: MeetingPolicy (invisible meeting → 404), /manajemen/jadwal =
 * Gate viewManagementDashboard. Google Calendar/Meet sync is on hold.
 * Video RuangKerja (LiveKit, §6a): /gabung (pre-join), /ruang (room), token,
 * moderation, the "Notulen Hidup" room endpoints (notes source, speaking
 * time, attendance, call; docs/fitur/rapat-video-kontrak.md) and the signed
 * LiveKit webhook (no session/CSRF).
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
        Route::delete('{meeting}', [MeetingController::class, 'destroy'])->whereUlid('meeting')->name('cancel');
        Route::post('{meeting}/kehadiran', [MeetingController::class, 'rsvp'])->whereUlid('meeting')->middleware('throttle:api')->name('rsvp');

        Route::get('{meeting}/notulen', [MinutesController::class, 'show'])->whereUlid('meeting')->name('minutes.show');
        Route::get('{meeting}/notulen/data', [MinutesController::class, 'data'])->whereUlid('meeting')->middleware('throttle:api')->name('minutes.data');
        Route::put('{meeting}/notulen', [MinutesController::class, 'save'])->whereUlid('meeting')->middleware('throttle:api')->name('minutes.save');
        Route::post('{meeting}/notulen/final', [MinutesController::class, 'finalize'])->whereUlid('meeting')->name('minutes.finalize');
        Route::post('{meeting}/notulen/buka', [MinutesController::class, 'reopen'])->whereUlid('meeting')->name('minutes.reopen');
        Route::post('{meeting}/notulen/tugas', [MinutesController::class, 'convert'])->whereUlid('meeting')->middleware('throttle:api')->name('minutes.tasks');
        Route::post('{meeting}/notulen/ingatkan', [MinutesController::class, 'remind'])->whereUlid('meeting')->middleware('throttle:api')->name('minutes.remind');

        Route::post('{meeting}/tindak-lanjut', [MinutesController::class, 'storeItem'])->whereUlid('meeting')->middleware('throttle:api')->name('items.store');
        Route::patch('{meeting}/tindak-lanjut/{item}', [MinutesController::class, 'updateItem'])->whereUlid(['meeting', 'item'])->middleware('throttle:api')->name('items.update');
        Route::delete('{meeting}/tindak-lanjut/{item}', [MinutesController::class, 'destroyItem'])->whereUlid(['meeting', 'item'])->name('items.destroy');

        Route::get('{meeting}/gabung', [MeetingVideoController::class, 'join'])->whereUlid('meeting')->name('video.join');
        Route::get('{meeting}/ruang', [MeetingVideoController::class, 'room'])->whereUlid('meeting')->name('video.room');
        Route::post('{meeting}/video/token', [MeetingVideoController::class, 'token'])->whereUlid('meeting')->middleware('throttle:30,1')->name('video.token');
        Route::post('{meeting}/video/peserta/{identity}/bisukan', [MeetingVideoController::class, 'mute'])->whereUlid(['meeting', 'identity'])->middleware('throttle:api')->name('video.mute');
        Route::delete('{meeting}/video/peserta/{identity}', [MeetingVideoController::class, 'remove'])->whereUlid(['meeting', 'identity'])->middleware('throttle:api')->name('video.remove');

        // Ruang "Notulen Hidup" (docs/fitur/rapat-video-kontrak.md): notes source, speaking time, Kehadiran, Panggil.
        Route::post('{meeting}/video/sumber-notulen', [MeetingRoomController::class, 'notesSource'])->whereUlid('meeting')->middleware('throttle:api')->name('video.notes-source');
        Route::get('{meeting}/video/bicara', [MeetingRoomController::class, 'speaking'])->whereUlid('meeting')->middleware('throttle:api')->name('video.speaking');
        Route::post('{meeting}/video/bicara', [MeetingRoomController::class, 'reportSpeaking'])->whereUlid('meeting')->middleware('throttle:20,1')->name('video.speaking.report');
        Route::get('{meeting}/video/kehadiran', [MeetingRoomController::class, 'attendance'])->whereUlid('meeting')->middleware('throttle:api')->name('video.attendance');
        Route::post('{meeting}/video/panggil/{target}', [MeetingRoomController::class, 'call'])->whereUlid(['meeting', 'target'])->middleware('throttle:api')->name('video.call');
    });

    Route::get('kalender', CalendarController::class)->name('calendar');
    Route::get('manajemen/jadwal', ManagementScheduleController::class)->name('management.schedule');
});

// LiveKit → app webhook (attendance): signed with the API key pair instead
// of a session, so no cookies/CSRF/Inertia; rate limited per IP.
Route::post('api/livekit/webhook', LiveKitWebhookController::class)
    ->middleware([EnsureFeatureEnabled::class.':meetings', 'throttle:600,1'])
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
