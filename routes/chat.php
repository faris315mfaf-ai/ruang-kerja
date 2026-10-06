<?php

use App\Http\Controllers\Chat\ChannelController;
use App\Http\Controllers\Chat\ChatController;
use App\Http\Controllers\Chat\MessageController;
use App\Http\Middleware\EnsureFeatureEnabled;
use Illuminate\Support\Facades\Route;

/*
 * Obrolan (Fase 2, F2-1; docs/fitur/obrolan.md). Behind FEATURE_CHAT
 * (config/features.php): 404 while off. Authorization: ChannelPolicy /
 * MessagePolicy (invisible → 404), realtime on private `chat.{channel}`.
 */
Route::middleware([EnsureFeatureEnabled::class.':chat', 'auth', 'verified'])->prefix('obrolan')->name('chat.')->group(function () {
    Route::get('/', [ChatController::class, 'index'])->name('index');
    Route::post('/', [ChannelController::class, 'store'])->middleware('throttle:messages')->name('channels.store');
    Route::post('langsung', [ChannelController::class, 'direct'])->middleware('throttle:messages')->name('channels.direct');
    Route::get('rujukan/tugas', [ChannelController::class, 'tasks'])->middleware('throttle:search')->name('references.tasks');

    Route::get('pesan/{message}', [MessageController::class, 'show'])->withTrashed()->whereUlid('message')->name('messages.show');
    Route::patch('pesan/{message}', [MessageController::class, 'update'])->whereUlid('message')->middleware('throttle:messages')->name('messages.update');
    Route::delete('pesan/{message}', [MessageController::class, 'destroy'])->whereUlid('message')->name('messages.destroy');
    Route::post('pesan/{message}/reaksi', [MessageController::class, 'react'])->whereUlid('message')->middleware('throttle:messages')->name('messages.react');

    Route::get('{channel}', [ChatController::class, 'show'])->whereUlid('channel')->name('show');
    Route::get('{channel}/pesan', [MessageController::class, 'index'])->whereUlid('channel')->name('messages.index');
    Route::post('{channel}/pesan', [MessageController::class, 'store'])->whereUlid('channel')->middleware('throttle:messages')->name('messages.store');
    Route::post('{channel}/dibaca', [ChannelController::class, 'read'])->whereUlid('channel')->name('channels.read');
    Route::put('{channel}/bisu', [ChannelController::class, 'mute'])->whereUlid('channel')->name('channels.mute');
    Route::get('{channel}/file-drive', [ChannelController::class, 'files'])->whereUlid('channel')->name('channels.files');
});
