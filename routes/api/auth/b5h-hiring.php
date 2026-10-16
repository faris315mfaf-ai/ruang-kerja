<?php

use App\Http\Controllers\Api\Hiring\CandidateController;
use App\Http\Controllers\Api\Hiring\ChecklistController;
use App\Http\Controllers\Api\Hiring\DecisionController;
use App\Http\Controllers\Api\Hiring\HiringAccessController;
use App\Http\Controllers\Api\Hiring\InterviewController;
use App\Http\Controllers\Api\Hiring\NoteController;
use App\Http\Controllers\Api\Hiring\PositionController;
use App\Http\Controllers\Api\Hiring\QuestionController;
use App\Http\Controllers\Api\Hiring\SettingsController;
use App\Http\Middleware\NoStoreApplicantData;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| B5-H Hiring (Bagian 5) — dimuat di dalam grup v1 `auth:sanctum` + `api-v1`
|--------------------------------------------------------------------------
|
| Rekrutmen untuk aplikasi Android: ringkasan akses menu Lainnya, kandidat
| (chip tahap, tambah manual, ubah data, pindah tahap/tolak/buka kembali),
| profil kandidat (Profil · Wawancara · Checklist · Notulensi · Keputusan),
| lowongan (daftar, buat, pengaturan, pertanyaan) dan pengaturan hiring —
| controller tipis di atas Action/Policy/Query/FormRequest web. HR & Super
| Admin penuh; pewawancara/penyetuju hanya lowongan yang ditugaskan; lainnya
| 404. Data pelamar tidak boleh di-cache: semua respons `no-store`. Secret
| webhook Google Form tidak pernah dikirim ke ponsel (pemasangan skrip =
| desktop). Dokumen: docs/sesi/ponsel-b5h-hiring.md.
*/

Route::prefix('hiring')->name('hiring.')->middleware(NoStoreApplicantData::class)->group(function (): void {
    Route::get('akses', HiringAccessController::class)->name('access');

    // Kandidat
    Route::get('kandidat', [CandidateController::class, 'index'])->name('candidates.index');
    Route::post('kandidat', [CandidateController::class, 'store'])->middleware('throttle:30,1')->name('candidates.store');
    Route::get('kandidat/{candidate}', [CandidateController::class, 'show'])->whereUlid('candidate')->name('candidates.show');
    Route::patch('kandidat/{candidate}', [CandidateController::class, 'update'])->whereUlid('candidate')->name('candidates.update');
    Route::put('kandidat/{candidate}/tahap', [CandidateController::class, 'stage'])->whereUlid('candidate')->name('candidates.stage');

    // Wawancara (simpan otomatis, idempoten per pertanyaan)
    Route::put('kandidat/{candidate}/jawaban/{question}', [InterviewController::class, 'answer'])->whereUlid(['candidate', 'question'])->name('interview.answer');
    Route::put('kandidat/{candidate}/poin/{question}', [InterviewController::class, 'score'])->whereUlid(['candidate', 'question'])->name('interview.score');

    // Checklist
    Route::post('kandidat/{candidate}/checklist', [ChecklistController::class, 'store'])->whereUlid('candidate')->name('checklist.store');
    Route::patch('checklist/{item}', [ChecklistController::class, 'update'])->whereUlid('item')->name('checklist.update');
    Route::delete('checklist/{item}', [ChecklistController::class, 'destroy'])->whereUlid('item')->name('checklist.destroy');

    // Notulensi
    Route::post('kandidat/{candidate}/notulensi', [NoteController::class, 'store'])->whereUlid('candidate')->name('notes.store');
    Route::patch('notulensi/{note}', [NoteController::class, 'update'])->whereUlid('note')->name('notes.update');
    Route::delete('notulensi/{note}', [NoteController::class, 'destroy'])->whereUlid('note')->name('notes.destroy');

    // Keputusan akhir
    Route::post('kandidat/{candidate}/keputusan', [DecisionController::class, 'store'])->whereUlid('candidate')->name('decisions.store');

    // Lowongan
    Route::get('lowongan', [PositionController::class, 'index'])->name('positions.index');
    Route::post('lowongan', [PositionController::class, 'store'])->middleware('throttle:30,1')->name('positions.store');
    Route::get('lowongan/{position}', [PositionController::class, 'show'])->whereUlid('position')->name('positions.show');
    Route::put('lowongan/{position}', [PositionController::class, 'update'])->whereUlid('position')->name('positions.update');
    Route::delete('lowongan/{position}', [PositionController::class, 'destroy'])->whereUlid('position')->name('positions.destroy');

    Route::post('lowongan/{position}/pertanyaan', [QuestionController::class, 'store'])->whereUlid('position')->name('questions.store');
    Route::put('lowongan/{position}/urutan-pertanyaan', [QuestionController::class, 'reorder'])->whereUlid('position')->name('questions.reorder');
    Route::put('pertanyaan/{question}', [QuestionController::class, 'update'])->whereUlid('question')->name('questions.update');
    Route::delete('pertanyaan/{question}', [QuestionController::class, 'destroy'])->whereUlid('question')->name('questions.destroy');

    // Pengaturan hiring
    Route::get('pengaturan', [SettingsController::class, 'show'])->name('settings.show');
    Route::put('pengaturan', [SettingsController::class, 'update'])->name('settings.update');
});
