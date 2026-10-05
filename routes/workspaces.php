<?php

use App\Http\Controllers\Tasks\ChecklistController;
use App\Http\Controllers\Tasks\CommentController;
use App\Http\Controllers\Tasks\MyTaskController;
use App\Http\Controllers\Tasks\TaskController;
use App\Http\Controllers\Tasks\TaskDetailController;
use App\Http\Controllers\Tasks\TaskFormOptionsController;
use App\Http\Controllers\Tasks\TaskMoveController;
use App\Http\Controllers\Tasks\TaskWatchController;
use App\Http\Controllers\Workspaces\LabelController;
use App\Http\Controllers\Workspaces\ReferenceController;
use App\Http\Controllers\Workspaces\SavedViewController;
use App\Http\Controllers\Workspaces\TaskStatusController;
use App\Http\Controllers\Workspaces\WorkspaceArchiveController;
use App\Http\Controllers\Workspaces\WorkspaceController;
use App\Http\Controllers\Workspaces\WorkspaceDocumentController;
use App\Http\Controllers\Workspaces\WorkspaceFavoriteController;
use App\Http\Controllers\Workspaces\WorkspaceFileController;
use App\Http\Controllers\Workspaces\WorkspaceMemberController;
use App\Http\Controllers\Workspaces\WorkspaceSettingsController;
use App\Http\Controllers\Workspaces\WorkspaceTabController;
use App\Http\Controllers\Workspaces\WorkspaceTaskController;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;

/*
| Workspaces & tasks (Sprint 5). Workspace URLs use the key: /w/OPS. A key
| from before a rename redirects (GET) to the current one; a ULID also
| resolves (broadcast channel `workspace.{id}`).
*/
Route::bind('workspace', function (string $value): Workspace {
    $request = request();
    $user = $request->user();
    $companyId = $user instanceof User ? $user->company_id : null;

    $workspace = strlen($value) === 26
        ? Workspace::query()->find(strtolower($value))
        : Workspace::findByKey($value, $companyId);

    // Never reveal whether a workspace (or an old key) exists to someone who may
    // not see it: 404 before any redirect, validation or controller code.
    abort_if($workspace === null || ! $user instanceof User || Gate::forUser($user)->denies('view', $workspace), 404);

    // Old or lower-case key in a page URL → canonical /w/{KEY}.
    if (strlen($value) !== 26 && $value !== $workspace->key && $request->isMethod('GET')) {
        throw new HttpResponseException(redirect()->to(
            (string) preg_replace('#/w/[^/?]+#', '/w/'.$workspace->key, $request->getRequestUri(), 1),
            301,
        ));
    }

    return $workspace;
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('tugas', [MyTaskController::class, 'index'])->name('tasks.mine');
    Route::get('tugas/opsi-form', TaskFormOptionsController::class)->name('tasks.form-options');
    Route::patch('tugas/{task}', [TaskController::class, 'update'])->name('tasks.update');
    Route::delete('tugas/{task}', [TaskController::class, 'destroy'])->name('tasks.destroy');
    Route::patch('tugas/{task}/move', TaskMoveController::class)->name('tasks.move');

    // Sprint 6 — task detail, comments, checklist, watchers (JSON for the TaskSheet).
    Route::get('tugas/{task}', [TaskDetailController::class, 'show'])->whereUlid('task')->name('tasks.show');
    Route::post('tugas/{task}/pantau', [TaskWatchController::class, 'store'])->name('tasks.watch');
    Route::delete('tugas/{task}/pantau', [TaskWatchController::class, 'destroy'])->name('tasks.unwatch');
    Route::post('tugas/{task}/checklist', [ChecklistController::class, 'store'])->name('tasks.checklist.store');
    Route::patch('checklist/{item}', [ChecklistController::class, 'update'])->name('checklist.update');
    Route::delete('checklist/{item}', [ChecklistController::class, 'destroy'])->name('checklist.destroy');
    Route::post('tugas/{task}/komentar', [CommentController::class, 'store'])->middleware('throttle:comments')->name('comments.store');
    Route::patch('komentar/{comment}', [CommentController::class, 'update'])->middleware('throttle:comments')->name('comments.update');
    Route::delete('komentar/{comment}', [CommentController::class, 'destroy'])->name('comments.destroy');
    Route::post('komentar/{comment}/reaksi', [CommentController::class, 'react'])->name('comments.react');

    Route::get('workspace', [WorkspaceController::class, 'index'])->name('workspaces.index');
    Route::post('workspace', [WorkspaceController::class, 'store'])->name('workspaces.store');

    Route::prefix('w/{workspace}')->scopeBindings()->group(function () {
        Route::get('/', [WorkspaceTaskController::class, 'show'])->name('workspaces.show');
        Route::patch('/', [WorkspaceController::class, 'update'])->name('workspaces.update');
        Route::get('dokumen', [WorkspaceDocumentController::class, 'index'])->name('workspaces.documents');
        Route::get('file', [WorkspaceFileController::class, 'index'])->name('workspaces.files');
        Route::get('aktivitas', [WorkspaceTabController::class, 'activity'])->name('workspaces.activity');
        Route::get('pengaturan', [WorkspaceSettingsController::class, 'show'])->name('workspaces.settings');

        Route::post('arsip', [WorkspaceArchiveController::class, 'store'])->name('workspaces.archive');
        Route::delete('arsip', [WorkspaceArchiveController::class, 'destroy'])->name('workspaces.restore');
        Route::post('favorit', [WorkspaceFavoriteController::class, 'store'])->name('workspaces.favorite');
        Route::delete('favorit', [WorkspaceFavoriteController::class, 'destroy'])->name('workspaces.unfavorite');

        Route::post('anggota', [WorkspaceMemberController::class, 'store'])->name('workspaces.members.store');
        Route::patch('anggota/{member}', [WorkspaceMemberController::class, 'update'])->withoutScopedBindings()->name('workspaces.members.update');
        Route::delete('anggota/{member}', [WorkspaceMemberController::class, 'destroy'])->withoutScopedBindings()->name('workspaces.members.destroy');

        Route::post('status', [TaskStatusController::class, 'store'])->name('workspaces.statuses.store');
        Route::put('status-urutan', [TaskStatusController::class, 'reorder'])->name('workspaces.statuses.reorder');
        Route::patch('status/{status}', [TaskStatusController::class, 'update'])->name('workspaces.statuses.update');
        Route::delete('status/{status}', [TaskStatusController::class, 'destroy'])->name('workspaces.statuses.destroy');

        Route::post('label', [LabelController::class, 'store'])->name('workspaces.labels.store');
        Route::patch('label/{label}', [LabelController::class, 'update'])->name('workspaces.labels.update');
        Route::delete('label/{label}', [LabelController::class, 'destroy'])->name('workspaces.labels.destroy');

        Route::post('tugas', [TaskController::class, 'store'])->name('tasks.store');

        // Sprint 6 — full-screen task detail, editor suggestions, saved views.
        Route::get('tasks/{number}', [TaskDetailController::class, 'page'])->whereNumber('number')->name('tasks.page');
        Route::get('rujukan', ReferenceController::class)->name('workspaces.references');
        Route::post('tampilan', [SavedViewController::class, 'store'])->name('workspaces.views.store');
        Route::patch('tampilan/{view}', [SavedViewController::class, 'update'])->withoutScopedBindings()->name('workspaces.views.update');
        Route::delete('tampilan/{view}', [SavedViewController::class, 'destroy'])->withoutScopedBindings()->name('workspaces.views.destroy');
    });
});
