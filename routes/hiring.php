<?php

use App\Http\Controllers\Hiring\CandidateController;
use App\Http\Controllers\Hiring\ChecklistController;
use App\Http\Controllers\Hiring\DecisionController;
use App\Http\Controllers\Hiring\FormWebhookController;
use App\Http\Controllers\Hiring\InterviewController;
use App\Http\Controllers\Hiring\NoteController;
use App\Http\Controllers\Hiring\PositionController;
use App\Http\Controllers\Hiring\QuestionController;
use App\Http\Controllers\Hiring\SettingsController;
use App\Http\Middleware\AuthenticateSession;
use App\Http\Middleware\EnsureActiveEmployee;
use App\Http\Middleware\EnsureTwoFactorForSuperAdmin;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\RestrictCredentialRoutes;
use App\Http\Middleware\RestrictKioskDevice;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Illuminate\View\Middleware\ShareErrorsFromSession;

/*
 * Hiring (owner decision 6 Oct 2026; docs/fitur/hiring.md). HR & Super Admin
 * manage everything; assigned interviewers / final approvers see their
 * positions; everyone else gets 404 (HiringPositionPolicy, CandidatePolicy).
 */

// Google Form → Apps Script webhook: no session, cookies or CSRF (it is signed
// with the position's HMAC secret instead), JSON only, rate limited per IP.
Route::post('api/hiring/form/{token}', FormWebhookController::class)
    ->where('token', '[a-z0-9]{40}')
    ->withoutMiddleware([
        EncryptCookies::class,
        AddQueuedCookiesToResponse::class,
        StartSession::class,
        ShareErrorsFromSession::class,
        PreventRequestForgery::class,
        'auth.session',
        AuthenticateSession::class,
        EnsureActiveEmployee::class,
        RestrictKioskDevice::class,
        RestrictCredentialRoutes::class,
        EnsureTwoFactorForSuperAdmin::class,
        HandleAppearance::class,
        HandleInertiaRequests::class,
        AddLinkHeadersForPreloadedAssets::class,
    ])
    ->middleware('throttle:60,1')
    ->name('hiring.webhook');

Route::middleware(['auth', 'verified'])->prefix('hiring')->name('hiring.')->group(function () {
    Route::get('/', [CandidateController::class, 'index'])->name('index');
    Route::post('kandidat', [CandidateController::class, 'store'])->name('candidates.store');
    Route::get('kandidat/{candidate}', [CandidateController::class, 'show'])->whereUlid('candidate')->name('candidates.show');
    Route::patch('kandidat/{candidate}', [CandidateController::class, 'update'])->whereUlid('candidate')->name('candidates.update');
    Route::put('kandidat/{candidate}/tahap', [CandidateController::class, 'stage'])->whereUlid('candidate')->name('candidates.stage');

    Route::put('kandidat/{candidate}/jawaban/{question}', [InterviewController::class, 'answer'])->whereUlid(['candidate', 'question'])->name('interview.answer');
    Route::put('kandidat/{candidate}/poin/{question}', [InterviewController::class, 'score'])->whereUlid(['candidate', 'question'])->name('interview.score');

    Route::post('kandidat/{candidate}/checklist', [ChecklistController::class, 'store'])->whereUlid('candidate')->name('checklist.store');
    Route::patch('checklist/{item}', [ChecklistController::class, 'update'])->whereUlid('item')->name('checklist.update');
    Route::delete('checklist/{item}', [ChecklistController::class, 'destroy'])->whereUlid('item')->name('checklist.destroy');

    Route::post('kandidat/{candidate}/notulensi', [NoteController::class, 'store'])->whereUlid('candidate')->name('notes.store');
    Route::patch('notulensi/{note}', [NoteController::class, 'update'])->whereUlid('note')->name('notes.update');
    Route::delete('notulensi/{note}', [NoteController::class, 'destroy'])->whereUlid('note')->name('notes.destroy');

    Route::post('kandidat/{candidate}/keputusan', [DecisionController::class, 'store'])->whereUlid('candidate')->name('decisions.store');

    Route::get('lowongan', [PositionController::class, 'index'])->name('positions.index');
    Route::post('lowongan', [PositionController::class, 'store'])->name('positions.store');
    Route::get('lowongan/{position}', [PositionController::class, 'edit'])->whereUlid('position')->name('positions.edit');
    Route::put('lowongan/{position}', [PositionController::class, 'update'])->whereUlid('position')->name('positions.update');
    Route::delete('lowongan/{position}', [PositionController::class, 'destroy'])->whereUlid('position')->name('positions.destroy');
    Route::post('lowongan/{position}/webhook', [PositionController::class, 'regenerate'])->whereUlid('position')->name('positions.webhook');

    Route::post('lowongan/{position}/pertanyaan', [QuestionController::class, 'store'])->whereUlid('position')->name('questions.store');
    Route::put('lowongan/{position}/urutan-pertanyaan', [QuestionController::class, 'reorder'])->whereUlid('position')->name('questions.reorder');
    Route::put('pertanyaan/{question}', [QuestionController::class, 'update'])->whereUlid('question')->name('questions.update');
    Route::delete('pertanyaan/{question}', [QuestionController::class, 'destroy'])->whereUlid('question')->name('questions.destroy');

    Route::get('pengaturan', [SettingsController::class, 'edit'])->name('settings.edit');
    Route::put('pengaturan', [SettingsController::class, 'update'])->name('settings.update');
});
