<?php

use App\Http\Controllers\Meetings\MeetingGuestController;
use App\Http\Middleware\EnsureFeatureEnabled;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| B8 Rapat video: tamu eksternal & ruang tunggu — loaded inside the v1
| auth:sanctum group
|--------------------------------------------------------------------------
|
| Same controller, Actions and MeetingPolicy abilities as the web
| (/rapat/{id}/tamu…, /rapat/{id}/video/ruang-tunggu…), so the JSON is
| identical. Organizer: guest list with copyable links, add, rotate, revoke
| (manageGuests). Anyone invited: waiting room list, admit, deny
| (manageLobby). Removing a guest from the room is the existing
| POST rapat/{id}/video/keluarkan with user_id "guest:{id}". Behind
| `features.meetings` like the rest. Contract: docs/sesi/rapat-tamu-eksternal.md.
*/

Route::middleware(EnsureFeatureEnabled::class.':meetings')->group(function (): void {
    Route::get('rapat/{meeting}/tamu', [MeetingGuestController::class, 'index'])->whereUlid('meeting')->name('meetings.guests.index');
    Route::post('rapat/{meeting}/tamu', [MeetingGuestController::class, 'store'])->whereUlid('meeting')->middleware('throttle:30,1')->name('meetings.guests.store');
    Route::post('rapat/{meeting}/tamu/{participant}/putar', [MeetingGuestController::class, 'rotate'])->whereUlid(['meeting', 'participant'])->middleware('throttle:30,1')->name('meetings.guests.rotate');
    Route::delete('rapat/{meeting}/tamu/{participant}', [MeetingGuestController::class, 'destroy'])->whereUlid(['meeting', 'participant'])->middleware('throttle:30,1')->name('meetings.guests.destroy');

    Route::get('rapat/{meeting}/video/ruang-tunggu', [MeetingGuestController::class, 'lobby'])->whereUlid('meeting')->name('meetings.video.lobby');
    Route::post('rapat/{meeting}/video/ruang-tunggu/{participant}/izinkan', [MeetingGuestController::class, 'admit'])->whereUlid(['meeting', 'participant'])->name('meetings.video.lobby.admit');
    Route::post('rapat/{meeting}/video/ruang-tunggu/{participant}/tolak', [MeetingGuestController::class, 'deny'])->whereUlid(['meeting', 'participant'])->name('meetings.video.lobby.deny');
});
