<?php

use App\Http\Controllers\Notifications\InboxController;
use App\Http\Controllers\Notifications\InboxNotificationController;
use App\Http\Controllers\Notifications\NotificationFeedController;
use App\Http\Controllers\Notifications\NotificationSettingsController;
use App\Http\Controllers\Notifications\TestNotificationController;
use App\Http\Controllers\Search\SearchController;
use Illuminate\Support\Facades\Route;

/*
| Sprint 8 — Inbox, notification settings and global search
| (command palette ⌘K + mobile /cari).
*/

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('inbox', [InboxController::class, 'index'])->name('inbox');
    Route::get('inbox/feed', NotificationFeedController::class)->middleware('throttle:60,1')->name('inbox.feed');
    Route::post('inbox/read-all', [InboxNotificationController::class, 'readAll'])->name('inbox.read-all');

    Route::prefix('inbox/{notification}')
        ->whereUuid('notification')
        ->name('inbox.')
        ->controller(InboxNotificationController::class)
        ->group(function () {
            Route::get('open', 'open')->name('open');
            Route::post('read', 'read')->name('read');
            Route::delete('read', 'unread')->name('unread');
            Route::post('archive', 'archive')->name('archive');
            Route::delete('archive', 'unarchive')->name('unarchive');
        });

    Route::controller(NotificationSettingsController::class)->group(function () {
        Route::get('pengaturan/notifikasi', 'edit')->name('settings.notifications');
        Route::patch('pengaturan/notifikasi', 'update')->name('settings.notifications.update');
        Route::patch('pengaturan/notifikasi/preferensi', 'preference')->name('settings.notifications.preference');
        Route::get('pengaturan/notifikasi/pratinjau-ringkasan', 'digestPreview')->name('settings.notifications.digest-preview');
    });

    Route::post('pengaturan/notifikasi/uji', [TestNotificationController::class, 'store'])
        ->middleware('throttle:5,1')
        ->name('settings.notifications.test');
});

Route::middleware(['auth', 'verified'])->controller(SearchController::class)->group(function () {
    Route::get('cari', 'index')->name('search');
    Route::get('cari/hasil', 'results')->middleware('throttle:120,1')->name('search.results');
});
