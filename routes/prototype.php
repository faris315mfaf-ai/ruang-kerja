<?php

use App\Domain\Documentation\Services\PrototypeGuideLinks;
use App\Http\Controllers\Prototype\PrototypeGuideController;
use App\Http\Middleware\EnsureFeatureEnabled;
use Illuminate\Support\Facades\Route;

/*
 * Fase 2 & 3 front-end previews (config/features.php `prototype`). Every page
 * renders sample data from resources/js/features/<module>/fixtures.ts and
 * stores nothing, so the routes only need a signed-in employee. When the
 * backend lands, swap Route::inertia for a controller that passes the same
 * props shape (resources/js/features/<module>/types.ts). Flag off = 404.
 */
Route::middleware([EnsureFeatureEnabled::class.':prototype', 'auth', 'verified'])->name('prototype.')->group(function () {
    Route::inertia('pratinjau', 'prototype/hub')->name('hub');

    // Panduan pratinjau: docs/fitur/PANDUAN-PRATINJAU.md + module docs of
    // docs/fitur (config/docs.php group `features`) and their screenshots.
    Route::get('pratinjau/panduan', [PrototypeGuideController::class, 'index'])->name('guide');
    Route::get('pratinjau/panduan/gambar/{folder}/{file}', [PrototypeGuideController::class, 'image'])
        ->where(['folder' => PrototypeGuideLinks::FOLDER_PATTERN, 'file' => PrototypeGuideLinks::FILE_PATTERN])
        ->name('guide.image');
    Route::get('pratinjau/panduan/{slug}', [PrototypeGuideController::class, 'show'])
        ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*')->name('guide.show');

    // F2-1 · Obrolan has its own backend now: routes/chat.php (FEATURE_CHAT).

    // F2-2 · Realtime notes
    Route::inertia('catatan', 'notes/index')->name('notes.index');
    Route::get('catatan/{note}', fn (string $note) => inertia('notes/show', ['noteId' => $note]))
        ->where('note', '[a-z0-9-]+')->name('notes.show');

    // F2-3 · Meetings, minutes & calendar
    Route::inertia('rapat', 'meetings/index')->name('meetings.index');
    Route::inertia('rapat/baru', 'meetings/create')->name('meetings.create');
    Route::get('rapat/{meeting}', fn (string $meeting) => inertia('meetings/show', ['meetingId' => $meeting]))
        ->where('meeting', '[a-z0-9-]+')->name('meetings.show');
    Route::get('rapat/{meeting}/notulen', fn (string $meeting) => inertia('meetings/minutes', ['meetingId' => $meeting]))
        ->where('meeting', '[a-z0-9-]+')->name('meetings.minutes');
    Route::inertia('kalender', 'meetings/calendar')->name('calendar');
    Route::inertia('manajemen/jadwal', 'meetings/management-schedule')->name('management.schedule');

    // F2-4 · WhatsApp stays a preview (held by the owner until the provider is
    // chosen). Otomasi, berulang, template and Kinerja saya: routes/automation.php.
    Route::inertia('pengaturan/whatsapp', 'automation/whatsapp')->name('whatsapp');

    // F3-1, F3-2 · Mobile app: biometrics, face check-in, integrity, offline
    Route::inertia('pratinjau/ponsel', 'mobile-app/index')->name('mobile.index');
    Route::inertia('pratinjau/ponsel/masuk', 'mobile-app/biometric-login')->name('mobile.login');
    Route::inertia('pratinjau/ponsel/integritas', 'mobile-app/integrity')->name('mobile.integrity');
    Route::inertia('pratinjau/ponsel/offline', 'mobile-app/offline')->name('mobile.offline');
    Route::inertia('pratinjau/ponsel/widget', 'mobile-app/widget')->name('mobile.widget');
    Route::inertia('pratinjau/ponsel/kunci', 'mobile-app/lock-screen')->name('mobile.lock');
    Route::inertia('pratinjau/ponsel/aksi-cepat', 'mobile-app/quick-add')->name('mobile.quick-add');
    Route::inertia('absensi/wajah', 'mobile-app/face-check-in')->name('mobile.face');
    Route::inertia('pengaturan/perangkat', 'mobile-app/devices')->name('mobile.devices');

    // F3-3 · fingerprint devices. OKR (routes/okr.php) and Dashboard per jabatan (routes/roles.php) have real backends.
    Route::inertia('admin/mesin-absensi', 'okr/fingerprint-devices')->name('fingerprint');
});
