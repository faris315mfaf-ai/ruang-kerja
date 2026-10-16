<?php

use App\Http\Controllers\Api\Task\TaskActivityController;
use App\Http\Controllers\Api\Task\TaskAttachmentController;
use App\Http\Controllers\Api\Task\TaskChecklistController;
use App\Http\Controllers\Api\Task\TaskCommentController;
use App\Http\Controllers\Api\Task\TaskCommentReactionController;
use App\Http\Controllers\Api\Task\TaskCommentReadController;
use App\Http\Controllers\Api\Task\TaskPickerController;
use App\Http\Controllers\Api\Task\TaskPlanController;
use App\Http\Controllers\Api\Task\TaskSubtaskController;
use App\Http\Controllers\Api\Task\TaskViewController;
use App\Http\Controllers\Api\Task\TaskWatchController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Bagian 3 — paket B3-A1 "Tugas" (API v1, token Sanctum)
|--------------------------------------------------------------------------
|
| Dimuat di dalam grup auth:sanctum + throttle:api-v1 dari routes/api.php
| (prefiks /api/v1, nama api.v1.). Daftar & detail tugas (GET /tugas,
| GET /tugas/{task}, POST/PATCH/DELETE) tetap di routes/api.php; berkas ini
| hanya menambah: rencana pribadi, tampilan tersimpan, checklist, sub-tugas,
| pengamat, lampiran, aktivitas, komentar kaya, tanda baca, dan pemilih
| @ / #. Semua memakai Action, Policy, dan query web yang sama. Dokumen:
| docs/sesi/ponsel-b3a1-tugas.md. Segmen literal ("rencana", "tampilan",
| "rujukan") tidak bentrok dengan {task} karena {task} dibatasi ULID.
*/

// --- Rencana pribadi (task_plans) & tampilan tersimpan "Tugas saya" ---
Route::get('tugas/rencana', [TaskPlanController::class, 'index'])->name('tasks.plan.index');
Route::put('tugas/{task}/rencana', [TaskPlanController::class, 'update'])->whereUlid('task')->name('tasks.plan.update');

Route::get('tugas/tampilan', [TaskViewController::class, 'index'])->name('tasks.views.index');
Route::post('tugas/tampilan', [TaskViewController::class, 'store'])->name('tasks.views.store');
Route::patch('tugas/tampilan/{view}', [TaskViewController::class, 'update'])->whereUlid('view')->name('tasks.views.update');
Route::delete('tugas/tampilan/{view}', [TaskViewController::class, 'destroy'])->whereUlid('view')->name('tasks.views.destroy');

// --- Pemilih @ dan # untuk komposer komentar ---
Route::get('tugas/rujukan', [TaskPickerController::class, 'reference'])->name('tasks.pick.references');
Route::get('tugas/{task}/mention', [TaskPickerController::class, 'mention'])->whereUlid('task')->name('tasks.pick.mentions');

// --- Checklist, sub-tugas, pengamat ---
Route::post('tugas/{task}/checklist', [TaskChecklistController::class, 'store'])->whereUlid('task')->name('tasks.checklist.store');
Route::patch('tugas/{task}/checklist/{item}', [TaskChecklistController::class, 'update'])->whereUlid(['task', 'item'])->name('tasks.checklist.update');
Route::delete('tugas/{task}/checklist/{item}', [TaskChecklistController::class, 'destroy'])->whereUlid(['task', 'item'])->name('tasks.checklist.destroy');

Route::get('tugas/{task}/subtugas', [TaskSubtaskController::class, 'index'])->whereUlid('task')->name('tasks.subtasks.index');
Route::post('tugas/{task}/subtugas', [TaskSubtaskController::class, 'store'])->whereUlid('task')->name('tasks.subtasks.store');

Route::post('tugas/{task}/amati', [TaskWatchController::class, 'store'])->whereUlid('task')->name('tasks.watch');
Route::delete('tugas/{task}/amati', [TaskWatchController::class, 'destroy'])->whereUlid('task')->name('tasks.unwatch');

// --- Lampiran & aktivitas ---
Route::get('tugas/{task}/lampiran', [TaskAttachmentController::class, 'index'])->whereUlid('task')->name('tasks.attachments.index');
Route::post('tugas/{task}/lampiran', [TaskAttachmentController::class, 'store'])->whereUlid('task')
    ->middleware('throttle:30,1')->name('tasks.attachments.store');
Route::delete('tugas/{task}/lampiran/{attachment}', [TaskAttachmentController::class, 'destroy'])->whereUlid(['task', 'attachment'])->name('tasks.attachments.destroy');
Route::get('tugas/{task}/aktivitas', [TaskActivityController::class, 'index'])->whereUlid('task')->name('tasks.activity.index');

// --- Komentar kaya: tanda baca, sunting/hapus sendiri, reaksi ---
Route::post('tugas/{task}/komentar/dibaca', [TaskCommentReadController::class, 'store'])->whereUlid('task')
    ->middleware('throttle:120,1')->name('tasks.comments.read');
Route::get('tugas/{task}/dibaca-oleh', [TaskCommentReadController::class, 'index'])->whereUlid('task')->name('tasks.comments.readers');
Route::patch('komentar/{comment}', [TaskCommentController::class, 'update'])->whereUlid('comment')
    ->middleware('throttle:comments')->name('tasks.comments.update');
Route::delete('komentar/{comment}', [TaskCommentController::class, 'destroy'])->whereUlid('comment')->name('tasks.comments.destroy');
Route::post('komentar/{comment}/reaksi', [TaskCommentReactionController::class, 'store'])->whereUlid('comment')
    ->middleware('throttle:comments')->name('tasks.comments.react');
Route::delete('komentar/{comment}/reaksi', [TaskCommentReactionController::class, 'destroy'])->whereUlid('comment')
    ->middleware('throttle:comments')->name('tasks.comments.unreact');
