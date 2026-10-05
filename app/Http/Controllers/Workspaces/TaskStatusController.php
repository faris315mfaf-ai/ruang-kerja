<?php

namespace App\Http\Controllers\Workspaces;

use App\Domain\Tasks\Actions\CreateTaskStatus;
use App\Domain\Tasks\Actions\DeleteTaskStatus;
use App\Domain\Tasks\Actions\ReorderTaskStatuses;
use App\Domain\Tasks\Actions\UpdateTaskStatus;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workspaces\TaskStatusRequest;
use App\Models\TaskStatus;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Pengaturan › Kolom status.
 */
class TaskStatusController extends Controller
{
    public function store(TaskStatusRequest $request, Workspace $workspace, CreateTaskStatus $create): RedirectResponse
    {
        Gate::authorize('update', $workspace);

        $create->handle(
            $workspace,
            $request->string('name')->trim()->toString(),
            TaskStatusCategory::from($request->string('category')->toString()),
            $request->filled('color') ? $request->string('color')->toString() : null,
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Kolom ditambahkan.']);

        return back();
    }

    public function update(TaskStatusRequest $request, Workspace $workspace, TaskStatus $status, UpdateTaskStatus $update): RedirectResponse
    {
        Gate::authorize('update', $status);

        $update->handle($status, $request->changes());

        return back();
    }

    public function destroy(Request $request, Workspace $workspace, TaskStatus $status, DeleteTaskStatus $delete): RedirectResponse
    {
        Gate::authorize('delete', $status);

        $targetId = $request->string('target_status_id')->toString();
        $target = $targetId === '' ? null : TaskStatus::query()->where('workspace_id', $workspace->id)->find($targetId);

        $delete->handle($status, $target);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Kolom {$status->name} dihapus."]);

        return back();
    }

    public function reorder(Request $request, Workspace $workspace, ReorderTaskStatuses $reorder): RedirectResponse
    {
        Gate::authorize('update', $workspace);

        $validated = $request->validate([
            'status_ids' => ['required', 'array', 'max:50'],
            'status_ids.*' => ['string', 'distinct'],
        ], ['status_ids.required' => 'Urutan kolom wajib diisi.']);

        /** @var list<string> $ids */
        $ids = array_values($validated['status_ids']);
        $reorder->handle($workspace, $ids);

        return back();
    }
}
