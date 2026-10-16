<?php

use App\Http\Controllers\Api\Automation\RecurringController;
use App\Http\Controllers\Api\Automation\RuleController;
use App\Http\Controllers\Api\Automation\TaskTemplateController;
use App\Http\Controllers\Api\Workspaces\WorkspaceActivityController;
use App\Http\Controllers\Api\Workspaces\WorkspaceCalendarController;
use App\Http\Controllers\Api\Workspaces\WorkspaceCardMoveController;
use App\Http\Controllers\Api\Workspaces\WorkspaceController;
use App\Http\Controllers\Api\Workspaces\WorkspaceDriveController;
use App\Http\Controllers\Api\Workspaces\WorkspaceFavoriteController;
use App\Http\Controllers\Api\Workspaces\WorkspaceMemberController;
use App\Http\Controllers\Api\Workspaces\WorkspaceSettingsController;
use App\Http\Controllers\Api\Workspaces\WorkspaceShowController;
use App\Http\Controllers\Api\Workspaces\WorkspaceTaskListController;
use App\Http\Controllers\Api\Workspaces\WorkspaceTemplateController;
use App\Http\Middleware\EnsureFeatureEnabled;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| B3-A2 — Workspace & otomasi (Bagian 3, aplikasi Android)
|--------------------------------------------------------------------------
|
| Loaded inside the v1 `auth:sanctum` + `throttle:api-v1` group of
| routes/api.php (names are prefixed `api.v1.`). Thin controllers over the
| web Actions/Policies/Queries of Workspaces, Automation and Google; the
| existing workspace routes (`workspace`, `workspace/{ws}/papan`,
| `workspace/{ws}/anggota`, `workspace/{ws}/catatan`) stay in routes/api.php.
| Documentation: docs/sesi/ponsel-b3a2-workspace.md.
*/

// Workspace list is routes/api.php (`workspaces.index`); create + templates here.
Route::post('workspace', [WorkspaceController::class, 'store'])
    ->middleware('throttle:30,1')->name('workspaces.store');

// Must come before `workspace/{workspace}` (a key like "templat" would not resolve).
Route::get('workspace/templat', WorkspaceTemplateController::class)
    ->middleware(EnsureFeatureEnabled::class.':automation')->name('workspaces.templates');

Route::get('workspace/{workspace}', WorkspaceShowController::class)->name('workspaces.show');
Route::post('workspace/{workspace}/favorit', [WorkspaceFavoriteController::class, 'store'])->name('workspaces.favorite');
Route::delete('workspace/{workspace}/favorit', [WorkspaceFavoriteController::class, 'destroy'])->name('workspaces.unfavorite');

// Tabs.
Route::get('workspace/{workspace}/tugas', WorkspaceTaskListController::class)->name('workspaces.tasks');
Route::get('workspace/{workspace}/kalender', WorkspaceCalendarController::class)->name('workspaces.calendar');
Route::patch('workspace/{workspace}/papan/kartu/{task}', WorkspaceCardMoveController::class)
    ->whereUlid('task')->name('workspaces.board.move');
Route::get('workspace/{workspace}/aktivitas', WorkspaceActivityController::class)->name('workspaces.activity');
Route::get('workspace/{workspace}/pengaturan', WorkspaceSettingsController::class)->name('workspaces.settings');

// Dokumen & File (Google Drive cache; writes answer 503 drive_belum_siap until Google is configured).
Route::get('workspace/{workspace}/dokumen', [WorkspaceDriveController::class, 'documents'])->name('workspaces.documents');
Route::post('workspace/{workspace}/dokumen', [WorkspaceDriveController::class, 'storeDocument'])
    ->middleware('throttle:20,1')->name('workspaces.documents.store');
Route::get('workspace/{workspace}/file', [WorkspaceDriveController::class, 'files'])->name('workspaces.files');
Route::post('workspace/{workspace}/file/folder', [WorkspaceDriveController::class, 'storeFolder'])
    ->middleware('throttle:20,1')->name('workspaces.files.folders.store');

// Anggota (GET list stays on the invokable controller registered in routes/api.php).
Route::get('workspace/{workspace}/anggota/kandidat', [WorkspaceMemberController::class, 'candidates'])->name('workspaces.members.candidates');
Route::post('workspace/{workspace}/anggota', [WorkspaceMemberController::class, 'store'])->name('workspaces.members.store');
Route::patch('workspace/{workspace}/anggota/{member}', [WorkspaceMemberController::class, 'update'])
    ->whereUlid('member')->name('workspaces.members.update');
Route::delete('workspace/{workspace}/anggota/{member}', [WorkspaceMemberController::class, 'destroy'])
    ->whereUlid('member')->name('workspaces.members.destroy');

// Otomasi — behind features.automation (404 while off).
Route::middleware(EnsureFeatureEnabled::class.':automation')->group(function (): void {
    Route::get('otomasi/aturan', [RuleController::class, 'index'])->name('automation.rules.index');
    Route::get('otomasi/aturan/{rule}', [RuleController::class, 'show'])->whereUlid('rule')->name('automation.rules.show');
    Route::patch('otomasi/aturan/{rule}/jeda', [RuleController::class, 'pause'])->whereUlid('rule')->name('automation.rules.pause');
    Route::get('otomasi/berulang', RecurringController::class)->name('automation.recurring.index');
    Route::get('otomasi/templat/tugas', [TaskTemplateController::class, 'index'])->name('automation.templates.tasks');
    Route::post('workspace/{workspace}/tugas-dari-templat', [TaskTemplateController::class, 'apply'])
        ->middleware('throttle:30,1')->name('workspaces.tasks.from-template');
});
