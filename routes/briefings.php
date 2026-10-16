<?php

use App\Http\Controllers\Briefings\BriefingController;
use Illuminate\Support\Facades\Route;

/*
 * Briefing pagi & sore (keputusan pemilik 9 Okt 2026): catatan notulensi
 * harian oleh HR / Super Admin (atau delegasinya). Jendela catat:
 * pagi 08.00–11.00, sore 16.00–18.00 waktu kantor. Kartu "Catat briefing"
 * dimuat lewat props dashboard (BriefingWindow); authorization:
 * BriefingPolicy + SaveBriefing (jendela & delegasi).
 */
Route::middleware(['auth', 'verified'])->group(function () {
    Route::post('briefing', [BriefingController::class, 'store'])->middleware('throttle:20,1')->name('briefings.store');
    Route::post('briefing/delegasi', [BriefingController::class, 'delegate'])->middleware('throttle:20,1')->name('briefings.delegate');
});
