<?php

use App\Http\Controllers\Notes\CollabStateController;
use App\Http\Controllers\Notes\NoteController;
use App\Http\Controllers\Notes\QuickMinutesController;
use App\Http\Controllers\Notes\WorkspaceNotesController;
use App\Http\Middleware\EnsureFeatureEnabled;
use App\Http\Middleware\VerifyCollabSecret;
use Illuminate\Support\Facades\Route;

/*
 * Catatan bersama (Fase 2, F2-2; docs/fitur/catatan.md). Behind FEATURE_NOTES
 * (config/features.php): 404 while off. Authorization: NotePolicy (invisible
 * → 404). The document itself is edited on the collab server (collab/).
 */
Route::middleware([EnsureFeatureEnabled::class.':notes', 'auth', 'verified'])->prefix('catatan')->name('notes.')->group(function () {
    Route::get('/', [NoteController::class, 'index'])->name('index');
    Route::post('/', [NoteController::class, 'store'])->middleware('throttle:60,1')->name('store');

    // Notulensi cepat (keputusan pemilik 6 Okt 2026): start from a dashboard, latest list.
    Route::post('notulensi', [QuickMinutesController::class, 'store'])->middleware('throttle:20,1')->name('minutes.start');
    Route::get('notulensi', [QuickMinutesController::class, 'index'])->middleware('throttle:60,1')->name('minutes.index');

    Route::get('{note}', [NoteController::class, 'show'])->whereUlid('note')->name('show');
    Route::patch('{note}', [NoteController::class, 'update'])->whereUlid('note')->middleware('throttle:120,1')->name('update');
    Route::delete('{note}', [NoteController::class, 'destroy'])->whereUlid('note')->name('destroy');
    Route::patch('{note}/isi', [NoteController::class, 'content'])->whereUlid('note')->middleware('throttle:120,1')->name('content');
    Route::put('{note}/akses', [NoteController::class, 'share'])->whereUlid('note')->middleware('throttle:30,1')->name('share');
    Route::post('{note}/versi/{version}/pulihkan', [NoteController::class, 'restore'])->whereUlid(['note', 'version'])->middleware('throttle:30,1')->name('versions.restore');
    Route::get('{note}/token', [NoteController::class, 'token'])->whereUlid('note')->middleware('throttle:60,1')->name('token');
});

// Tab "Catatan" of a workspace (binding `workspace` from routes/workspaces.php).
Route::middleware([EnsureFeatureEnabled::class.':notes', 'auth', 'verified'])
    ->get('w/{workspace}/catatan', [WorkspaceNotesController::class, 'show'])
    ->name('workspaces.notes');

/*
 * Collab server → Laravel (state load/store). Outside the `web` group: no
 * session, cookies or CSRF; VerifyCollabSecret checks the shared secret.
 */
Route::withoutMiddleware('web')
    ->middleware([EnsureFeatureEnabled::class.':notes', VerifyCollabSecret::class, 'throttle:600,1'])
    ->prefix('internal/catatan')
    ->name('notes.internal.')
    ->group(function () {
        Route::get('{note}/state', [CollabStateController::class, 'show'])->whereUlid('note')->name('state.show');
        Route::post('{note}/state', [CollabStateController::class, 'store'])->whereUlid('note')->name('state.store');
    });
