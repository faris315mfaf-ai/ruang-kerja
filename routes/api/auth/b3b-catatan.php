<?php

use App\Http\Controllers\Api\Notes\NoteAccessController;
use App\Http\Controllers\Api\Notes\NoteDiscoveryController;
use App\Http\Controllers\Api\Notes\NoteStructureController;
use App\Http\Controllers\Api\Notes\NoteVersionController;
use App\Http\Controllers\Api\Notes\QuickMinutesController;
use App\Http\Middleware\EnsureFeatureEnabled;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| B3-B Catatan & notulensi (Bagian 3) — loaded inside the v1 auth:sanctum group
|--------------------------------------------------------------------------
|
| Tree, tabs, quick minutes, sharing, versions, search and "@" picker of the
| Android notes screens. Thin controllers over the web Actions/Policies; all
| behind `features.notes` (404 while off, like the web). Contract:
| docs/sesi/ponsel-b3b-catatan.md. Existing note routes stay in api.php.
*/

Route::middleware(EnsureFeatureEnabled::class.':notes')->group(function (): void {
    // Tree: create note/folder/tab (parent_id), move/reorder, delete.
    Route::post('catatan', [NoteStructureController::class, 'store'])
        ->middleware('throttle:60,1')->name('notes.create');
    Route::patch('catatan/{note}/pindah', [NoteStructureController::class, 'move'])
        ->whereUlid('note')->middleware('throttle:120,1')->name('notes.move');
    Route::delete('catatan/{note}', [NoteStructureController::class, 'destroy'])
        ->whereUlid('note')->name('notes.destroy');
    Route::get('catatan/{note}/tab', [NoteStructureController::class, 'tabs'])
        ->whereUlid('note')->name('notes.tabs');

    // Notulensi cepat.
    Route::post('catatan/notulensi', [QuickMinutesController::class, 'start'])
        ->middleware('throttle:20,1')->name('notes.minutes.start');
    Route::get('catatan/notulensi/terakhir', [QuickMinutesController::class, 'recent'])
        ->middleware('throttle:60,1')->name('notes.minutes.recent');
    Route::get('catatan/notulensi', [QuickMinutesController::class, 'recent'])
        ->middleware('throttle:60,1')->name('notes.minutes.index');

    // Search and "@" picker.
    Route::get('catatan/cari', [NoteDiscoveryController::class, 'search'])
        ->middleware('throttle:60,1')->name('notes.search');
    Route::get('catatan/{note}/mention', [NoteDiscoveryController::class, 'mentions'])
        ->whereUlid('note')->middleware('throttle:120,1')->name('notes.mentions');

    // Sharing.
    Route::get('catatan/{note}/akses', [NoteAccessController::class, 'show'])
        ->whereUlid('note')->name('notes.access.show');
    Route::put('catatan/{note}/akses', [NoteAccessController::class, 'update'])
        ->whereUlid('note')->middleware('throttle:30,1')->name('notes.access.update');
    Route::delete('catatan/{note}/akses/{person}', [NoteAccessController::class, 'destroy'])
        ->whereUlid(['note', 'person'])->middleware('throttle:30,1')->name('notes.access.destroy');

    // Versions.
    Route::get('catatan/{note}/versi', [NoteVersionController::class, 'index'])
        ->whereUlid('note')->name('notes.versions.index');
    Route::get('catatan/{note}/versi/{version}', [NoteVersionController::class, 'show'])
        ->whereUlid(['note', 'version'])->name('notes.versions.show');
    Route::post('catatan/{note}/versi/{version}/pulihkan', [NoteVersionController::class, 'restore'])
        ->whereUlid(['note', 'version'])->middleware('throttle:30,1')->name('notes.versions.restore');
});
