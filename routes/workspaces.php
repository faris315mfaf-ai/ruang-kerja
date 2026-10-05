<?php

use App\Http\Controllers\Tasks\MyTaskController;
use App\Http\Controllers\Tasks\TaskController;
use App\Http\Controllers\Tasks\TaskFormOptionsController;
use App\Http\Controllers\Tasks\TaskMoveController;
use App\Http\Controllers\Workspaces\LabelController;
use App\Http\Controllers\Workspaces\TaskStatusController;
use App\Http\Controllers\Workspaces\WorkspaceArchiveController;
use App\Http\Controllers\Workspaces\WorkspaceController;
use App\Http\Controllers\Workspaces\WorkspaceFavoriteController;
use App\Http\Controllers\Workspaces\WorkspaceMemberController;
use App\Http\Controllers\Workspaces\WorkspaceSettingsController;
use App\Http\Controllers\Workspaces\WorkspaceTabController;
use App\Http\Controllers\Workspaces\WorkspaceTaskController;
use App\Models\Workspace;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Route;

/*
| Workspaces & tasks (Sprint 5). Workspace URLs use the key: /w/OPS. A key
| from before a rename redirects (GET) to the current one; a ULID also
| resolves (broadcast channel `workspace.{id}`).
*/
Route::bind('workspace', function (string $value): Workspace {
    $workspace = strlen($value) === 26
        ? Workspace::query()->find(strtolower($value))
        : Workspace::findByKey($value);

    abort_if($workspace === null, 404);

    $request = request();

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

    Route::get('workspace', [WorkspaceController::class, 'index'])->name('workspaces.index');
    Route::post('workspace', [WorkspaceController::class, 'store'])->name('workspaces.store');

    Route::prefix('w/{workspace}')->scopeBindings()->group(function () {
        Route::get('/', [WorkspaceTaskController::class, 'show'])->name('workspaces.show');
        Route::patch('/', [WorkspaceController::class, 'update'])->name('workspaces.update');
        Route::get('dokumen', [WorkspaceTabController::class, 'documents'])->name('workspaces.documents');
        Route::get('file', [WorkspaceTabController::class, 'files'])->name('workspaces.files');
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
    });
});
