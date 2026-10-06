<?php

use App\Http\Controllers\Okr\KeyResultController;
use App\Http\Controllers\Okr\KeyResultTaskController;
use App\Http\Controllers\Okr\OkrController;
use App\Http\Middleware\EnsureFeatureEnabled;
use Illuminate\Support\Facades\Route;

/*
 * OKR divisi (Fase 3, F3-3; docs/fitur/okr.md). Behind FEATURE_OKR
 * (config/features.php): 404 while off. Authorization: ObjectivePolicy /
 * KeyResultPolicy (invisible → 404).
 */
Route::middleware([EnsureFeatureEnabled::class.':okr', 'auth', 'verified'])->prefix('okr')->name('okr.')->group(function () {
    Route::get('/', [OkrController::class, 'index'])->name('index');
    Route::post('/', [OkrController::class, 'store'])->name('store');

    Route::patch('kr/{keyResult}', [KeyResultController::class, 'update'])->whereUlid('keyResult')->name('key-results.update');
    Route::delete('kr/{keyResult}', [KeyResultController::class, 'destroy'])->whereUlid('keyResult')->name('key-results.destroy');
    Route::post('kr/{keyResult}/check-in', [KeyResultController::class, 'checkin'])->whereUlid('keyResult')->name('key-results.checkin');
    Route::get('kr/{keyResult}/tugas', [KeyResultTaskController::class, 'index'])->whereUlid('keyResult')->middleware('throttle:search')->name('key-results.tasks.index');
    Route::post('kr/{keyResult}/tugas', [KeyResultTaskController::class, 'store'])->whereUlid('keyResult')->name('key-results.tasks.store');
    Route::delete('kr/{keyResult}/tugas/{task}', [KeyResultTaskController::class, 'destroy'])->whereUlid(['keyResult', 'task'])->name('key-results.tasks.destroy');

    Route::get('{objective}', [OkrController::class, 'show'])->whereUlid('objective')->name('show');
    Route::patch('{objective}', [OkrController::class, 'update'])->whereUlid('objective')->name('update');
    Route::post('{objective}/tutup', [OkrController::class, 'close'])->whereUlid('objective')->name('close');
    Route::post('{objective}/kr', [KeyResultController::class, 'store'])->whereUlid('objective')->name('key-results.store');
});
