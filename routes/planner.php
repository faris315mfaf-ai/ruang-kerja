<?php

use App\Http\Controllers\Dashboard\PlannerController;
use Illuminate\Support\Facades\Route;

/*
 * "Ruang saya" on Beranda (personal planner, JSON). Plans are private to
 * the signed-in user (TaskPlanPolicy); tasks go through TaskPolicy::plan.
 */
Route::middleware(['auth', 'verified'])->prefix('ruang-saya')->name('planner.')->group(function () {
    Route::get('/', [PlannerController::class, 'show'])->name('show');
    Route::post('catatan', [PlannerController::class, 'store'])->middleware('throttle:30,1')->name('store');
    Route::put('tugas/{task}', [PlannerController::class, 'plan'])->whereUlid('task')->name('plan');
    Route::delete('tugas/{task}', [PlannerController::class, 'unplan'])->whereUlid('task')->name('unplan');
    Route::post('tugas/{task}/selesai', [PlannerController::class, 'complete'])->whereUlid('task')->name('complete');
});
