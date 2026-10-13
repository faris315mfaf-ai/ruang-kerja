<?php

use App\Http\Controllers\Api\Chat\ChannelController;
use App\Http\Controllers\Api\Chat\ChannelReadController;
use App\Http\Controllers\Api\Chat\ConversationController;
use App\Http\Controllers\Api\Chat\MessageController;
use App\Http\Controllers\Api\Chat\ReactionController;
use App\Http\Middleware\EnsureFeatureEnabled;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Bagian 3 · B3-C Obrolan (API v1, token Sanctum, prefiks /api/v1 + nama api.v1.)
|--------------------------------------------------------------------------
|
| Di balik flag features.chat (404 saat mati, seperti web). Rute lama
| `obrolan/kanal*` tetap di routes/api.php; berkas ini menambah jalur
| `obrolan/{channel}/…` (dengan alias untuk daftar, linimasa, kirim, dibaca)
| dan semua fitur tulis/telusur. Kontrak: docs/sesi/ponsel-b3c-obrolan.md.
*/

Route::middleware(EnsureFeatureEnabled::class.':chat')->prefix('obrolan')->name('chat.')->group(function (): void {
    // Daftar & jelajah (literal sebelum {channel}).
    Route::get('/', ChannelController::class)->name('index');
    Route::post('/', [ConversationController::class, 'store'])->middleware('throttle:messages')->name('store');
    Route::get('kanal-publik', [ConversationController::class, 'publicChannels'])->name('public');
    Route::get('rujukan/tugas', [ConversationController::class, 'taskReferences'])->middleware('throttle:search')->name('references.tasks');

    Route::prefix('{channel}')->whereUlid('channel')->scopeBindings()->group(function (): void {
        // Detail, anggota, gabung, bisu, status baca.
        Route::get('/', [ConversationController::class, 'show'])->name('show');
        Route::get('anggota', [ConversationController::class, 'members'])->name('members');
        Route::post('gabung', [ConversationController::class, 'join'])->middleware('throttle:messages')->name('join');
        Route::patch('bisu', [ConversationController::class, 'mute'])->middleware('throttle:messages')->name('mute');
        Route::get('dibaca-oleh/{message}', [ConversationController::class, 'readBy'])->whereUlid('message')->name('read-by');
        Route::get('file-drive', [ConversationController::class, 'driveFiles'])->name('drive-files');

        // Linimasa (alias jalur `obrolan/kanal/{channel}/…`), kirim, dibaca.
        Route::get('pesan', [MessageController::class, 'index'])->name('timeline');
        Route::post('pesan', [MessageController::class, 'store'])->middleware('throttle:messages')->name('send');
        Route::post('dibaca', ChannelReadController::class)->name('read');
        Route::get('cari', [MessageController::class, 'search'])->middleware('throttle:search')->name('search');

        // Satu pesan: thread, sunting, hapus, reaksi.
        Route::get('pesan/{message}/balasan', [MessageController::class, 'replies'])->whereUlid('message')->name('replies');
        Route::patch('pesan/{message}', [MessageController::class, 'update'])->whereUlid('message')->middleware('throttle:messages')->name('update');
        Route::delete('pesan/{message}', [MessageController::class, 'destroy'])->whereUlid('message')->name('destroy');
        Route::post('pesan/{message}/reaksi', [ReactionController::class, 'store'])->whereUlid('message')->middleware('throttle:messages')->name('react');
        Route::delete('pesan/{message}/reaksi', [ReactionController::class, 'destroy'])->whereUlid('message')->middleware('throttle:messages')->name('unreact');
    });
});
