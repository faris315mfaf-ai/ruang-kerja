<?php

use App\Http\Controllers\Meetings\CalendarController;
use App\Http\Controllers\Meetings\ManagementScheduleController;
use App\Http\Controllers\Meetings\MeetingController;
use App\Http\Controllers\Meetings\MinutesController;
use App\Http\Middleware\EnsureFeatureEnabled;
use Illuminate\Support\Facades\Route;

/*
 * Rapat, notulen & kalender (Fase 2, F2-3; docs/fitur/rapat-kalender.md).
 * Behind FEATURE_MEETINGS (config/features.php): 404 while off.
 * Authorization: MeetingPolicy (invisible meeting → 404), /manajemen/jadwal =
 * Gate viewManagementDashboard. Google Calendar/Meet sync is on hold.
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
        Route::put('{meeting}/notulen', [MinutesController::class, 'save'])->whereUlid('meeting')->middleware('throttle:api')->name('minutes.save');
        Route::post('{meeting}/notulen/final', [MinutesController::class, 'finalize'])->whereUlid('meeting')->name('minutes.finalize');
        Route::post('{meeting}/notulen/buka', [MinutesController::class, 'reopen'])->whereUlid('meeting')->name('minutes.reopen');
        Route::post('{meeting}/notulen/tugas', [MinutesController::class, 'convert'])->whereUlid('meeting')->middleware('throttle:api')->name('minutes.tasks');
        Route::post('{meeting}/notulen/ingatkan', [MinutesController::class, 'remind'])->whereUlid('meeting')->middleware('throttle:api')->name('minutes.remind');

        Route::post('{meeting}/tindak-lanjut', [MinutesController::class, 'storeItem'])->whereUlid('meeting')->middleware('throttle:api')->name('items.store');
        Route::patch('{meeting}/tindak-lanjut/{item}', [MinutesController::class, 'updateItem'])->whereUlid(['meeting', 'item'])->middleware('throttle:api')->name('items.update');
        Route::delete('{meeting}/tindak-lanjut/{item}', [MinutesController::class, 'destroyItem'])->whereUlid(['meeting', 'item'])->name('items.destroy');
    });

    Route::get('kalender', CalendarController::class)->name('calendar');
    Route::get('manajemen/jadwal', ManagementScheduleController::class)->name('management.schedule');
});
