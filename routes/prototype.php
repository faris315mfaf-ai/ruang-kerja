<?php

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

    // F2-1 · Obrolan has its own backend now: routes/chat.php (FEATURE_CHAT).

    // F2-2 · Realtime notes
    Route::inertia('catatan', 'notes/index')->name('notes.index');
    Route::get('catatan/{note}', fn (string $note) => inertia('notes/show', ['noteId' => $note]))
        ->where('note', '[a-z0-9-]+')->name('notes.show');

    // F2-3 · Rapat & kalender has its own backend now: routes/meetings.php (FEATURE_MEETINGS).

    // F2-4 · WhatsApp, automation, recurring tasks, templates (+ Kinerja saya)
    Route::inertia('pengaturan/whatsapp', 'automation/whatsapp')->name('whatsapp');
    Route::inertia('otomasi', 'automation/rules')->name('automation.rules');
    Route::inertia('otomasi/berulang', 'automation/recurring')->name('automation.recurring');
    Route::inertia('otomasi/template', 'automation/templates')->name('automation.templates');
    Route::inertia('kinerja', 'automation/performance')->name('performance');

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

    // F3-3 · OKR, fingerprint devices, role dashboards (SPKD)
    Route::inertia('okr', 'okr/index')->name('okr.index');
    Route::get('okr/{objective}', fn (string $objective) => inertia('okr/show', ['objectiveId' => $objective]))
        ->where('objective', '[a-z0-9-]+')->name('okr.show');
    Route::inertia('admin/mesin-absensi', 'okr/fingerprint-devices')->name('fingerprint');
    Route::get('peran/{role}', fn (string $role) => inertia('okr/role-dashboard', ['role' => $role]))
        ->whereIn('role', ['dirut', 'direktur', 'hr', 'corsec', 'marketing', 'programming', 'implementer', 'analis'])
        ->name('roles.show');
});
