<?php

use App\Http\Controllers\Api\Meetings\ActionItemController;
use App\Http\Controllers\Api\Meetings\AutoMinutesController;
use App\Http\Controllers\Api\Meetings\ManagementScheduleController;
use App\Http\Controllers\Api\Meetings\MeetingWriteController;
use App\Http\Controllers\Api\Meetings\MinutesWriteController;
use App\Http\Controllers\Api\Meetings\VideoRoomController;
use App\Http\Middleware\EnsureFeatureEnabled;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| B4-B Rapat, kalender, notulen & video (Bagian 4) — loaded inside the v1
| auth:sanctum group
|--------------------------------------------------------------------------
|
| Schedule / edit / cancel meetings, write minutes (versions, notes source),
| follow-ups, the built-in video room (LiveKit token, moderation, raised
| hand, speaking time, attendance, call), automatic minutes and the
| management schedule. Thin controllers over the web Actions, Policies and
| FormRequests; all behind `features.meetings` (404 while off, like the
| web). Contract: docs/sesi/ponsel-b4b-rapat.md. The read endpoints of
| Tahap 2 (agenda, detail, RSVP, minutes, calendar) stay in api.php.
*/

Route::middleware(EnsureFeatureEnabled::class.':meetings')->group(function (): void {
    // Form data, people picker, conflict check, create / edit / cancel.
    Route::get('rapat/formulir', [MeetingWriteController::class, 'form'])->name('meetings.form');
    Route::get('rapat/peserta', [MeetingWriteController::class, 'people'])->name('meetings.people');
    Route::get('rapat/bentrok', [MeetingWriteController::class, 'conflicts'])->name('meetings.conflicts');
    Route::post('rapat', [MeetingWriteController::class, 'store'])->middleware('throttle:30,1')->name('meetings.store');
    Route::patch('rapat/{meeting}', [MeetingWriteController::class, 'update'])->whereUlid('meeting')->middleware('throttle:30,1')->name('meetings.update');
    Route::post('rapat/{meeting}/batal', [MeetingWriteController::class, 'cancel'])->whereUlid('meeting')->middleware('throttle:30,1')->name('meetings.cancel');
    Route::delete('rapat/{meeting}', [MeetingWriteController::class, 'cancel'])->whereUlid('meeting')->middleware('throttle:30,1')->name('meetings.destroy');

    // Minutes: save, finalize, reopen, versions, editing hint, notes source.
    Route::put('rapat/{meeting}/notulen', [MinutesWriteController::class, 'save'])->whereUlid('meeting')->name('meetings.minutes.save');
    Route::post('rapat/{meeting}/notulen/final', [MinutesWriteController::class, 'finalize'])->whereUlid('meeting')->name('meetings.minutes.finalize');
    Route::post('rapat/{meeting}/notulen/buka', [MinutesWriteController::class, 'reopen'])->whereUlid('meeting')->name('meetings.minutes.reopen');
    Route::get('rapat/{meeting}/notulen/versi', [MinutesWriteController::class, 'versions'])->whereUlid('meeting')->name('meetings.minutes.versions');
    Route::get('rapat/{meeting}/notulen/versi/{version}', [MinutesWriteController::class, 'version'])->whereUlid(['meeting', 'version'])->name('meetings.minutes.version');
    Route::post('rapat/{meeting}/notulen/menyunting', [MinutesWriteController::class, 'editing'])->whereUlid('meeting')->name('meetings.minutes.editing');
    Route::post('rapat/{meeting}/sumber-notulen', [MinutesWriteController::class, 'source'])->whereUlid('meeting')->name('meetings.minutes.source');

    // Follow-ups.
    Route::get('rapat/{meeting}/tindak-lanjut', [ActionItemController::class, 'index'])->whereUlid('meeting')->name('meetings.items.index');
    Route::post('rapat/{meeting}/tindak-lanjut', [ActionItemController::class, 'store'])->whereUlid('meeting')->name('meetings.items.store');
    Route::post('rapat/{meeting}/tindak-lanjut/jadikan-semua', [ActionItemController::class, 'convertMany'])->whereUlid('meeting')->name('meetings.items.convert-many');
    Route::post('rapat/{meeting}/tindak-lanjut/ingatkan', [ActionItemController::class, 'remind'])->whereUlid('meeting')->name('meetings.items.remind');
    Route::patch('rapat/{meeting}/tindak-lanjut/{item}', [ActionItemController::class, 'update'])->whereUlid(['meeting', 'item'])->name('meetings.items.update');
    Route::delete('rapat/{meeting}/tindak-lanjut/{item}', [ActionItemController::class, 'destroy'])->whereUlid(['meeting', 'item'])->name('meetings.items.destroy');
    Route::post('rapat/{meeting}/tindak-lanjut/{item}/jadikan-tugas', [ActionItemController::class, 'convert'])->whereUlid(['meeting', 'item'])->name('meetings.items.convert');

    // Video RuangKerja (LiveKit).
    Route::get('rapat/{meeting}/video/ruang', [VideoRoomController::class, 'room'])->whereUlid('meeting')->name('meetings.video.room');
    Route::post('rapat/{meeting}/video/token', [VideoRoomController::class, 'token'])->whereUlid('meeting')->middleware('throttle:30,1')->name('meetings.video.token');
    Route::post('rapat/{meeting}/video/bisukan', [VideoRoomController::class, 'mute'])->whereUlid('meeting')->name('meetings.video.mute');
    Route::post('rapat/{meeting}/video/keluarkan', [VideoRoomController::class, 'remove'])->whereUlid('meeting')->name('meetings.video.remove');
    Route::post('rapat/{meeting}/video/izinkan-masuk', [VideoRoomController::class, 'readmit'])->whereUlid('meeting')->name('meetings.video.readmit');
    Route::post('rapat/{meeting}/video/tangan', [VideoRoomController::class, 'hand'])->whereUlid('meeting')->middleware('throttle:30,1')->name('meetings.video.hand');
    Route::post('rapat/{meeting}/video/atribut', [VideoRoomController::class, 'attributes'])->whereUlid('meeting')->middleware('throttle:60,1')->name('meetings.video.attributes');
    Route::get('rapat/{meeting}/video/waktu-bicara', [VideoRoomController::class, 'speaking'])->whereUlid('meeting')->name('meetings.video.speaking');
    Route::post('rapat/{meeting}/video/waktu-bicara', [VideoRoomController::class, 'reportSpeaking'])->whereUlid('meeting')->middleware('throttle:20,1')->name('meetings.video.speaking.report');
    Route::get('rapat/{meeting}/video/kehadiran', [VideoRoomController::class, 'attendance'])->whereUlid('meeting')->name('meetings.video.attendance');
    Route::post('rapat/{meeting}/video/panggil/{target}', [VideoRoomController::class, 'call'])->whereUlid(['meeting', 'target'])->name('meetings.video.call');

    // Notulen otomatis (transcript + AI draft).
    Route::get('rapat/{meeting}/notulen-otomatis', [AutoMinutesController::class, 'status'])->whereUlid('meeting')->name('meetings.auto-minutes.status');
    Route::patch('rapat/{meeting}/notulen-otomatis', [AutoMinutesController::class, 'settings'])->whereUlid('meeting')->name('meetings.auto-minutes.settings');
    Route::get('rapat/{meeting}/transkrip', [AutoMinutesController::class, 'transcript'])->whereUlid('meeting')->name('meetings.transcript.show');
    Route::put('rapat/{meeting}/transkrip/persetujuan', [AutoMinutesController::class, 'consent'])->whereUlid('meeting')->name('meetings.transcript.consent');
    Route::post('rapat/{meeting}/transkrip/masukkan', [AutoMinutesController::class, 'insert'])->whereUlid('meeting')->name('meetings.transcript.insert');
    Route::post('rapat/{meeting}/transkrip/buang', [AutoMinutesController::class, 'discard'])->whereUlid('meeting')->name('meetings.transcript.discard');
    Route::post('rapat/{meeting}/transkrip/ringkas-ulang', [AutoMinutesController::class, 'resummarize'])->whereUlid('meeting')->middleware('throttle:10,1')->name('meetings.transcript.resummarize');
    Route::post('rapat/{meeting}/transkrip/tindak-lanjut/{suggestion}/tugas', [AutoMinutesController::class, 'task'])
        ->whereUlid('meeting')->where('suggestion', 'tl-[0-9]{1,3}')->name('meetings.transcript.task');

    // Jadwal manajemen (leadership meetings, read-only).
    Route::get('manajemen/jadwal', ManagementScheduleController::class)->name('meetings.management-schedule');
});
